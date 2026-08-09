import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ToolWidget } from "@/components/tool-widget/tool-widget";
import { ToolGrid } from "@/components/tool-grid";
import {
  getAllSlugsForSitemap,
  getRelatedTools,
  getToolBySlug,
  CATEGORIES,
  type ToolDefinition,
} from "@/lib/tool-registry";

/**
 * Module 2 / Module 8: Tool Page (shared template)
 *  - H1 + description (matches search query)
 *  - Tool Widget: widget + options + action + result (inline)
 *  - Below fold: "How it works" (3-5 steps) · FAQ (schema.org) · Related tools
 *
 * All content driven by tool.seo from Tool Registry.
 * New tool page = registry entry — page, metadata, breadcrumbs, related tools,
 * sitemap entry auto-generate at build time (SSG).
 *
 * EXPANSION (Schema.org FAQ):
 *  - Uncomment jsonLdFaqs when <Script> + FAQPage shipped post-MVP
 * -------------------------------------------------------------------- */

type Params = { slug: string };

export function generateStaticParams(): Params[] {
  return getAllSlugsForSitemap().map((slug) => ({ slug }));
}

export function generateMetadata({ params }: { params: Params }): Metadata {
  const tool = getToolBySlug(params.slug);
  if (!tool) return {};
  return {
    title: tool.seo.title,
    description: tool.seo.metaDescription,
    keywords: tool.keywords.concat(tool.seo.relatedKeywords),
    alternates: {
      canonical: `/tools/${tool.slug}`,
      // Expansion: i18n hreflang auto-generated from tool.seo.locales keys
      // languages: buildHreflangs(tool.seo.locales, tool.slug),
    },
    openGraph: {
      title: tool.seo.title,
      description: tool.seo.metaDescription,
      type: "website",
      url: `/tools/${tool.slug}`,
      siteName: "ToolForge",
    },
    robots: tool.status === "hidden" ? { index: false, follow: false } : undefined,
  };
}

export default function ToolPage({ params }: { params: Params }) {
  const tool = getToolBySlug(params.slug);
  // Module 9: Hidden tools return 410 Gone (preserves SEO authority).
  if (!tool || tool.status === "hidden") notFound();

  const categoryInfo = CATEGORIES.find((c) => c.slug === tool.category);
  const related = getRelatedTools(tool, 6);

  return (
    <>
      <SiteHeader />

      <main className="flex-1">
        <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {/* Breadcrumbs (SEO internal-linking) */}
          <nav aria-label="Breadcrumb" className="mb-6 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Link href="/" className="hover:text-primary">
              All Tools
            </Link>
            <span aria-hidden>/</span>
            {categoryInfo && (
              <>
                <Link href={`/category/${categoryInfo.slug}`} className="hover:text-primary">
                  {categoryInfo.name}
                </Link>
                <span aria-hidden>/</span>
              </>
            )}
            <span className="text-foreground/70">{tool.name}</span>
          </nav>

          {/* H1 + intro */}
          <header className="mb-8 flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-3xl">
                {tool.icon}
              </div>
              <div>
                <div className="flex items-center gap-2 text-xs">
                  {categoryInfo && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                      <span>{categoryInfo.icon}</span>
                      {categoryInfo.name}
                    </span>
                  )}
                  {tool.status !== "live" && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                      Coming soon
                    </span>
                  )}
                </div>
                <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">
                  {tool.seo.title.includes("—")
                    ? tool.seo.title.split("—")[0].trim()
                    : tool.name}
                </h1>
              </div>
            </div>
            <p className="max-w-3xl text-muted-foreground sm:text-lg">{tool.seo.intro}</p>
          </header>

          {/* Primary widget card */}
          <section className="grid gap-8 lg:grid-cols-[1fr_min(260px,28%)]">
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-7">
              <ToolWidget tool={tool} />
            </div>

            {/* Sidebar: limits + upgrade CTA */}
            <aside className="space-y-5">
              <FreeVsProCard tool={tool} />
              <LimitsCard tool={tool} />
            </aside>
          </section>

          {/* Below fold: How it works + FAQ + Related tools (Module 8 SEO) */}
          <section className="mt-16">
            <div className="grid gap-10 lg:grid-cols-5">
              <div className="lg:col-span-3 space-y-12">
                <HowItWorks tool={tool} />
                {tool.seo.faq.length > 0 && <FaqBlock tool={tool} />}
              </div>
              <div className="lg:col-span-2">
                {related.length > 0 && (
                  <div>
                    <h2 className="mb-4 text-lg font-semibold">Related tools</h2>
                    <div className="grid grid-cols-2 gap-3">
                      {related.map((t) => (
                        <Link
                          key={t.slug}
                          href={`/tools/${t.slug}`}
                          className="group flex items-start gap-2 rounded-xl border border-border bg-card p-3 transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-sm"
                        >
                          <span className="text-xl leading-none">{t.icon}</span>
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold group-hover:text-primary">
                              {t.name}
                            </div>
                            <div className="line-clamp-2 text-xs text-muted-foreground">
                              {t.tagline}
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}

function HowItWorks({ tool }: { tool: ToolDefinition }) {
  return (
    <div>
      <h2 className="text-2xl font-bold tracking-tight">How it works</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Three simple steps — no signup, no watermarks.
      </p>
      <ol className="mt-6 grid gap-4 sm:grid-cols-3">
        {tool.seo.howItWorks.map((s) => (
          <li
            key={s.step}
            className="relative rounded-xl border border-border bg-muted/20 p-5"
          >
            <div className="grid h-8 w-8 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
              {s.step}
            </div>
            <h3 className="mt-4 font-semibold">{s.heading}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{s.body}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

function FaqBlock({ tool }: { tool: ToolDefinition }) {
  return (
    <div>
      <h2 className="text-2xl font-bold tracking-tight">Frequently asked questions</h2>
      <div className="mt-6 divide-y divide-border rounded-xl border border-border bg-card">
        {tool.seo.faq.map((f, i) => (
          <details key={i} className="group px-5 py-4 open:bg-muted/30">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
              <span>{f.q}</span>
              <span aria-hidden className="transition group-open:rotate-180">
                ⌄
              </span>
            </summary>
            <p className="mt-3 text-sm text-muted-foreground">{f.a}</p>
          </details>
        ))}
      </div>
      {/* Module 8: Schema.org FAQPage JSON-LD — inject here for 0-click FAQ rich snippets. */}
    </div>
  );
}

function FreeVsProCard({ tool }: { tool: ToolDefinition }) {
  return (
    <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 to-violet-500/5 p-5">
      <div className="flex items-center gap-2">
        <span className="text-2xl">🚀</span>
        <h3 className="font-semibold">Unlock everything</h3>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        {tool.name} and 15+ other tools — higher limits, higher fidelity.
      </p>
      <ul className="mt-4 space-y-2 text-sm">
        <li className="flex items-center gap-2">
          <span className="text-emerald-500">✓</span> Unlimited operations / day
        </li>
        <li className="flex items-center gap-2">
          <span className="text-emerald-500">✓</span> 2 GB files · unlimited batch
        </li>
        <li className="flex items-center gap-2">
          <span className="text-emerald-500">✓</span> Layout-preserving PDF→Word
        </li>
        <li className="flex items-center gap-2">
          <span className="text-emerald-500">✓</span> 50,000-char AI tools
        </li>
      </ul>
      <Link
        href="/pricing"
        className="mt-5 inline-flex h-10 w-full items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90"
      >
        Upgrade to Pro · $9/mo
      </Link>
    </div>
  );
}

function LimitsCard({ tool }: { tool: ToolDefinition }) {
  const rows: Array<{ label: string; free: string; pro: string }> = [];
  if (tool.maxFileSizeMB)
    rows.push({
      label: "Max file size",
      free: `${tool.maxFileSizeMB.free} MB`,
      pro:
        tool.maxFileSizeMB.pro === "unlimited" ? "2 GB" : `${tool.maxFileSizeMB.pro} MB`,
    });
  if (tool.maxFiles)
    rows.push({
      label: "Files per run",
      free: `${tool.maxFiles.free}`,
      pro: tool.maxFiles.pro === "unlimited" ? "Unlimited" : `${tool.maxFiles.pro}`,
    });
  if (tool.maxChars)
    rows.push({
      label: "Chars per run",
      free: `${tool.maxChars.free.toLocaleString()}`,
      pro:
        tool.maxChars.pro === "unlimited"
          ? "Unlimited"
          : `${Number(tool.maxChars.pro).toLocaleString()}`,
    });
  rows.push({ label: "Ops / day", free: "3", pro: "Unlimited" });
  rows.push({ label: "Auto-delete", free: "1–2 hours", pro: "1–2 hours" });

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="font-semibold">Limits</h3>
      <table className="mt-3 w-full border-collapse text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
            <th className="py-1.5 pr-2 font-medium">Feature</th>
            <th className="py-1.5 pr-2 font-medium">Free</th>
            <th className="py-1.5 font-medium">Pro</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border text-sm">
          {rows.map((r) => (
            <tr key={r.label}>
              <td className="py-2 pr-2 text-muted-foreground">{r.label}</td>
              <td className="py-2 pr-2">{r.free}</td>
              <td className="py-2 font-medium text-primary">{r.pro}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
