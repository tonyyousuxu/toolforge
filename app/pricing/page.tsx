import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { PRO_FEATURE_MATRIX, PRO_PRICE_MONTHLY_USD } from "@/lib/billing";

export const metadata: Metadata = {
  title: "Pricing — Free vs Pro",
  description: `ToolForge pricing: Free (3 ops/day, 10 MB) or Pro ($${PRO_PRICE_MONTHLY_USD}/mo, 1,000 ops/day, 50 MB, ad-free, priority queue).`,
};

/**
 * Module 7: Billing / Pricing page.
 *  - Free ($0) vs Pro ($9/mo, Recommended badge)
 *  - Feature checklist + comparison table + FAQ
 *
 * Prices & features are SINGLE SOURCE in lib/billing.ts PRO_FEATURE_MATRIX
 * so the same numbers appear on the pricing page, usage limit enforcement,
 * and Pro upgrade CTA widgets.
 *
 * Expansion:
 *  - Add a Team $29/mo card (create plan in Stripe, append to PLANS)
 *  - Add annual billing badge + "Save 20%" with Stripe config
 *  - Self-serve portal: /account/billing (Module 6 account page)
 * ------------------------------------------------------------------------- */

/** Merge canonical matrix + a few marketing rows (fidelity, support, trial). */
function buildFeatures(): Array<{
  label: string;
  free: boolean | string;
  pro: boolean | string;
  note?: string;
  highlight?: boolean;
}> {
  const fromMatrix: ReturnType<typeof buildFeatures> = PRO_FEATURE_MATRIX.map(
    ({ label, free, pro, highlight }) => ({
      label,
      free,
      pro,
      highlight,
    })
  );
  return [
    ...fromMatrix,
    { label: "AI tools: max chars", free: "5,000", pro: "50,000" },
    { label: "PDF→Word fidelity", free: "Basic text", pro: "Preserves layout" },
    { label: "Email support", free: false, pro: true },
    {
      label: "7-day free trial",
      free: "—",
      pro: true,
      note: "No credit card required",
    },
  ];
}

const FEATURES = buildFeatures();

const FAQS: Array<{ q: string; a: string }> = [
  {
    q: "Can I cancel anytime?",
    a: "Yes. Cancel or update your payment method from the self-serve customer portal at /account/billing.",
  },
  {
    q: "Do you offer refunds?",
    a: "We offer a 14-day money-back guarantee on first purchases. Contact support from your account.",
  },
  {
    q: "How does the 7-day free trial work?",
    a: "Start a Pro trial without entering a card. At the end of 7 days, your plan reverts to Free unless you subscribe.",
  },
  {
    q: "Are my files stored permanently?",
    a: "No — uploads and outputs auto-delete within 1–2 hours on every plan.",
  },
];

export default function PricingPage() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <section className="mx-auto w-full max-w-6xl px-4 pt-14 pb-10 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
              💳 Billing powered by Stripe
            </span>
            <h1 className="mt-5 text-4xl font-bold tracking-tight sm:text-5xl">
              Simple pricing, generous free tier
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">
              Start free forever — upgrade when you need more. No watermarks, no sneaky downgrades.
            </p>
          </div>

          <div className="mt-14 grid gap-6 md:grid-cols-2 md:items-end">
            {/* FREE */}
            <div className="rounded-2xl border border-border bg-card p-7 shadow-sm">
              <h3 className="text-lg font-semibold">Free</h3>
              <p className="mt-1 text-sm text-muted-foreground">For quick, occasional tasks.</p>
              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-5xl font-extrabold tracking-tight">$0</span>
                <span className="text-sm text-muted-foreground">/mo, forever</span>
              </div>
              <Link
                href="/"
                className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-lg border border-input bg-background text-sm font-semibold shadow-sm transition hover:bg-muted"
              >
                Start free
              </Link>
              <ul className="mt-8 space-y-3 text-sm">
                {FEATURES.map((f) => (
                  <li key={f.label} className="flex items-start gap-2">
                    <CheckOrValue v={f.free} />
                    <span className="text-muted-foreground">{f.label}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* PRO */}
            <div className="relative rounded-2xl border-2 border-primary bg-gradient-to-b from-primary/5 via-card to-card p-7 shadow-lg">
              <span className="absolute -top-3 right-5 inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-[11px] font-bold text-primary-foreground shadow-sm">
                ⭐ Recommended
              </span>
              <h3 className="text-lg font-semibold">Pro</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                For power users and small teams.
              </p>
              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-5xl font-extrabold tracking-tight">
                  ${PRO_PRICE_MONTHLY_USD}
                </span>
                <span className="text-sm text-muted-foreground">/month</span>
              </div>
              <a
                href="#checkout"
                className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 focus:outline-none focus:ring-4 focus:ring-primary/20"
              >
                Upgrade to Pro
              </a>
              <p className="mt-2 text-center text-xs text-muted-foreground">
                7-day free trial · no credit card required · cancel anytime
              </p>
              <ul className="mt-8 space-y-3 text-sm">
                {FEATURES.map((f) => (
                  <li key={f.label} className="flex items-start gap-2">
                    <CheckOrValue v={f.pro} highlight />
                    <span>{f.label}{f.note ? ` · ${f.note}` : ""}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Comparison table (expansion: Team plan adds column here) */}
          <div className="mt-16">
            <h2 className="text-2xl font-bold tracking-tight text-center">Compare plans</h2>
            <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-card">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-5 py-3 font-medium">Feature</th>
                    <th className="px-5 py-3 font-medium">Free</th>
                    <th className="px-5 py-3 font-medium text-primary">Pro</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {FEATURES.map((f) => (
                    <tr key={f.label}>
                      <td className="px-5 py-3 font-medium">{f.label}</td>
                      <td className="px-5 py-3"><CheckOrValue v={f.free} /></td>
                      <td className="px-5 py-3"><CheckOrValue v={f.pro} highlight /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* FAQ */}
          <div className="mt-16">
            <h2 className="text-2xl font-bold tracking-tight text-center">FAQ</h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {FAQS.map((f) => (
                <details
                  key={f.q}
                  className="group rounded-xl border border-border bg-card px-5 py-4 open:bg-muted/30"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
                    <span>{f.q}</span>
                    <span aria-hidden className="transition group-open:rotate-180">⌄</span>
                  </summary>
                  <p className="mt-3 text-sm text-muted-foreground">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

function CheckOrValue({ v, highlight }: { v: boolean | string; highlight?: boolean }) {
  if (v === true)
    return <span className={highlight ? "text-primary" : "text-emerald-500"}>✓</span>;
  if (v === false || v === "—")
    return <span className="text-muted-foreground/60">—</span>;
  return <span className={highlight ? "font-semibold text-primary" : "font-medium"}>{v}</span>;
}
