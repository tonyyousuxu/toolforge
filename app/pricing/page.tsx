"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { PRO_FEATURE_MATRIX, PRO_PRICE_MONTHLY_USD } from "@/lib/billing";

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
    <Suspense fallback={<div className="p-10 text-center text-muted-foreground">Loading…</div>}>
      <PricingPageInner />
    </Suspense>
  );
}

function PricingPageInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const success = sp.get("success") === "1" || sp.get("pro") === "1";
  const canceled = sp.get("canceled") === "1";
  const pro = sp.get("pro") === "1";
  const err = sp.get("error");

  const features = useMemo(() => buildFeatures(), []);

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-clear banner on user action (editing email, waiting 6s)
  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => {
      const url = new URL(window.location.href);
      ["success", "pro", "canceled", "error", "m"].forEach((k) => url.searchParams.delete(k));
      window.history.replaceState(null, "", url.pathname);
    }, 8000);
    return () => clearTimeout(t);
  }, [success, canceled, err, pro]);

  async function onUpgradeClick() {
    const trimmed = email.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed)) {
      setError("Please enter a valid email address.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      const json: any = await res.json().catch(() => ({}));
      if (!json?.ok || !json.url) {
        throw new Error(json?.error ?? `Server returned HTTP ${res.status}`);
      }
      window.location.href = json.url;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

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

          {(success || canceled || error || err) && (
            <div className="mx-auto mt-8 max-w-xl">
              {success && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  🎉 Welcome to Pro! Your subscription is now active and all limits are unlocked.
                  Returning to tools automatically.
                </div>
              )}
              {canceled && !success && (
                <div className="rounded-xl border border-muted bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                  Your checkout was canceled. No charge was made. Try again whenever you&apos;re ready.
                </div>
              )}
              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}
            </div>
          )}

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
                {features.map((f) => (
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

              {/* Email input + Upgrade button (replaces dead <a href="#checkout">) */}
              <div className="mt-6 space-y-2">
                <label className="block text-xs font-medium text-muted-foreground">
                  Email — used to identify your Pro plan
                </label>
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (error) setError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void onUpgradeClick();
                  }}
                  className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10"
                  autoComplete="email"
                />
                <button
                  type="button"
                  onClick={onUpgradeClick}
                  disabled={loading}
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 focus:outline-none focus:ring-4 focus:ring-primary/20 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                      Preparing checkout…
                    </>
                  ) : (
                    <>Upgrade to Pro</>
                  )}
                </button>
              </div>
              <p className="mt-2 text-center text-xs text-muted-foreground">
                7-day free trial · no credit card required · cancel anytime
              </p>
              <ul className="mt-8 space-y-3 text-sm">
                {features.map((f) => (
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
                  {features.map((f) => (
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
