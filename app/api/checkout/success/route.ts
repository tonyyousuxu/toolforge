import { NextResponse, NextRequest } from "next/server";
import { cookies } from "next/headers";
import Stripe from "stripe";
import {
  getStripe,
  signClaim,
  PRO_COOKIE_NAME,
  PRO_COOKIE_MAX_AGE_S,
  type ProUserClaim,
} from "@/lib/stripe";

export const runtime = "nodejs";

/**
 * GET /api/checkout/success?session_id=cs_test_...
 *
 * Stripe redirects the user here after a successful Checkout payment
 * (we set session_id placeholder in the success_url).
 *
 * We:
 *   1. Verify the Checkout.Session with Stripe (status === 'complete',
 *      payment_status === 'paid').
 *   2. Retrieve the associated subscription to read current_period_end
 *      (this is when the cookie expires).
 *   3. Write the signed httpOnly cookie: tf_pro_user
 *   4. 302 redirect to /pricing?success=1
 */
export async function GET(req: NextRequest): Promise<Response> {
  const url = new URL(req.url);
  const sessionId = url.searchParams.get("session_id");
  const host = req.headers.get("host") ?? "";
  const proto =
    req.headers.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");
  const base = `${proto}://${host}`;

  if (!sessionId) {
    return NextResponse.redirect(new URL("/pricing?error=no-session", base));
  }

  try {
    const stripe = getStripe();

    // Expand so we get .subscription with its current_period_end inline.
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription", "customer"],
    });

    if (session.status !== "complete") {
      return NextResponse.redirect(new URL("/pricing?error=unpaid", base));
    }

    const email =
      (typeof session.customer_details === "object" && session.customer_details
        ? session.customer_details.email
        : undefined) ||
      (typeof session.customer === "object" && session.customer && "email" in session.customer
        ? (session.customer as { email?: string | null }).email ?? undefined
        : undefined) ||
      session.customer_email ||
      undefined;

    if (!email) {
      return NextResponse.redirect(new URL("/pricing?error=no-email", base));
    }

    // --- Determine plan + expiry via subscription status ----------------
    let plan: ProUserClaim["plan"] = "pro";
    let periodEnd: number | undefined;
    let cookieExp: number;

    const sub = session.subscription as Stripe.Subscription | null;
    if (sub) {
      // Active or trialing = Pro.
      // Canceled / past_due / unpaid = grant a grace 24h (PRD §M7) still Pro,
      // except fully 'canceled' revert to free.
      const status = sub.status;
      const graceUntil = Math.floor(Date.now() / 1000) + 24 * 60 * 60;
      periodEnd = sub.current_period_end ?? undefined;

      if (status === "active" || status === "trialing") {
        plan = "pro";
      } else if (status === "past_due" || status === "unpaid") {
        // 24h grace (PRD § M7).
        plan = "pro";
        periodEnd = Math.min(periodEnd ?? graceUntil, graceUntil);
      } else if (status === "canceled" || status === "incomplete_expired") {
        plan = "free";
      }
    }

    if (plan === "pro" && periodEnd && periodEnd > Date.now() / 1000 + 24 * 60 * 60) {
      // Normal path.
      cookieExp = periodEnd;
    } else if (plan === "pro") {
      // Grace: 24h from now minimum (keeps user Pro even if just expired)
      cookieExp = Math.floor(Date.now() / 1000) + 24 * 60 * 60;
    } else {
      // Not pro — short free marker cookie so we still know WHO they are.
      cookieExp = Math.floor(Date.now() / 1000) + 60 * 60; // 1h
    }

    const claim: ProUserClaim = {
      email,
      plan,
      exp: cookieExp,
      periodEnd,
    };
    const signed = await signClaim(claim);

    (await cookies()).set(PRO_COOKIE_NAME, signed, {
      httpOnly: true,
      secure: proto === "https",
      sameSite: "lax",
      path: "/",
      maxAge: PRO_COOKIE_MAX_AGE_S,
    });

    const redirectUrl = new URL("/", base);
    redirectUrl.searchParams.set("pro", plan === "pro" ? "1" : "0");
    return NextResponse.redirect(redirectUrl);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const err = encodeURIComponent(msg.slice(0, 120));
    return NextResponse.redirect(new URL(`/pricing?error=server&m=${err}`, base));
  }
}
