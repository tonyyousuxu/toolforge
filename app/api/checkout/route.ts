import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getStripe, getStripePriceId } from "@/lib/stripe";

export const runtime = "nodejs";

interface Body {
  email?: string;
  returnUrl?: string;
  cancelUrl?: string;
}

/**
 * POST /api/checkout
 * Body: { email, returnUrl?, cancelUrl? }
 * Creates a Stripe Checkout Session for the Pro subscription (monthly $9).
 * Returns { ok: true, url: 'https://checkout.stripe.com/c/pay/...' }.
 *
 * The user's email is pre-filled. After payment Stripe redirects them to
 * returnUrl (default /api/checkout/success) which verifies the session and
 * writes the signed Pro cookie.
 */
export async function POST(req: NextRequest): Promise<Response> {
  try {
    const body = (await req.json().catch(() => ({}))) as Body;
    const email = String(body.email ?? "").trim();
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return NextResponse.json(
        { ok: false, error: "Valid email required. Please enter the email you used to pay." },
        { status: 400 }
      );
    }

    const headersList = req.headers;
    const host = headersList.get("host") ?? "";
    const proto =
      headersList.get("x-forwarded-proto") ??
      (host.startsWith("localhost") ? "http" : "https");
    const base = `${proto}://${host}`;

    const returnUrl =
      body.returnUrl || `${base}/api/checkout/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = body.cancelUrl || `${base}/pricing?canceled=1`;

    const stripe = getStripe();
    const priceId = getStripePriceId();

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: email,
      allow_promotion_codes: true,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      subscription_data: {
        metadata: {
          email,
          source: "toolforge-checkout",
        },
        // Uncomment below for 7-day free trial (PRD §05):
        // trial_period_days: 7,
      },
      metadata: {
        email,
      },
      // Stripe swaps {CHECKOUT_SESSION_ID} placeholder for the real ID on redirect.
      success_url: returnUrl.includes("{CHECKOUT_SESSION_ID}")
        ? returnUrl
        : returnUrl + (returnUrl.includes("?") ? "&" : "?") + "session_id={CHECKOUT_SESSION_ID}",
      cancel_url: cancelUrl,
    });

    if (!session.url) {
      return NextResponse.json(
        { ok: false, error: "Stripe did not return a checkout URL." },
        { status: 502 }
      );
    }
    return NextResponse.json({ ok: true, url: session.url });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { ok: false, error: `Failed to start checkout: ${msg}` },
      { status: 500 }
    );
  }
}
