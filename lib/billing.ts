/**
 * Module 7 — BILLING & SUBSCRIPTIONS SLOT
 * ------------------------------------------------------------------
 * PRD requirements (§M7 / §05 revenue):
 *  - 2 tiers: FREE (3 ops/day, 10MB cap, ads) | PRO ($9/mo, 1,000 ops/day,
 *    50MB cap, no ads, priority queue)
 *  - Stripe Checkout + webhook handler (/api/webhooks/stripe)
 *  - Stripe Customer Portal (/account/billing redirect)
 *  - 5% gross to LLM provider cost bucket + 8% target gross margin
 *  - 24h "grace ops" after card fails; then auto-downgrade to FREE
 *
 * Current state: typed stubs; plug Stripe SDK inside each function.
 * ------------------------------------------------------------------ */

import type { PlanTier } from "@/lib/auth";

export interface ProPlanFeature {
  key: string;
  label: string;
  free: string | boolean;
  pro: string | boolean;
  highlight?: boolean;
}

/**
 * Master source of truth for pricing page.
 * PRD §05: Pro $9/mo → 1000 ops/day, 50MB upload, no ads, priority queue.
 */
export const PRO_PRICE_MONTHLY_USD = 9;

export const PRO_FEATURE_MATRIX: ProPlanFeature[] = [
  { key: "ops", label: "Operations per day", free: "3", pro: "1,000", highlight: true },
  { key: "upload", label: "File upload size cap", free: "10 MB", pro: "50 MB", highlight: true },
  { key: "queue", label: "Processing priority", free: "Standard queue", pro: "Priority queue" },
  { key: "ads", label: "Advertising", free: true, pro: false },
  { key: "saved", label: "Saved results (within TTL)", free: "0", pro: "Unlimited" },
  { key: "batch", label: "Batch / multi-file tools", free: "First file only", pro: "Full batch" },
];

/**
 * Generate a Stripe Checkout Session URL when user clicks "Upgrade to Pro".
 * Post-MVP: stripe.checkout.sessions.create({ mode: 'subscription', ... })
 */
export async function createCheckoutSessionUrl(_userId: string, _returnUrl: string): Promise<string> {
  // TODO (M7): wire STRIPE_SECRET_KEY + priceId from env; return session.url.
  return "#pricing-stub";
}

/**
 * Generate a Stripe Billing Customer Portal URL for /account/billing.
 */
export async function createBillingPortalUrl(_userId: string, _returnUrl: string): Promise<string> {
  // TODO (M7): stripe.billingPortal.sessions.create({ customer, return_url })
  return "#billing-portal-stub";
}

/**
 * Verify the running plan from local usage + Stripe subscription status.
 * Called every API route; add a 60s in-memory/Redis cache.
 */
export async function resolvePlan(_userId: string): Promise<PlanTier> {
  // TODO (M7): JOIN subscriptions table (user_id → stripe_sub_id → status).
  return "free";
}

/**
 * Stripe webhook dispatch — slot file.
 * Post-MVP: /api/webhooks/stripe route calls this.
 * Handles: customer.subscription.updated / deleted / customer.subscription.trial_will_end
 *          invoice.payment_failed (→ 24h grace) / invoice.paid
 */
export async function handleStripeWebhook(_payload: Buffer, _signature: string): Promise<void> {
  // TODO (M7): stripe.webhooks.constructEvent → switch(event.type)
  return Promise.resolve();
}
