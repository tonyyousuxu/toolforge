/**
 * lib/stripe.ts
 * ------------
 * Shared helpers for Stripe Checkout + email-based Pro cookie.
 *
 * Design: email-only identity (no full auth/DB).
 * After a successful Checkout payment:
 *   - /api/checkout/success verifies the session
 *   - We look up the customer's active subscription (current_period_end)
 *   - We write a SIGNED httpOnly cookie: tf_pro_user = {email, plan, exp}
 *
 * Signature: HMAC-SHA256 on JSON payload via process.env.JWT_SECRET.
 * This is NOT full JWT (no header/typ/alg bloat) — a simpler "value.hmac"
 * scheme, enough to guarantee that the plan tier claims come from us.
 */

import Stripe from "stripe";

// --- Public types ---------------------------------------------------------

export interface ProUserClaim {
  email: string;
  plan: "free" | "pro";
  /** Unix seconds. Beyond this the cookie is rejected (free fallback). */
  exp: number;
  /** subscription.current_period_end from Stripe — used for renewal display */
  periodEnd?: number;
}

// --- Stripe client --------------------------------------------------------

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  if (stripeClient) return stripeClient;
  const secret = process.env.STRIPE_SECRET_KEY ?? "";
  if (!secret) {
    throw new Error("STRIPE_SECRET_KEY env var is not set");
  }
  stripeClient = new Stripe(secret, {
    apiVersion: "2024-06-20",
    typescript: true,
    httpClient: Stripe.createFetchHttpClient(),
  });
  return stripeClient;
}

export function getStripePriceId(): string {
  const id = process.env.STRIPE_PRICE_ID ?? "";
  if (!id) throw new Error("STRIPE_PRICE_ID env var is not set");
  return id;
}

export function getStripeWebhookSecret(): string {
  const s = process.env.STRIPE_WEBHOOK_SECRET ?? "";
  if (!s) throw new Error("STRIPE_WEBHOOK_SECRET env var is not set");
  return s;
}

// --- Cookie: name + max-age -----------------------------------------------

export const PRO_COOKIE_NAME = "tf_pro_user";
/** 30 days in seconds; we shorted to subscription period_end via exp claim */
export const PRO_COOKIE_MAX_AGE_S = 30 * 24 * 60 * 60;

// --- HMAC signing ---------------------------------------------------------

async function getCryptoKey(secretRaw: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyBytes = enc.encode(secretRaw);
  return await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

function b64UrlEncode(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const b64 =
    typeof btoa === "function"
      ? btoa(binary)
      : Buffer.from(bytes).toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64UrlDecode(s: string): Uint8Array {
  const padded = s + "=".repeat((4 - (s.length % 4)) % 4);
  const b64 = padded.replace(/-/g, "+").replace(/_/g, "/");
  if (typeof atob === "function") {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  return new Uint8Array(Buffer.from(b64, "base64"));
}

async function hmacHex(message: string, secretRaw: string): Promise<string> {
  const key = await getCryptoKey(secretRaw);
  const enc = new TextEncoder();
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return b64UrlEncode(sig);
}

function getJwtSecret(): string {
  const s = process.env.JWT_SECRET ?? "";
  if (!s) throw new Error("JWT_SECRET env var is not set");
  return s;
}

/** Sign a claim into a cookie-safe string: <payloadB64>.<hmac> */
export async function signClaim(claim: ProUserClaim): Promise<string> {
  const secret = getJwtSecret();
  const payload = b64UrlEncode(
    new TextEncoder().encode(JSON.stringify(claim)).buffer as ArrayBuffer
  );
  const sig = await hmacHex(payload, secret);
  return `${payload}.${sig}`;
}

/** Parse and verify a cookie value. Returns null if tampered/expired. */
export async function verifyClaim(raw: string | undefined): Promise<ProUserClaim | null> {
  if (!raw) return null;
  const [payload, sig] = raw.split(".");
  if (!payload || !sig) return null;
  try {
    const secret = getJwtSecret();
    const expected = await hmacHex(payload, secret);
    if (expected !== sig) return null;

    const jsonBytes = b64UrlDecode(payload);
    const str = new TextDecoder().decode(jsonBytes);
    const claim = JSON.parse(str) as ProUserClaim;
    if (!claim || typeof claim !== "object") return null;
    if (typeof claim.plan !== "string") return null;
    if (typeof claim.exp !== "number") return null;
    if (Date.now() / 1000 > claim.exp) return null;
    return claim;
  } catch {
    return null;
  }
}
