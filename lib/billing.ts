/**
 * Module 7 — BILLING & SUBSCRIPTIONS (now wired to real Stripe).
 * ------------------------------------------------------------------
 * PRD requirements (§M7 / §05 revenue):
 *  - 2 tiers: FREE (3 ops/day, 10MB cap, ads) | PRO ($9/mo, 1,000 ops/day,
 *    50MB cap, no ads, priority queue)
 *  - Stripe Checkout (POST /api/checkout) with signed cookie grant on success
 *  - Stripe Customer Portal (/account/billing redirect, handled below)
 *  - 24h "grace ops" after card fails; then auto-downgrade to FREE
 *
 * Identity: email-only (no DB). A signed httpOnly cookie tf_pro_user holds
 * the plan claim; we cross-check against live Stripe subscription state
 * when the cookie is close to expiry (so cancellations propagate).
 * ------------------------------------------------------------------ */

import { cookies } from "next/headers";
import Stripe from "stripe";
import type { PlanTier } from "@/lib/auth";
import {
  getStripe,
  getStripePriceId,
  PRO_COOKIE_NAME,
  PRO_COOKIE_MAX_AGE_S,
  signClaim,
  verifyClaim,
  type ProUserClaim,
} from "@/lib/stripe";

export interface ProPlanFeature {
  key: string;
  label: string;
  free: string | boolean;
  pro: string | boolean;
  highlight?: boolean;
}

export const PRO_PRICE_MONTHLY_USD = 9;

export const PRO_FEATURE_MATRIX: ProPlanFeature[] = [
  { key: "ops", label: "Operations per day", free: "3", pro: "1,000", highlight: true },
  { key: "upload", label: "File upload size cap", free: "10 MB", pro: "50 MB", highlight: true },
  { key: "queue", label: "Processing priority", free: "Standard queue", pro: "Priority queue" },
  { key: "ads", label: "Advertising", free: true, pro: false },
  { key: "saved", label: "Saved results (within TTL)", free: "0", pro: "Unlimited" },
  { key: "batch", label: "Batch / multi-file tools", free: "First file only", pro: "Full batch" },
];

// ---- URL builders ---------------------------------------------------------

/**
 * Create a Stripe Checkout Session URL. Used by client-side Upgrade buttons.
 * Prefer POST /api/checkout instead — it returns session.url after validation.
 */
export async function createCheckoutSessionUrl(
  userIdEmail: string,
  returnUrl: string
): Promise<string> {
  const stripe = getStripe();
  const priceId = getStripePriceId();
  const sess = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer_email: userIdEmail,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: returnUrl,
    cancel_url: new URL("/pricing?canceled=1", returnUrl).toString(),
  });
  return sess.url ?? "/pricing?error=checkout-failed";
}

/**
 * Return a URL to the Stripe Billing Customer Portal for the given email.
 * We look up the customer by email first. If none found, send them to /account
 * with an error message.
 */
export async function createBillingPortalUrl(
  userIdEmail: string,
  returnUrl: string
): Promise<string> {
  const stripe = getStripe();
  const customers = await stripe.customers.list({
    email: userIdEmail,
    limit: 1,
  });
  const customer = customers.data[0];
  if (!customer) return "/account?error=no-billing";
  const portal = await stripe.billingPortal.sessions.create({
    customer: customer.id,
    return_url: returnUrl,
  });
  return portal.url;
}

// ---- Plan resolution ------------------------------------------------------

/**
 * Find the user's plan from (1) the signed cookie, optionally refreshed
 * against Stripe API when near expiry. Free tier on any failure.
 *
 * userId parameter is an email string (SessionUser.id / email from auth).
 * If no cookie, we attempt a Stripe lookup by email so cancellations
 * propagate even when the user never visits the success page again.
 */
export async function resolvePlan(userIdEmail?: string | null): Promise<PlanTier> {
  try {
    const ckStore = await cookies();
    const raw = ckStore.get(PRO_COOKIE_NAME)?.value;
    const claim = raw ? await verifyClaim(raw) : null;

    if (claim) {
      // Cookie valid and not expired.
      const now = Date.now() / 1000;
      // If less than 48h of validity remain, do a live Stripe check so
      // cancellations / renewals update the cookie.
      const closeToExpiry = claim.exp - now < 48 * 60 * 60;
      const email = userIdEmail || claim.email;
      if (closeToExpiry && email) {
        const live = await resolvePlanFromStripe(email);
        if (live.plan !== claim.plan || Math.abs((live.exp ?? 0) - claim.exp) > 60) {
          // Refresh cookie with live values.
          const signed = await signClaim(live);
          try {
            ckStore.set(PRO_COOKIE_NAME, signed, {
              httpOnly: true,
              secure: process.env.NODE_ENV === "production",
              sameSite: "lax",
              path: "/",
              maxAge: PRO_COOKIE_MAX_AGE_S,
            });
          } catch {
            /* cookies() headers already sent; ignore */
          }
          return live.plan;
        }
      }
      return claim.plan;
    }

    // No cookie, but we have an email. Try Stripe live lookup so a re-login
    // still grants Pro even if the cookie was deleted.
    if (userIdEmail) {
      const live = await resolvePlanFromStripe(userIdEmail);
      if (live.plan === "pro") {
        const signed = await signClaim(live);
        try {
          ckStore.set(PRO_COOKIE_NAME, signed, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
            maxAge: PRO_COOKIE_MAX_AGE_S,
          });
        } catch {
          /* ignore */
        }
      }
      return live.plan;
    }
    return "free";
  } catch {
    return "free";
  }
}

async function resolvePlanFromStripe(email: string): Promise<ProUserClaim> {
  const stripe = getStripe();
  const result: ProUserClaim = {
    email,
    plan: "free",
    exp: Math.floor(Date.now() / 1000) + 60 * 60, // 1h free marker
  };

  try {
    const customers = await stripe.customers.list({ email, limit: 3 });
    for (const customer of customers.data) {
      const subs = await stripe.subscriptions.list({
        customer: customer.id,
        limit: 5,
        expand: ["data.plan"],
      });
      for (const sub of subs.data) {
        const priceId = getStripePriceId();
        const matchesPro = sub.items.data.some(
          (it) =>
            (typeof it.plan === "object" && it.plan && it.plan.id === priceId) ||
            (typeof it.price === "object" && it.price && it.price.id === priceId)
        );
        if (!matchesPro) continue;

        const now = Math.floor(Date.now() / 1000);
        const graceUntil = now + 24 * 60 * 60;

        if (sub.status === "active" || sub.status === "trialing") {
          result.plan = "pro";
          result.periodEnd = sub.current_period_end;
          result.exp = sub.current_period_end;
          return result;
        }
        if (sub.status === "past_due" || sub.status === "unpaid") {
          result.plan = "pro";
          result.periodEnd = Math.min(sub.current_period_end, graceUntil);
          result.exp = Math.min(sub.current_period_end ?? graceUntil, graceUntil);
          return result;
        }
        if (sub.status === "canceled" || sub.status === "incomplete_expired") {
          // Stay free but remember the period end.
          result.periodEnd = sub.current_period_end ?? undefined;
        }
      }
    }
  } catch {
    /* fall through to free */
  }
  return result;
}

// ---- Webhook handler (slot file, called by /api/webhooks/stripe) ----------

export async function handleStripeWebhook(
  payload: Buffer | string,
  signature: string
): Promise<Stripe.Event> {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET ?? "";
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET env var is not set");
  const body = typeof payload === "string" ? payload : payload.toString("utf-8");
  const event = stripe.webhooks.constructEvent(body, signature, secret);
  switch (event.type) {
    case "checkout.session.completed":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
    case "invoice.payment_failed":
      console.log(`[billing] stripe event received: ${event.type}`);
      break;
    default:
      break;
  }
  return event;
}
