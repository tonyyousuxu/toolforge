/**
 * Module 6 — AUTHENTICATION SLOT
 * ------------------------------------------------------------------
 * PRD requirements (§M6):
 *  - Google + GitHub OAuth (NextAuth)
 *  - Email/password fallback (bcrypt hashed in PostgreSQL users table)
 *  - 30d httpOnly JWT cookie; refresh flow
 *  - Anonymous UUID cookie → merged on account creation
 *  - Account deletion = immediate GDPR/CCPA DB wipe
 *
 * Current state: typed stubs that throw "Not yet wired" so call sites
 * can be written now and hooked up post-MVP without rework.
 * ------------------------------------------------------------------ */

export type PlanTier = "free" | "pro";

export interface SessionUser {
  id: string;
  email?: string;
  name?: string;
  plan: PlanTier;
  dailyOpsRemaining: number;
  dailyOpsUsed: number;
  anonymousId?: string;
  isAdmin?: boolean;
}

/**
 * In site-header / tool widget / API routes call getSession(req).
 * Post-MVP: wraps NextAuth.getServerSession() + cookie helpers.
 */
export async function getSession(
  _requestLike?: unknown,
): Promise<SessionUser | null> {
  // Post-MVP: decode httpOnly JWT + fetch plan from users table.
  return null;
}

/**
 * Enforce FREE tier daily limit (3 ops/day) in API handlers.
 * Post-MVP: look up today's row in usage_events table (user_id + date key).
 */
export async function consumeDailyOp(
  _user: SessionUser,
  _toolSlug: string,
): Promise<{ allowed: boolean; remaining: number; reason?: string }> {
  // Post-MVP: transactional increment in DB, reject on limit.
  return { allowed: true, remaining: 9999, reason: "auth not wired — unlimited" };
}

/**
 * Anonymous UUID cookie: prevent "logout resets limit" fraud.
 * Post-MVP: cookies().get/set in NextAuth events.mergeUser().
 */
export function ensureAnonymousId(): string {
  // TODO (M6): stable crypto random v4; persisted 365d httpOnly cookie.
  const fallback = `anon-${Math.random().toString(36).slice(2, 10)}`;
  return fallback;
}
