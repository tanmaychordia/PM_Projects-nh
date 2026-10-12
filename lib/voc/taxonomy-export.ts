import type { CategoryId, ParentCategoryId, TaxonomyChildDefinition, TaxonomyExport, TaxonomyParentDefinition } from './types'

export const TAXONOMY_VERSION = '2026-10-12-v1'
export const PROMPT_VERSION = 'audit-v1'

const PARENTS: TaxonomyParentDefinition[] = [
  {
    id: 'app_digital_experience',
    label: 'App & digital experience',
    description: 'App crashes, performance, login/authentication, updates, and usability issues.',
  },
  {
    id: 'service_delivery_professional_conduct',
    label: 'Service delivery & professional conduct',
    description: 'Late arrival, no-show, cancellation, incomplete work, poor cleaning quality, unprofessional conduct, trust, safety, and property concerns.',
  },
  {
    id: 'payments_pricing_refunds',
    label: 'Payments, pricing & refunds',
    description: 'Failed transactions, incorrect charges, missing credits, wallet balance problems, and refund delays.',
  },
  {
    id: 'customer_support_resolution',
    label: 'Customer support & resolution',
    description: 'Unreachable support, unresolved complaints, delayed responses, and poor escalation.',
  },
  {
    id: 'availability_coverage_scheduling',
    label: 'Availability, coverage & scheduling',
    description: 'No slots available, booking failures, incorrect availability, and scheduling problems.',
  },
]

const CHILDREN: TaxonomyChildDefinition[] = [
  {
    id: 'app_functionality',
    label: 'App functionality & performance',
    description: 'Crashes, freezes, slow loading, navigation failures, and broken app features.',
    inclusionCriteria: ['Mentions crashes, freezes, hangs, or force closes', 'Describes slow loading or lag', 'Reports broken features or errors'],
    exclusionCriteria: ['Late arrival of service professional', 'Missing belongings or theft', 'Payment or refund issues without app context'],
    parent: 'app_digital_experience',
  },
  {
    id: 'account_access',
    label: 'Account access & authentication',
    description: 'Login failures, OTP delivery problems, or inability to access an account.',
    inclusionCriteria: ['Cannot log in or sign in', 'OTP not received', 'Password or authentication failures'],
    exclusionCriteria: ['Payment issues without login context', 'Booking problems without login context'],
    parent: 'app_digital_experience',
  },
  {
    id: 'updates_compatibility',
    label: 'Updates & compatibility',
    description: 'Regressions after updates, version incompatibility, or features broken by a release.',
    inclusionCriteria: ['Features broke after an update', 'Version incompatibility', 'Regression after new release'],
    exclusionCriteria: ['Pre-existing bugs unrelated to updates', 'Login or payment issues not caused by updates'],
    parent: 'app_digital_experience',
  },
  {
    id: 'service_delivery',
    label: 'Service delivery & reliability',
    description: 'Late arrival, no-show, cancellation, incomplete work, poor cleaning quality, or unprofessional conduct.',
    inclusionCriteria: ['Professional arrived late or did not show', 'Cancellation or incomplete work', 'Poor cleaning quality', 'Rude or unprofessional behavior'],
    exclusionCriteria: ['App crashes or performance issues', 'Payment or refund problems', 'Missing belongings (classify as trust/safety)'],
    parent: 'service_delivery_professional_conduct',
  },
  {
    id: 'trust_safety_property',
    label: 'Trust, safety & property',
    description: 'Missing belongings, alleged theft, unsafe conduct, OTP privacy concerns, or incident handling.',
    inclusionCriteria: ['Missing or stolen belongings', 'Alleged theft by service professional', 'Safety or security concerns', 'OTP privacy concerns'],
    exclusionCriteria: ['App data loss or sync issues', 'Payment disputes without property context'],
    parent: 'service_delivery_professional_conduct',
  },
  {
    id: 'payments_credits_refunds',
    label: 'Payments, credits & refunds',
    description: 'Failed transactions, incorrect charges, missing credits, wallet balance problems, or refund delays.',
    inclusionCriteria: ['Payment failure or incorrect charge', 'Refund not processed or delayed', 'Wallet balance discrepancy', 'Money deducted without service'],
    exclusionCriteria: ['Login failures', 'Booking availability issues', 'Stolen money (classify as trust/safety)'],
    parent: 'payments_pricing_refunds',
  },
  {
    id: 'customer_support',
    label: 'Customer support & complaint resolution',
    description: 'Unreachable support, unresolved complaints, delayed responses, or poor escalation.',
    inclusionCriteria: ['Cannot reach support', 'Complaint unresolved', 'Delayed response from support', 'Poor escalation'],
    exclusionCriteria: ['App crashes', 'Login or booking issues without support context'],
    parent: 'customer_support_resolution',
  },
  {
    id: 'booking_availability',
    label: 'Booking & availability',
    description: 'No slots available, booking failures, incorrect availability, or booking confirmation problems.',
    inclusionCriteria: ['No slots available or sold out', 'Booking failed', 'Incorrect availability shown', 'Cannot schedule service'],
    exclusionCriteria: ['Payment failures without booking context', 'App crashes during booking (classify as app functionality)'],
    parent: 'availability_coverage_scheduling',
  },
  {
    id: 'positive_experience',
    label: 'Positive experiences',
    description: 'Explicit praise for service quality, punctuality, helpful professionals, support, or app usability.',
    inclusionCriteria: ['Praises service quality', 'Compliments punctuality or professionalism', 'App usability praise', 'Recommendation'],
    exclusionCriteria: ['Contains complaints that are the primary message', 'Mixed reviews where negatives dominate'],
    parent: 'app_digital_experience',
  },
  {
    id: 'other_unclear',
    label: 'Other / unclear',
    description: 'Feedback that cannot be reliably assigned to a more specific category.',
    inclusionCriteria: ['Insufficient detail to classify', 'Feedback outside the taxonomy scope'],
    exclusionCriteria: ['Any review that matches a specific category with sufficient evidence'],
    parent: 'app_digital_experience',
  },
]

const MAPPING: { existingId: CategoryId; parentId: ParentCategoryId; note: string }[] = [
  { existingId: 'app_functionality', parentId: 'app_digital_experience', note: 'Direct mapping' },
  { existingId: 'account_access', parentId: 'app_digital_experience', note: 'Direct mapping' },
  { existingId: 'updates_compatibility', parentId: 'app_digital_experience', note: 'Direct mapping' },
  { existingId: 'service_delivery', parentId: 'service_delivery_professional_conduct', note: 'Direct mapping' },
  { existingId: 'trust_safety_property', parentId: 'service_delivery_professional_conduct', note: 'Direct mapping' },
  { existingId: 'payments_credits_refunds', parentId: 'payments_pricing_refunds', note: 'Direct mapping' },
  { existingId: 'customer_support', parentId: 'customer_support_resolution', note: 'Direct mapping' },
  { existingId: 'booking_availability', parentId: 'availability_coverage_scheduling', note: 'Direct mapping' },
  { existingId: 'positive_experience', parentId: 'app_digital_experience', note: 'Positive feedback spans all areas; grouped under app/digital for convenience' },
  { existingId: 'other_unclear', parentId: 'app_digital_experience', note: 'Fallback; no true parent' },
]

export function buildTaxonomyExport(): TaxonomyExport {
  return {
    version: TAXONOMY_VERSION,
    generatedAt: new Date().toISOString(),
    parents: PARENTS,
    children: CHILDREN,
    mappingFromExistingLabels: MAPPING,
  }
}

export function getParentIdForChild(childId: CategoryId): ParentCategoryId {
  const child = CHILDREN.find((c) => c.id === childId)
  if (!child) return 'app_digital_experience'
  return child.parent
}

export function getAllParentIds(): ParentCategoryId[] {
  return PARENTS.map((p) => p.id)
}

export function getAllChildIds(): CategoryId[] {
  return CHILDREN.map((c) => c.id)
}

export function isValidChildId(id: string): id is CategoryId {
  return CHILDREN.some((c) => c.id === id)
}

export function isValidParentId(id: string): id is ParentCategoryId {
  return PARENTS.some((p) => p.id === id)
}
