// Evaluation: improved classifier + baseline predictions vs. verified manual audit labels.
// Diagnostic only — the 37-review audit sample is enriched for difficult cases and is NOT
// representative of all 500 reviews.
import { readFileSync } from 'node:fs'
import { classifyReview } from '../lib/voc/analysis-engine'
import { getParentIdForChild } from '../lib/voc/taxonomy-export'
import type { CategoryId, Review, Sentiment } from '../lib/voc/types'

const rows: string[][] = JSON.parse(readFileSync('/tmp/xlsx/rows.json', 'utf8'))

// ---------------------------------------------------------------------------
// Step 1: Load and validate the verified audit dataset
// ---------------------------------------------------------------------------
interface AuditRow {
  reviewId: string
  text: string
  rating: number
  verifiedParents: string[]
  verifiedChildren: string[]
  verifiedSentiment: string
  baselinePrimaryChild: string
  baselinePrimaryParent: string
  baselineSecondaryChildren: string[]
  baselineSentiment: string
}

const CHILD_IDS: CategoryId[] = [
  'service_delivery', 'booking_availability', 'payments_credits_refunds', 'customer_support',
  'trust_safety_property', 'app_functionality', 'account_access', 'updates_compatibility',
  'positive_experience', 'other_unclear',
]

// The verified columns use display labels; map them back to the engine's child IDs.
const LABEL_TO_CHILD: Record<string, CategoryId> = {
  'Service delivery & reliability': 'service_delivery',
  'Booking & availability': 'booking_availability',
  'Payments, credits & refunds': 'payments_credits_refunds',
  'Customer support & complaint resolution': 'customer_support',
  'Trust, safety & property': 'trust_safety_property',
  'App functionality & performance': 'app_functionality',
  'Account access & authentication': 'account_access',
  'Updates & compatibility': 'updates_compatibility',
  'Positive experiences': 'positive_experience',
  'Other / unclear': 'other_unclear',
}

// Baseline parent IDs use full taxonomy names; map them to the engine's parent buckets via child→parent.
const PARENT_BY_CHILD = new Map(CHILD_IDS.map((c) => [c, getParentIdForChild(c)]))

const PARENT_ALIASES: Record<string, string> = {
  service_delivery_professional_conduct: 'service_delivery_professional_conduct',
  availability_coverage_scheduling: 'availability_coverage_scheduling',
  payments_pricing_refunds: 'payments_pricing_refunds',
  customer_support_resolution: 'customer_support_resolution',
  trust_safety_property: 'trust_safety_property',
  app_digital_experience: 'app_digital_experience',
}

function normParent(raw: string): string {
  const key = raw.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_')
  if (PARENT_ALIASES[key]) return PARENT_ALIASES[key]
  return key
}

// Parent IDs produced by the engine (derived from its child taxonomy)
const ENGINE_PARENTS = new Set([...PARENT_BY_CHILD.values()])

const verified: AuditRow[] = []
const excluded: { reviewId: string; status: string }[] = []
for (let i = 1; i < rows.length; i++) {
  const r = rows[i]
  if (!r || !r[0] || !r[0].trim()) continue
  const status = (r[20] ?? '').trim()
  const row = {
    reviewId: r[0].trim(),
    text: (r[1] ?? '').trim(),
    rating: Number(r[2] ?? 0),
    verifiedParents: (r[16] ?? '').split(';').map((s) => s.trim()).filter(Boolean).map(normParent),
    verifiedChildren: (r[17] ?? '').split(';').map((s) => s.trim()).filter(Boolean).map((label) => LABEL_TO_CHILD[label] ?? `UNMAPPED:${label}`),
    verifiedSentiment: (r[18] ?? '').trim(),
    baselinePrimaryChild: (r[6] ?? '').trim(),
    baselinePrimaryParent: (r[8] ?? '').trim(),
    baselineSecondaryChildren: (r[10] ?? '').split(';').map((s) => s.trim()).filter(Boolean),
    baselineSentiment: (r[13] ?? '').trim(),
  }
  if (status === 'Verified') verified.push(row)
  else excluded.push({ reviewId: row.reviewId, status: status || '(empty)' })
}

console.log('=== 1. Dataset validation ===')
console.log(`Total data rows: ${verified.length + excluded.length}`)
console.log(`Verified (included): ${verified.length}`)
console.log(`Excluded: ${excluded.length}`, excluded.map((e) => `${e.reviewId.slice(0, 8)}:${e.status}`).join(', '))

const sentimentIssues = verified.filter((v) => !['negative', 'mixed', 'positive'].includes(v.verifiedSentiment.toLowerCase()))
console.log(`Verified sentiment values OK: ${sentimentIssues.length === 0 ? 'yes' : 'no — ' + sentimentIssues.map((s) => s.verifiedSentiment).join('/')}`)
const unmappedChildren = verified.flatMap((v) => v.verifiedChildren).filter((c) => !CHILD_IDS.includes(c as CategoryId))
console.log(`Verified child labels not in engine taxonomy: ${unmappedChildren.length === 0 ? 'none' : [...new Set(unmappedChildren)].join(', ')}`)
const unmappedParents = verified.flatMap((v) => v.verifiedParents).filter((p) => !ENGINE_PARENTS.has(p as never))
console.log(`Verified parent labels not in engine taxonomy: ${unmappedParents.length === 0 ? 'none' : [...new Set(unmappedParents)].join(', ')}`)

// ---------------------------------------------------------------------------
// Step 2: Run improved classifier on verified rows (text only, no manual labels)
// ---------------------------------------------------------------------------
function toReview(row: AuditRow): Review {
  return {
    reviewId: row.reviewId,
    source: 'google_play',
    rating: row.rating as Review['rating'],
    title: null,
    text: row.text,
    postedAt: new Date().toISOString(),
    appVersion: null,
    thumbsUpCount: null,
    developerResponse: null,
    collectedVia: 'newest',
  }
}

// ---------------------------------------------------------------------------
// Step 3: Baseline predictions come from the audit XLSX columns (original run output)
// ---------------------------------------------------------------------------
function childToParent(childId: string): string {
  return PARENT_BY_CHILD.get(childId as CategoryId) ?? 'unknown'
}

interface PerReview {
  row: AuditRow
  improved: ReturnType<typeof classifyReview>
  basePrimary: string
  baseSecondary: string[]
  baseSentiment: string
}

const perReview: PerReview[] = verified.map((row) => {
  const improved = classifyReview(toReview(row))
  const baseSecondary = row.baselineSecondaryChildren.filter((c) => CHILD_IDS.includes(c as CategoryId))
  return { row, improved, basePrimary: row.baselinePrimaryChild, baseSecondary, baseSentiment: row.baselineSentiment }
})

// ---------------------------------------------------------------------------
// Step 4: Metrics
// ---------------------------------------------------------------------------
interface MultiLabelMetrics { precision: number; recall: number; f1: number; exactMatch: number; tp: number; fp: number; fn: number }

function multiLabelMetrics(getPred: (p: PerReview) => string[], getTrue: (p: PerReview) => string[]): MultiLabelMetrics {
  let tp = 0, fp = 0, fn = 0, exact = 0
  for (const p of perReview) {
    const pred = new Set(getPred(p))
    const truth = new Set(getTrue(p))
    for (const t of truth) if (pred.has(t)) tp++; else fn++
    for (const q of pred) if (!truth.has(q)) fp++
    if (pred.size === truth.size && [...pred].every((x) => truth.has(x))) exact++
  }
  const precision = tp + fp > 0 ? tp / (tp + fp) : 0
  const recall = tp + fn > 0 ? tp / (tp + fn) : 0
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0
  return { precision, recall, f1, exactMatch: exact / perReview.length, tp, fp, fn }
}

const baselineParent = multiLabelMetrics(
  (p) => [p.basePrimary, ...p.baseSecondary].map(childToParent).filter((x) => x !== 'unknown'),
  (p) => p.row.verifiedParents,
)
const improvedParent = multiLabelMetrics(
  (p) => [p.improved.primaryCategory, ...p.improved.secondaryCategories].map(childToParent),
  (p) => p.row.verifiedParents,
)
const baselineChild = multiLabelMetrics((p) => [p.basePrimary, ...p.baseSecondary], (p) => p.row.verifiedChildren)
const improvedChild = multiLabelMetrics((p) => [p.improved.primaryCategory, ...p.improved.secondaryCategories], (p) => p.row.verifiedChildren)

function sentimentMetrics(getSent: (p: PerReview) => string) {
  const labels = ['negative', 'mixed', 'positive']
  const matrix: Record<string, Record<string, number>> = {}
  let correct = 0
  for (const a of labels) { matrix[a] = {}; for (const b of labels) matrix[a][b] = 0 }
  for (const p of perReview) {
    const truth = p.row.verifiedSentiment.toLowerCase()
    const pred = getSent(p).toLowerCase()
    if (matrix[truth] && matrix[truth][pred] !== undefined) matrix[truth][pred]++
    if (truth === pred) correct++
  }
  return { agreement: correct / perReview.length, correct, incorrect: perReview.length - correct, matrix }
}

const baselineSent = sentimentMetrics((p) => p.baseSentiment)
const improvedSent = sentimentMetrics((p) => p.improved.sentiment)

function pct(x: number): string { return (x * 100).toFixed(1) + '%' }

console.log('\n=== 2. Side-by-side metrics (n=' + perReview.length + ' verified reviews) ===')
function show(name: string, b: MultiLabelMetrics, i: MultiLabelMetrics) {
  console.log(`\n${name}`)
  console.log(`  Precision    baseline ${pct(b.precision)}  →  improved ${pct(i.precision)}`)
  console.log(`  Recall       baseline ${pct(b.recall)}    →  improved ${pct(i.recall)}`)
  console.log(`  Micro F1     baseline ${pct(b.f1)}    →  improved ${pct(i.f1)}`)
  console.log(`  Exact match  baseline ${pct(b.exactMatch)}  →  improved ${pct(i.exactMatch)}  (baseline ${b.exactMatch * perReview.length}/${perReview.length}, improved ${i.exactMatch * perReview.length}/${perReview.length})`)
  console.log(`  TP/FP/FN     baseline ${b.tp}/${b.fp}/${b.fn}  →  improved ${i.tp}/${i.fp}/${i.fn}`)
}
show('Parent categories', baselineParent, improvedParent)
show('Child categories', baselineChild, improvedChild)

console.log('\nSentiment')
console.log(`  Agreement    baseline ${pct(baselineSent.agreement)} (${baselineSent.correct}/${perReview.length})  →  improved ${pct(improvedSent.agreement)} (${improvedSent.correct}/${perReview.length})`)
console.log('  Baseline confusion matrix (rows=verified, cols=predicted):')
console.log('               negative  mixed  positive')
for (const a of ['negative', 'mixed', 'positive']) {
  console.log(`    ${a.padEnd(10)} ${String(baselineSent.matrix[a].negative).padStart(5)}  ${String(baselineSent.matrix[a].mixed).padStart(5)}  ${String(baselineSent.matrix[a].positive).padStart(5)}`)
}
console.log('  Improved confusion matrix (rows=verified, cols=predicted):')
console.log('               negative  mixed  positive')
for (const a of ['negative', 'mixed', 'positive']) {
  console.log(`    ${a.padEnd(10)} ${String(improvedSent.matrix[a].negative).padStart(5)}  ${String(improvedSent.matrix[a].mixed).padStart(5)}  ${String(improvedSent.matrix[a].positive).padStart(5)}`)
}

// ---------------------------------------------------------------------------
// Step 5: Review-level error analysis
// ---------------------------------------------------------------------------
console.log('\n=== 3. Review-level changes ===')
type Dir = 'corrected' | 'regressed' | 'still-wrong' | 'still-right'
function bucket(p: PerReview, level: 'parent' | 'child' | 'sent'): Dir | 'n/a-changed' {
  const truthSet = level === 'sent' ? null : level === 'parent' ? new Set(p.row.verifiedParents) : new Set(p.row.verifiedChildren)
  const baseSet = level === 'sent' ? null : level === 'parent'
    ? new Set([p.basePrimary, ...p.baseSecondary].map(childToParent).filter((x) => x !== 'unknown'))
    : new Set([p.basePrimary, ...p.baseSecondary])
  const impSet = level === 'sent' ? null : level === 'parent'
    ? new Set([p.improved.primaryCategory, ...p.improved.secondaryCategories].map(childToParent))
    : new Set([p.improved.primaryCategory, ...p.improved.secondaryCategories])
  if (level === 'sent') {
    const t = p.row.verifiedSentiment.toLowerCase()
    const b = p.baseSentiment.toLowerCase() === t
    const i = p.improved.sentiment.toLowerCase() === t
    if (b && i) return 'still-right'
    if (b) return 'regressed'
    if (i) return 'corrected'
    return 'still-wrong'
  }
  const baseExact = baseSet!.size === truthSet!.size && [...baseSet!].every((x) => truthSet!.has(x))
  const impExact = impSet!.size === truthSet!.size && [...impSet!].every((x) => truthSet!.has(x))
  if (baseExact && impExact) return 'still-right'
  if (baseExact) return 'regressed'
  if (impExact) return 'corrected'
  return 'still-wrong'
}

for (const level of ['parent', 'child', 'sent'] as const) {
  const counts: Record<string, number> = { corrected: 0, regressed: 0, 'still-wrong': 0, 'still-right': 0 }
  for (const p of perReview) counts[bucket(p, level)]++
  console.log(`${level}: corrected ${counts.corrected}, regressed ${counts.regressed}, still-wrong ${counts['still-wrong']}, still-right ${counts['still-right']}`)
}

console.log('\nCorrections / regressions by review (parent sets, child sets, sentiment):')
for (const p of perReview) {
  const dP = bucket(p, 'parent')
  const dC = bucket(p, 'child')
  const dS = bucket(p, 'sent')
  if (dP === 'still-right' && dC === 'still-right' && dS === 'still-right') continue
  const id = p.row.reviewId.slice(0, 8)
  const lines: string[] = []
  if (dP !== 'still-right') lines.push(`parent ${dP}: truth=[${p.row.verifiedParents.join('|')}] baseline=[${[p.basePrimary, ...p.baseSecondary].map(childToParent).filter((x) => x !== 'unknown').join('|')}] improved=[${[p.improved.primaryCategory, ...p.improved.secondaryCategories].map(childToParent).join('|')}]`)
  if (dC !== 'still-right') lines.push(`child ${dC}: truth=[${p.row.verifiedChildren.join('|')}] baseline=[${[p.basePrimary, ...p.baseSecondary].join('|')}] improved=[${[p.improved.primaryCategory, ...p.improved.secondaryCategories].join('|')}]`)
  if (dS !== 'still-right') lines.push(`sentiment ${dS}: truth=${p.row.verifiedSentiment} baseline=${p.baseSentiment} improved=${p.improved.sentiment}`)
  console.log(`\n  ${id} (${dP === 'still-right' && dC === 'still-right' ? 'category ok, ' : ''}${dS === 'still-right' ? '' : 'sentiment changed'})`)
  for (const l of lines) console.log('    ' + l)
}

// False positives/negatives per category (child level, improved vs baseline)
console.log('\n=== 4. Per-category child-level FP/FN (improved vs baseline) ===')
const allChildIds = [...new Set(perReview.flatMap((p) => [p.improved.primaryCategory, ...p.improved.secondaryCategories, p.basePrimary, ...p.baseSecondary, ...p.row.verifiedChildren]))]
for (const cat of allChildIds) {
  let bFp = 0, bFn = 0, iFp = 0, iFn = 0
  for (const p of perReview) {
    const truth = new Set(p.row.verifiedChildren)
    const b = new Set([p.basePrimary, ...p.baseSecondary])
    const i = new Set([p.improved.primaryCategory, ...p.improved.secondaryCategories])
    if (b.has(cat) && !truth.has(cat)) bFp++
    if (!b.has(cat) && truth.has(cat)) bFn++
    if (i.has(cat) && !truth.has(cat)) iFp++
    if (!i.has(cat) && truth.has(cat)) iFn++
  }
  if (bFp || bFn || iFp || iFn) console.log(`  ${cat.padEnd(28)} baseline FP ${bFp} FN ${bFn}   →   improved FP ${iFp} FN ${iFn}`)
}

console.log('\nNOTE: The 37-review audit sample is enriched for difficult cases; these metrics are diagnostic only and are NOT representative performance estimates for all 500 reviews.')
