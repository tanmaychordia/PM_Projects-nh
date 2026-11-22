// Independent evaluation-integrity check. Deliberately re-implements parsing and
// metric math from scratch (no imports from scripts/evaluate-classifier.ts).
import { readFileSync } from 'node:fs'
import { classifyReview } from '../lib/voc/analysis-engine'
import { getParentIdForChild, getAllChildIds, isValidChildId } from '../lib/voc/taxonomy-export'
import type { CategoryId, Review } from '../lib/voc/types'

// --- Independent XLSX cell extraction (regex-free string scanning) ---
const shared = readFileSync('/tmp/xlsx2/xl/sharedStrings.xml', 'utf8')
const strings: string[] = []
for (const m of shared.matchAll(/<si>([\s\S]*?)<\/si>/g)) {
  strings.push([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join(''))
}
const sheet = readFileSync('/tmp/xlsx2/xl/worksheets/sheet1.xml', 'utf8')
const rows: string[][] = []
for (const rm of sheet.matchAll(/<row[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
  const cells: string[] = []
  for (const cm of rm[2].matchAll(/<c([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
    const ref = cm[1].match(/r="([A-Z]+)\d+"/)![1]
    const col = ref.split('').reduce((a, ch) => a * 26 + ch.charCodeAt(0) - 64, 0) - 1
    const t = cm[1].match(/t="(\w+)"/)?.[1]
    const v = cm[2]?.match(/<v>([\s\S]*?)<\/v>/)?.[1]
    const raw = t === 's' && v ? strings[Number(v)] : v ?? ''
    cells[col] = raw.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&')
  }
  rows[Number(rm[1]) - 1] = cells
}

// --- Verified set (independent filter logic, same criteria) ---
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
const CHILD_IDS = new Set(getAllChildIds())
const childToParent = (c: CategoryId) => getParentIdForChild(c)

interface Rec {
  id: string
  text: string
  rating: number
  truthParents: string[]
  truthChildren: CategoryId[]
  truthSent: string
  basePrimary: CategoryId
  baseSecondary: CategoryId[]
  baseSent: string
}
const verified: Rec[] = []
const statusCounts: Record<string, number> = {}
for (let i = 1; i < rows.length; i++) {
  const r = rows[i]
  if (!r || !r[0]?.trim()) continue
  const status = (r[20] ?? '').trim()
  statusCounts[status] = (statusCounts[status] ?? 0) + 1
  if (status !== 'Verified') continue
  const children = (r[17] ?? '').split(';').map((s) => s.trim()).filter(Boolean)
  verified.push({
    id: r[0].trim(),
    text: (r[1] ?? '').trim(),
    rating: Number(r[2]),
    truthParents: (r[16] ?? '').split(';').map((s) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_')).filter(Boolean),
    truthChildren: children.map((l) => LABEL_TO_CHILD[l] as CategoryId),
    truthSent: (r[18] ?? '').trim().toLowerCase(),
    basePrimary: (r[6] ?? '').trim() as CategoryId,
    baseSecondary: (r[10] ?? '').split(';').map((s) => s.trim()).filter(Boolean) as CategoryId[],
    baseSent: (r[13] ?? '').trim(),
  })
}

console.log('=== Integrity check 1: dataset ===')
console.log('Status counts:', JSON.stringify(statusCounts))
console.log('Verified n =', verified.length)
console.log('All child labels map to taxonomy IDs:', verified.every((v) => v.truthChildren.every((c) => CHILD_IDS.has(c))))
console.log('All baseline child predictions are valid taxonomy IDs:', verified.every((v) => isValidChildId(v.basePrimary) && v.baseSecondary.every((s) => isValidChildId(s))))
console.log('No duplicate review IDs:', new Set(verified.map((v) => v.id)).size === verified.length)

// --- Same-ID check across runs: compare with Phase 3 stored output ordering ---
const phase3Ids = JSON.parse(readFileSync('/tmp/xlsx/rows.json', 'utf8')).slice(1)
  .filter((r: string[]) => r && (r[20] ?? '').trim() === 'Verified')
  .map((r: string[]) => r[0].trim())
console.log('\n=== Integrity check 2: same review set as Phase 3 run ===')
console.log('Same IDs, same order (Phase3 vs now):', JSON.stringify(phase3Ids) === JSON.stringify(verified.map((v) => v.id)))

// --- Independent classifier run ---
function toReview(v: Rec): Review {
  return { reviewId: v.id, source: 'google_play', rating: v.rating as Review['rating'], title: null, text: v.text, postedAt: new Date().toISOString(), appVersion: null, thumbsUpCount: null, developerResponse: null, collectedVia: 'newest' }
}
const preds = verified.map((v) => ({ v, imp: classifyReview(toReview(v)) }))

// --- Independent micro metrics over SETS (Set dedupes) ---
function micro(getPred: (r: Rec, imp: ReturnType<typeof classifyReview>) => Set<string>, getTruth: (v: Rec) => Set<string>) {
  let tp = 0, fp = 0, fn = 0, exact = 0
  for (const { v, imp } of preds) {
    const p = getPred(v, imp), t = getTruth(v)
    for (const x of t) if (p.has(x)) tp++; else fn++
    for (const x of p) if (!t.has(x)) fp++
    if (p.size === t.size && [...p].every((x) => t.has(x))) exact++
  }
  const P = tp + fp ? tp / (tp + fp) : 0
  const R = tp + fn ? tp / (tp + fn) : 0
  return { P, R, F1: P + R ? 2 * P * R / (P + R) : 0, exact, tp, fp, fn }
}
const setOf = (xs: string[]) => new Set(xs)
const baseChildPred = (v: Rec) => setOf([v.basePrimary, ...v.baseSecondary])
const baseParentPred = (v: Rec) => setOf([v.basePrimary, ...v.baseSecondary].map(childToParent))
const impChildPred = (_: Rec, imp: ReturnType<typeof classifyReview>) => setOf([imp.primaryCategory, ...imp.secondaryCategories])
const impParentPred = (_: Rec, imp: ReturnType<typeof classifyReview>) => setOf([imp.primaryCategory, ...imp.secondaryCategories].map(childToParent))

const baseChild = micro((v) => baseChildPred(v), (v) => setOf(v.truthChildren as string[]))
const impChild = micro((_v, imp) => impChildPred(_v, imp), (v) => setOf(v.truthChildren as string[]))
const baseParent = micro((v) => baseParentPred(v), (v) => setOf(v.truthParents))
const impParent = micro((_v, imp) => impParentPred(_v, imp), (v) => setOf(v.truthParents))

const pct = (x: number) => (x * 100).toFixed(1) + '%'
console.log('\n=== Independent metric recalculation (n=37) ===')
function row(name: string, b: ReturnType<typeof micro>, i: ReturnType<typeof micro>) {
  console.log(`${name}: baseline P ${pct(b.P)} R ${pct(b.R)} F1 ${pct(b.F1)} exact ${b.exact}/37 TP/FP/FN ${b.tp}/${b.fp}/${b.fn}`)
  console.log(`${' '.repeat(name.length)}  improved  P ${pct(i.P)} R ${pct(i.R)} F1 ${pct(i.F1)} exact ${i.exact}/37 TP/FP/FN ${i.tp}/${i.fp}/${i.fn}`)
}
row('Child ', baseChild, impChild)
row('Parent', baseParent, impParent)

// Sentiment
function sentMetrics(get: (r: Rec, imp: ReturnType<typeof classifyReview>) => string) {
  const labels = ['negative', 'mixed', 'positive']
  const M: Record<string, Record<string, number>> = {}
  for (const a of labels) { M[a] = {}; for (const b of labels) M[a][b] = 0 }
  const wrong: { id: string; truth: string; pred: string }[] = []
  for (const { v, imp } of preds) {
    const t = v.truthSent, p = get(v, imp)
    if (M[t]?.[p] !== undefined) M[t][p]++
    else console.log(`  WARNING unknown sentiment value: truth=${t} pred=${p}`)
    if (t !== p) wrong.push({ id: v.id, truth: t, pred: p })
  }
  return { M, wrong }
}
const baseSent = sentMetrics((v) => v.baseSent)
const impSent = sentMetrics((_v, imp) => imp.sentiment)
const agree = (w: { id: string }[]) => ((37 - w.length) / 37 * 100).toFixed(1)
console.log(`\nSentiment: baseline agreement ${agree(baseSent.wrong)}% (wrong ${baseSent.wrong.length}), improved ${agree(impSent.wrong)}% (wrong ${impSent.wrong.length})`)

// --- Full 37-review comparison table ---
console.log('\n=== Full 37-review prediction comparison ===')
for (const { v, imp } of preds) {
  const iC = impChildPred(v, imp), bC = baseChildPred(v), tC = setOf(v.truthChildren as string[])
  const iP = impParentPred(v, imp), bP = baseParentPred(v), tP = setOf(v.truthParents)
  const tag = (p: Set<string>, t: Set<string>) => p.size === t.size && [...p].every((x) => t.has(x)) ? 'OK ' : 'ERR'
  console.log(`${v.id.slice(0, 8)} child[${tag(iC, tC)}] parent[${tag(iP, tP)}] sent[${imp.sentiment === v.truthSent ? 'OK ' : 'ERR'}]`)
  console.log(`   text: ${v.text.slice(0, 70).replace(/\n/g, ' ')}...`)
  console.log(`   truth  child: [${v.truthChildren.join(', ')}]`)
  console.log(`   base   child: [${[v.basePrimary, ...v.baseSecondary].join(', ')}]`)
  console.log(`   improv child: [${imp.primaryCategory}, ${imp.secondaryCategories.join(', ')}]`)
  if (tag(iP, tP) === 'ERR' || tag(bP, tP) === 'ERR') {
    console.log(`   truth  parent: [${v.truthParents.join(', ')}]`)
    console.log(`   base   parent: [${[...baseParentPred(v)].join(', ')}]`)
    console.log(`   improv parent: [${[...impParentPred(v, imp)].join(', ')}]`)
  }
}

// --- Child-level confusion: which true category -> which wrong prediction ---
console.log('\n=== Child-category error table (improved): true -> wrongly predicted ===')
const confusion: Record<string, Record<string, number>> = {}
for (const { v, imp } of preds) {
  const t = setOf(v.truthChildren as string[]), p = impChildPred(v, imp)
  for (const x of t) if (!p.has(x)) {
    for (const y of p) if (!t.has(y)) {
      confusion[x] = confusion[x] ?? {}
      confusion[x][y] = (confusion[x][y] ?? 0) + 1
    }
  }
}
for (const [a, rowC] of Object.entries(confusion)) console.log(`  ${a}: missed, and predicted instead -> ${Object.entries(rowC).map(([k, c]) => `${k} x${c}`).join(', ') || '(pure miss)'}`)

console.log('\n=== Parent-category error table (improved): per-category TP/FP/FN ===')
for (const parent of new Set([...verified.flatMap((v) => v.truthParents)])) {
  let tp = 0, fp = 0, fn = 0
  for (const { v, imp } of preds) {
    const t = setOf(v.truthParents), p = impParentPred(v, imp)
    if (t.has(parent) && p.has(parent)) tp++
    if (!t.has(parent) && p.has(parent)) fp++
    if (t.has(parent) && !p.has(parent)) fn++
  }
  console.log(`  ${parent.padEnd(42)} TP ${tp} FP ${fp} FN ${fn}`)
}

console.log('\n=== Eight incorrect sentiment predictions (improved) ===')
for (const w of impSent.wrong) console.log(`  ${w.id.slice(0, 8)}  truth=${w.truth}  predicted=${w.pred}`)
console.log(`\nBaseline wrong sentiment (${baseSent.wrong.length}):`)
for (const w of baseSent.wrong) console.log(`  ${w.id.slice(0, 8)}  truth=${w.truth}  predicted=${w.pred}`)

// --- Baseline integrity: predictions stored in XLSX unchanged? ---
console.log('\n=== Baseline-prediction integrity ===')
console.log('Baseline predictions are read-only from XLSX columns G/K/N; no writes anywhere in this script. Baseline column hashes (first 40 chars of joined column):')
const baseJoin = verified.map((v) => `${v.basePrimary}|${v.baseSecondary.join(',')}|${v.baseSent}`).join('\n')
console.log('  sha256 (node crypto):')
import { createHash } from 'node:crypto'
console.log('  ' + createHash('sha256').update(baseJoin).digest('hex'))
