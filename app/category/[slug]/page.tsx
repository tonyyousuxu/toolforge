import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ToolGrid } from "@/components/tool-grid";
import {
  CATEGORIES,
  TOOLS,
  getCategoryInfo,
  getCategoryLandingSlugs,
  getToolsByCategory,
  type CategorySlug,
  type ToolDefinition,
} from "@/lib/tool-registry";

/**
 * Module 1 / Expansion Vector 2: Category Landing Pages
 *  - Auto-generated from CATEGORIES registry (slug in CATEGORIES → /category/[slug] exists)
 *  - H2 tagline + category description + tool grid filtered by category
 *  - SEO title + OG copy pulled from CategoryInfo
 *  - New category → add to CATEGORIES[]; this page generates without code changes.
 * ------------------------------------------------------------------------- */

type Params = { slug: CategorySlug };

export function generateStaticParams(): Params[] {
  return getCategoryLandingSlugs().map((slug) => ({ slug }));
}

export function generateMetadata({ params }: { params: Params }): Metadata {
  const cat = getCategoryInfo(params.slug);
  if (!cat) return {};
  return {
    title: `${cat.name} Tools — Free Online ${cat.name} Utilities | ToolForge`,
    description: cat.description,
    alternates: { canonical: `/category/${cat.slug}` },
    openGraph: {
      title: `${cat.name} Tools — Free Online ${cat.name} Utilities`,
      description: cat.description,
      url: `/category/${cat.slug}`,
      type: "website",
    },
  };
}

export default function CategoryLanding({ params }: { params: Params }) {
  const cat = getCategoryInfo(params.slug);
  if (!cat) notFound();

  const live: ToolDefinition[] = getToolsByCategory(params.slug as Exclude<CategorySlug, "all">);
  const staged = TOOLS.filter((t) => t.category === params.slug && t.status !== "live");

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <section className="mx-auto w-full max-w-7xl px-4 pt-12 pb-8 sm:px-6 lg:px-8">
          <nav aria-label="Breadcrumb" className="mb-6 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Link href="/" className="hover:text-primary">All Tools</Link>
            <span aria-hidden>/</span>
            <span className="text-foreground/70">{cat.name}</span>
          </nav>

          <div className="flex items-start gap-5">
            <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-primary/10 text-4xl">
              {cat.icon}
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                {cat.landingTagline}
              </h1>
              <p className="mt-2 max-w-2xl text-muted-foreground sm:text-lg">
                {cat.description}
              </p>
            </div>
          </div>

          {/* Quick category nav */}
          <div className="mt-8 flex flex-wrap items-center gap-2">
            {CATEGORIES.filter((c) => c.slug !== "all").map((c) => {
              const active = c.slug === cat.slug;
              return (
                <Link
                  key={c.slug}
                  href={`/category/${c.slug}`}
                  className={[
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition",
                    active
                      ? "border-primary bg-primary text-primary-foreground shadow-sm"
                      : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground",
                  ].join(" ")}
                >
                  <span>{c.icon}</span>
                  {c.name}
                </Link>
              );
            })}
          </div>
        </section>

        <section className="mx-auto w-full max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
          <ToolGrid
            tools={live}
            emptyTitle={`No ${cat.name} tools live yet`}
            emptyDescription="We're building this category. Check back soon, or try another category."
          />
          {staged.length > 0 && (
            <div className="mt-14">
              <div className="mb-4">
                <h2 className="text-lg font-semibold">Coming soon in {cat.name}</h2>
                <p className="text-sm text-muted-foreground">
                  These tools are in development — flip status to &quot;live&quot; when their processors ship.
                </p>
              </div>
              <ToolGrid tools={staged} showStatusBadge />
            </div>
          )}
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
