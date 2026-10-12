import { checkSameOrigin } from '@/lib/voc/request-guard'
import { buildTaxonomyExport, TAXONOMY_VERSION, PROMPT_VERSION, isValidChildId, isValidParentId, getParentIdForChild } from '@/lib/voc/taxonomy-export'
import { validateProposal } from '@/lib/voc/audit-package'
import type { AiProposal, AuditErrorCode, ProposalValidationResult, Review } from '@/lib/voc/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const NO_STORE = { 'Cache-Control': 'no-store' }

function errorResponse(code: AuditErrorCode, status: number, message: string) {
  return Response.json({ error: { code, message } }, { status, headers: NO_STORE })
}

function hashStringSimple(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0
  }
  return Math.abs(hash).toString(36)
}

interface ProposalRequestPayload {
  reviews: Review[]
}

export async function POST(request: Request) {
  const originRejection = checkSameOrigin(request)
  if (originRejection) {
    return errorResponse('METHOD_NOT_ALLOWED', originRejection.status, originRejection.message)
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return errorResponse('PROVIDER_NOT_CONFIGURED', 503, 'No AI provider API key is configured. The audit export remains functional without AI proposals.')
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return errorResponse('INVALID_RESPONSE', 400, 'Request body is not valid JSON.')
  }

  const payload = body as ProposalRequestPayload
  if (!payload || !Array.isArray(payload.reviews) || payload.reviews.length === 0) {
    return errorResponse('NO_REVIEWS', 400, 'No reviews provided for AI proposals.')
  }

  const reviews = payload.reviews.filter(isReview) as Review[]
  if (reviews.length === 0) {
    return errorResponse('NO_REVIEWS', 400, 'No valid reviews provided.')
  }

  const taxonomy = buildTaxonomyExport()
  const modelId = process.env.OPENAI_MODEL || 'gpt-4o-mini'

  const proposals: AiProposal[] = []
  const validations: ProposalValidationResult[] = []

  // Process in batches of 10
  for (let i = 0; i < reviews.length; i += 10) {
    const batch = reviews.slice(i, i + 10)

    try {
      const batchProposals = await callModel(batch, taxonomy, apiKey, modelId)

      for (const review of batch) {
        const proposal = batchProposals.find((p) => p.reviewId === review.reviewId)
        if (!proposal) {
          proposals.push({
            reviewId: review.reviewId,
            sourceTextHash: hashStringSimple([review.title ?? '', review.text ?? ''].join('\n')),
            parentLabels: [],
            childLabels: [],
            primaryIssue: null,
            sentiment: 'unclear',
            evidenceExcerpts: [],
            rationale: 'No proposal returned by model.',
            uncertain: true,
            uncertainReason: 'Model returned no response for this review.',
            hasMultipleIssues: false,
            taxonomyVersion: TAXONOMY_VERSION,
            modelId,
            promptVersion: PROMPT_VERSION,
            generatedAt: new Date().toISOString(),
          })
        } else {
          proposals.push(proposal)
        }

        const proposalForValidation = proposals.find((p) => p.reviewId === review.reviewId)
        if (proposalForValidation) {
          const validation = validateProposal(proposalForValidation, review)
          validations.push(validation)
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      if (message.includes('rate limit') || message.includes('429')) {
        return errorResponse('RATE_LIMITED', 429, 'AI provider rate limit reached. Some proposals may be incomplete.')
      }
      console.error('[voc] AI proposal batch failed:', message)
      // Record failed proposals for this batch
      for (const review of batch) {
        proposals.push({
          reviewId: review.reviewId,
          sourceTextHash: hashStringSimple([review.title ?? '', review.text ?? ''].join('\n')),
          parentLabels: [],
          childLabels: [],
          primaryIssue: null,
          sentiment: 'unclear',
          evidenceExcerpts: [],
          rationale: 'Proposal failed due to provider error.',
          uncertain: true,
          uncertainReason: message,
          hasMultipleIssues: false,
          taxonomyVersion: TAXONOMY_VERSION,
          modelId,
          promptVersion: PROMPT_VERSION,
          generatedAt: new Date().toISOString(),
        })
      }
    }
  }

  return Response.json({ proposals, validations, modelId }, { status: 200, headers: NO_STORE })
}

export function GET() {
  return errorResponse('METHOD_NOT_ALLOWED', 405, 'Use POST to generate AI proposals.')
}

function isReview(value: unknown): value is Review {
  if (!value || typeof value !== 'object') return false
  const v = value as Partial<Review>
  return (
    typeof v.reviewId === 'string' &&
    typeof v.rating === 'number' &&
    typeof v.postedAt === 'string' &&
    v.source === 'google_play'
  )
}

async function callModel(
  batch: Review[],
  taxonomy: ReturnType<typeof buildTaxonomyExport>,
  apiKey: string,
  modelId: string,
): Promise<AiProposal[]> {
  const taxonomyText = formatTaxonomyForPrompt(taxonomy)
  const reviewsText = batch.map((r) => {
    const text = [r.title, r.text].filter(Boolean).join(' ')
    return `REVIEW_ID: ${r.reviewId}\nRATING: ${r.rating}\nTEXT: ${text}`
  }).join('\n\n---\n\n')

  const systemPrompt = `You are a review classification assistant for a home services app (Snabbit). You will receive reviews and a taxonomy. For each review, propose labels.

Rules:
- Read the complete review text carefully.
- Do not infer facts not stated in the review. Do not infer theft, safety incidents, or root causes without explicit evidence.
- You may abstain or mark a review unclear if there is insufficient evidence.
- Evidence excerpts must be EXACT substring copies from the review text. Do not paraphrase.
- Do not assign labels you are uncertain about — mark uncertain instead.
- A review may have multiple distinct issues.

${taxonomyText}`

  const userPrompt = `Classify each of the following reviews. Return a JSON array where each element has:
{
  "reviewId": string,
  "parentLabels": string[] (from the parent category IDs listed above),
  "childLabels": string[] (from the child category IDs listed above),
  "primaryIssue": string | null,
  "sentiment": "positive" | "negative" | "mixed" | "neutral" | "unclear",
  "evidenceExcerpts": [{ "label": string, "excerpt": string }],
  "rationale": string,
  "uncertain": boolean,
  "uncertainReason": string | null,
  "hasMultipleIssues": boolean
}

Reviews:
${reviewsText}`

  const maxRetries = 2
  let lastError: Error | null = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: modelId,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0,
          response_format: { type: 'json_object' },
        }),
      })

      if (!res.ok) {
        const errText = await res.text().catch(() => res.statusText)
        if (res.status === 429) throw new Error('rate limit (429)')
        throw new Error(`OpenAI API error ${res.status}: ${errText}`)
      }

      const data = await res.json() as {
        choices?: { message?: { content?: string } }[]
        usage?: { total_tokens?: number; prompt_tokens?: number; completion_tokens?: number }
      }

      const content = data.choices?.[0]?.message?.content
      if (!content) throw new Error('No content in model response')

      const parsed = JSON.parse(content) as { proposals?: AiProposal[] } | AiProposal[]
      const rawProposals = Array.isArray(parsed) ? parsed : parsed.proposals ?? []

      const proposals: AiProposal[] = rawProposals.map((p) => ({
        reviewId: p.reviewId,
        sourceTextHash: hashStringSimple(
          batch.find((r) => r.reviewId === p.reviewId)
            ? [batch.find((r) => r.reviewId === p.reviewId)!.title ?? '', batch.find((r) => r.reviewId === p.reviewId)!.text ?? ''].join('\n')
            : '',
        ),
        parentLabels: p.parentLabels ?? [],
        childLabels: p.childLabels ?? [],
        primaryIssue: p.primaryIssue ?? null,
        sentiment: p.sentiment ?? 'unclear',
        evidenceExcerpts: p.evidenceExcerpts ?? [],
        rationale: p.rationale ?? '',
        uncertain: p.uncertain ?? false,
        uncertainReason: p.uncertainReason ?? null,
        hasMultipleIssues: p.hasMultipleIssues ?? false,
        taxonomyVersion: TAXONOMY_VERSION,
        modelId,
        promptVersion: PROMPT_VERSION,
        generatedAt: new Date().toISOString(),
      }))

      return proposals
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      if (lastError.message.includes('rate limit')) throw lastError
      if (attempt < maxRetries) continue
      throw lastError
    }
  }

  throw lastError ?? new Error('Unknown error')
}

function formatTaxonomyForPrompt(taxonomy: ReturnType<typeof buildTaxonomyExport>): string {
  const parents = taxonomy.parents.map((p) => `- ${p.id}: ${p.label} — ${p.description}`).join('\n')
  const children = taxonomy.children.map((c) =>
    `- ${c.id} (parent: ${c.parent}): ${c.label} — ${c.description}\n  Inclusion: ${c.inclusionCriteria.join('; ')}\n  Exclusion: ${c.exclusionCriteria.join('; ')}`,
  ).join('\n')
  return `PARENT CATEGORIES:\n${parents}\n\nCHILD CATEGORIES:\n${children}`
}
