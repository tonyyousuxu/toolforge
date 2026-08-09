import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

/**
 * Module 6: Account Management — PLACEHOLDER.
 *
 * Post-MVP implementation plan (PRD § M6):
 *  - Modal overlay (not separate pages) for Sign Up / Login
 *  - OAuth (Google, GitHub 70% target) + email/password paths
 *  - JWT httpOnly cookies (30d) with plan, daily count, saved files
 *  - Anonymous cookie UUID → account merge on sign-up
 *  - Authenticated users: ProfileDropdown replaces ProButton in SiteHeader
 *  - Sub-routes: /account/billing (Stripe Customer Portal), /account/usage, /account/settings
 *  - Account deletion = immediate GDPR/CCPA wipe
 *
 * Current state: static placeholder cards showing where each module plugs in.
 * ------------------------------------------------------------------------- */
export default function AccountPlaceholder() {
  const SLOTS = [
    {
      title: "My Account",
      desc: "Plan badge, usage meter, saved files (within TTL), profile settings.",
      status: "Slot — wire NextAuth + PostgreSQL users table",
    },
    {
      title: "Billing",
      desc: "Stripe Customer Portal embed: cancel, update card, invoices.",
      status: "Slot — append /account/billing with Stripe Billing SDK",
    },
    {
      title: "Usage",
      desc: "Daily ops counter, historical 30-day chart of processor use.",
      status: "Slot — build on PostHog / internal usage events DB",
    },
    {
      title: "Log Out",
      desc: "Clear httpOnly JWT + anonymous UUID.",
      status: "Slot — NextAuth signOut() handler",
    },
  ];
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <section className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
          <nav aria-label="Breadcrumb" className="mb-6 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Link href="/" className="hover:text-primary">All Tools</Link>
            <span>/</span>
            <span className="text-foreground/70">My Account</span>
          </nav>
          <div className="flex items-start gap-5">
            <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-primary/10 text-4xl">👤</div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">My Account</h1>
              <p className="mt-2 max-w-2xl text-muted-foreground">
                Module 6 placeholder — OAuth, billing portal, usage stats and data controls plug in here.
              </p>
            </div>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {SLOTS.map((s) => (
              <div key={s.title} className="rounded-xl border border-dashed border-border/70 bg-muted/10 p-5">
                <h3 className="font-semibold">{s.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{s.desc}</p>
                <p className="mt-3 rounded-md bg-background px-2.5 py-1.5 text-[11px] uppercase tracking-wider text-primary">
                  ⚙ {s.status}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-10 rounded-xl border border-border bg-card p-5">
            <h3 className="font-semibold">🔒 Sign up / login modal — wiring targets</h3>
            <div className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
              <div className="rounded-lg bg-muted/40 p-3">🌐 Google OAuth (NextAuth Google)</div>
              <div className="rounded-lg bg-muted/40 p-3">🐙 GitHub OAuth (NextAuth GitHub)</div>
              <div className="rounded-lg bg-muted/40 p-3">📧 Email + password (bcrypt)</div>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Modal entry-points: SiteHeader Sign Up / daily-limit hit / “Save to account”
              in result panels. Anonymous cookie UUID usage merged on signup to prevent limit-reset abuse.
            </p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
