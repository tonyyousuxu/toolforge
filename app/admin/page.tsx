import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { TOOLS, CATEGORIES, getAllToolsForAdmin } from "@/lib/tool-registry";

/**
 * Module 9: Administration Dashboard — SCAFFOLDING.
 *
 * Post-MVP implementation plan (PRD § M9):
 *  - Admin role guard (session cookie, server-side)
 *  - Overview tab: MAU, Pro subs, MRR, 7-day ops chart, top tools table, revenue trend
 *  - Tools tab: registry live/hidden toggle (hidden = 410 Gone preserves SEO)
 *  - Users tab: searchable user table (plan/signup/active) + manage plan/suspend
 *  - Content tab: blog traffic + SEO metrics (Search Console API)
 *  - Alert on suspicious activity (>100 ops/day per IP)
 *
 * Current state: static 4-tab wireframe showing each area + live tool count.
 * ------------------------------------------------------------------------- */
export default function AdminPlaceholder() {
  const all = getAllToolsForAdmin();
  const live = TOOLS.filter((t) => t.status === "live").length;
  const coming = TOOLS.filter((t) => t.status === "coming-soon").length;
  void CATEGORIES;

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <section className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <nav aria-label="Breadcrumb" className="mb-6 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Link href="/" className="hover:text-primary">All Tools</Link>
            <span>/</span>
            <span className="text-foreground/70">Admin</span>
          </nav>

          <div className="flex items-start justify-between gap-5">
            <div>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Admin Dashboard</h1>
              <p className="mt-2 max-w-2xl text-muted-foreground">
                Module 9 scaffold — add Postgres read replica + cron snapshots.
              </p>
            </div>
            <div className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
              🔐 Admin role only (guard server-side)
            </div>
          </div>

          {/* Tabs */}
          <div role="tablist" className="mt-8 flex flex-wrap gap-2 border-b border-border pb-2 text-sm">
            {["Overview", "Tools", "Users", "Content"].map((t, i) => (
              <button
                key={t}
                role="tab"
                aria-selected={i === 0}
                className={[
                  "rounded-t-lg px-4 py-2 font-medium transition",
                  i === 0
                    ? "border border-b-0 border-border bg-background text-primary -mb-px"
                    : "text-muted-foreground hover:text-foreground",
                ].join(" ")}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Overview stat cards */}
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="MAU (Month 4 target)" value="50,000" trend="Target → 15K MAU at M8" />
            <StatCard label="Pro subscribers (M8)" value="450" trend="At 3% conversion of 15K MAU" />
            <StatCard label="MRR (Month 12)" value="$4,050" trend="Projection per §05 Revenue" />
            <StatCard label="Tools registered" value={`${all.length}`} sub={`${live} live · ${coming} coming soon`} />
          </div>

          {/* 7-day ops chart placeholder + top tools */}
          <div className="mt-8 grid gap-6 lg:grid-cols-3">
            <div className="rounded-xl border border-border bg-card p-5 lg:col-span-2">
              <h3 className="text-sm font-semibold">Operations — 7 day trend (slot)</h3>
              <div className="mt-4 flex h-40 items-end gap-2">
                {[30, 45, 22, 60, 70, 55, 80].map((h, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-t-md bg-gradient-to-t from-primary/70 to-primary/20"
                    style={{ height: `${h}%` }}
                    title={`Day ${i + 1}: ~${h * 10}`}
                  />
                ))}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Post-MVP: replace with Recharts / Tremor bar chart from DB read replica.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="text-sm font-semibold">Top tools</h3>
              <ul className="mt-4 divide-y divide-border text-sm">
                {TOOLS.slice(0, 5).map((t, i) => (
                  <li key={t.slug} className="flex items-center justify-between py-2">
                    <span className="flex items-center gap-2 truncate">
                      <span className="w-5 text-xs text-muted-foreground">#{i + 1}</span>
                      <span>{t.icon}</span>
                      <span className="truncate">{t.name}</span>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {t.status === "live" ? "Live" : "Soon"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Tools tab preview */}
          <div className="mt-10">
            <div className="flex items-end justify-between">
              <h2 className="text-xl font-semibold">Tools registry (Module 9 · Tools tab preview)</h2>
              <span className="text-xs text-muted-foreground">
                Flip status to live/hidden → home/nav/sitemaps update instantly.
              </span>
            </div>
            <div className="mt-4 overflow-hidden rounded-xl border border-border bg-card">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-5 py-3 font-medium">Tool</th>
                    <th className="px-5 py-3 font-medium">Category</th>
                    <th className="px-5 py-3 font-medium">Widget</th>
                    <th className="px-5 py-3 font-medium">Processor</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {TOOLS.map((t) => (
                    <tr key={t.slug}>
                      <td className="px-5 py-2.5">
                        <div className="flex items-center gap-2">
                          <span>{t.icon}</span>
                          <span className="font-medium">{t.name}</span>
                          <span className="text-xs text-muted-foreground">/{t.slug}</span>
                        </div>
                      </td>
                      <td className="px-5 py-2.5 capitalize text-muted-foreground">{t.category}</td>
                      <td className="px-5 py-2.5 text-xs text-muted-foreground">{t.widgetType}</td>
                      <td className="px-5 py-2.5 font-mono text-xs text-muted-foreground">{t.processorId}</td>
                      <td className="px-5 py-2.5">
                        <span
                          className={[
                            "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                            t.status === "live"
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                              : t.status === "hidden"
                              ? "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
                              : "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
                          ].join(" ")}
                        >
                          {t.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

function StatCard({
  label,
  value,
  trend,
  sub,
}: {
  label: string;
  value: string;
  trend?: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-2 text-3xl font-extrabold tracking-tight">{value}</div>
      {sub ? (
        <div className="mt-1 text-xs text-muted-foreground">{sub}</div>
      ) : trend ? (
        <div className="mt-1 text-xs text-primary">{trend}</div>
      ) : null}
    </div>
  );
}
