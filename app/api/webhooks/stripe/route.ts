import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import Stripe from "stripe";
import { getStripe, getStripeWebhookSecret } from "@/lib/stripe";

export const runtime = "nodejs";
// Webhooks need the raw body for signature verification; disable body parsing by
// Next so we pass it through raw. Next.js App Router provides `request.text()`
// which gives us the unparsed string (signature-verifiable) by default.

/**
 * POST /api/webhooks/stripe
 * Stripe webhook endpoint.
 *
 * For the email-only (no DB) design, the webhook is NOT the source of truth —
 * it's used mainly for auditing + defensive refresh. The cookie is the user's
 * Pro claim, set on the success redirect. The webhook guarantees we also
 * handle subscription cancellation (even if the user never returns) because
 * on their next tool usage we call resolvePlan() which does a live Stripe
 * check by email when the cookie is near expiry.
 *
 * Events handled:
 *   checkout.session.completed  - future extension (success page already handles)
 *   customer.subscription.updated - log + (future) invalidate caches
 *   customer.subscription.deleted - log
 *   invoice.payment_failed      - log
 */
export async function POST(req: NextRequest): Promise<Response> {
  try {
    const signature = req.headers.get("stripe-signature");
    if (!signature) {
      return NextResponse.json({ ok: false, error: "Missing signature" }, { status: 400 });
    }
    const rawBody = await req.text();
    const secret = getStripeWebhookSecret();
    const stripe = getStripe();

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, secret);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return NextResponse.json(
        { ok: false, error: `Webhook signature verification failed: ${msg}` },
        { status: 401 }
      );
    }

    // Minimal handling — all events just logged. Source of truth is Stripe API
    // calls in resolvePlan() + cookie grant from success redirect.
    // We only ack receipt (200 OK) which is all Stripe needs.
    switch (event.type) {
      case "checkout.session.completed": {
        const sess = event.data.object as Stripe.Checkout.Session;
        console.log(`[stripe-webhook] checkout.session.completed id=${sess.id} email=${sess.customer_email ?? sess.metadata?.email ?? "?"}`);
        break;
      }
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        console.log(`[stripe-webhook] subscription.updated id=${sub.id} status=${sub.status} customer=${String(sub.customer)}`);
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        console.log(`[stripe-webhook] subscription.deleted id=${sub.id} customer=${String(sub.customer)}`);
        break;
      }
      case "invoice.payment_failed": {
        const inv = event.data.object as Stripe.Invoice;
        console.log(`[stripe-webhook] invoice.payment_failed id=${inv.id} customer=${String(inv.customer)} reason=${inv.last_finalization_error?.message ?? "?"}`);
        break;
      }
      default:
        console.log(`[stripe-webhook] unhandled event type=${event.type}`);
    }
    return NextResponse.json({ ok: true, received: true, type: event.type });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[stripe-webhook] handler error:", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
