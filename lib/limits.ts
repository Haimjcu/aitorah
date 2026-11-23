// Usage limits per plan. `null` means unlimited.
// Every limit is enforced in code today, so turning one on later is a config change here, not a code change.
// Owner decision (2026-11-23): no limits for now — every value is null.

export type PlanId = 'free' | 'supporter' | 'admin'

export interface PlanLimits {
  maxProjects: number | null
  maxFilesPerProject: number | null
  maxFileSizeBytes: number | null
  maxMessagesPerDay: number | null
  maxMemoriesPerProject: number | null
}

const UNLIMITED: PlanLimits = {
  maxProjects: null,
  maxFilesPerProject: null,
  maxFileSizeBytes: null,
  maxMessagesPerDay: null,
  maxMemoriesPerProject: null,
}

export const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  free: { ...UNLIMITED },
  supporter: { ...UNLIMITED },
  admin: { ...UNLIMITED },
}

/** Hard technical ceilings that apply regardless of plan (API/storage constraints, not business limits). */
export const TECHNICAL_LIMITS = {
  maxFileSizeBytes: 30 * 1024 * 1024, // stays under the 32 MB Claude request limit
  allowedMimeTypes: [
    'image/png', 'image/jpeg', 'image/webp', 'image/gif',
    'application/pdf', 'text/plain', 'text/markdown',
  ],
} as const

export function getLimits(plan: string | null | undefined): PlanLimits {
  return PLAN_LIMITS[(plan as PlanId)] ?? PLAN_LIMITS.free
}

export type LimitKey = keyof PlanLimits

export interface LimitCheck {
  allowed: boolean
  limit: number | null
  current: number
}

/** `current` is the count/size the action would produce (e.g. projects after creating one more). */
export function checkLimit(plan: string | null | undefined, key: LimitKey, current: number): LimitCheck {
  const limit = getLimits(plan)[key]
  return { allowed: limit === null || current <= limit, limit, current }
}
