import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { resolvePlan } from "@/lib/billing";
import {
  PRO_COOKIE_NAME,
  verifyClaim,
} from "@/lib/stripe";
import { cookies } from "next/headers";

export const runtime = "nodejs";

/**
 * GET /api/plan
 * Public JSON endpoint returning the current user's plan from the
 * signed httpOnly cookie + optional live Stripe refresh.
 *
 * Body: { plan: "free" | "pro", email?: string, periodEnd?: number }
 */
export async function GET(_req: NextRequest): Promise<Response> {
  const ckStore = await cookies();
  const raw = ckStore.get(PRO_COOKIE_NAME)?.value;
  const claim = raw ? await verifyClaim(raw) : null;

  // resolvePlan() does a live refresh when the cookie is close to expiry
  // so we don't have to duplicate that logic here.
  const plan = await resolvePlan(claim?.email ?? null);

  const body: {
    plan: "free" | "pro";
    email?: string;
    periodEnd?: number;
  } = {
    plan,
    email: claim?.email,
    periodEnd: claim?.periodEnd,
  };
  return NextResponse.json(body);
}
