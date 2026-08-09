/**
 * SHARED: Usage limit constants (enforced in tool execution engine
 * API routes + shown on pricing page).
 *
 * Kept separate from billing.ts so processors and API handlers can
 * import just the numbers without pulling in Stripe.
 * ------------------------------------------------------------------ */

export const FREE_TIER = {
  dailyOps: 3,
  maxUploadMB: 10,
  priority: "standard" as const,
  showAds: true,
  batchFiles: 1,
} as const;

export const PRO_TIER = {
  dailyOps: 1_000,
  maxUploadMB: 50,
  priority: "priority" as const,
  showAds: false,
  batchFiles: Infinity,
} as const;

/** 24 hour grace period after payment failure before plan downgrade. */
export const PRO_GRACE_PERIOD_HOURS = 24;

/** Saved file TTL: both free and pro users get 7 days from last access. */
export const SAVED_FILE_TTL_DAYS = 7;

export function limitsForPlan(plan: "free" | "pro") {
  return plan === "pro" ? PRO_TIER : FREE_TIER;
}
