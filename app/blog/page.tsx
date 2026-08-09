import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { buildBaseMetadata, websiteJsonLd } from "@/lib/seo";

/**
 * Module 8: SEO & Analytics — BLOG PLACEHOLDER.
 * PRD §03/M8: 1 post/week (compare/guides/how-to),
 *             80% of M4-M8 traffic driver.
 *
 * Post-MVP: wire a headless CMS (Sanity / MDX) + per-post metadata +
 * /blog/[slug] dynamic route. Append sitemap entries from CMS in
 * app/sitemap.ts.
 * ------------------------------------------------------------------- */
export const metadata = buildBaseMetadata({
  title: "Blog — AI Productivity Guides",
  description:
    "How-to guides, tool comparisons, and AI productivity tips from ToolForge. Zero fluff, hands-on workflows.",
  path: "/blog",
  keywords: ["AI tools guide", "PDF how to", "AI productivity blog"],
});

const PLACEHOLDER_POSTS = [
  {
    slug: "ai-writing-vs-ai-proofreading",
    title: "AI Writing vs. AI Proofreading: When to Use Each",
    tag: "AI Writing",
    excerpt:
      "Two very different jobs. Learn which workflow uses tokens sparingly while keeping your voice intact.",
    mins: 5,
    date: "2025-09-08",
  },
  {
    slug: "compress-a-pdf-without-losing-quality",
    title: "How to Compress a PDF Without Ruining Image Quality",
    tag: "PDF",
    excerpt:
      "A hands-on test of 6 compression profiles — which preserves charts, photos and scanned text best.",
    mins: 7,
    date: "2025-08-28",
  },
  {
    slug: "merge-pdfs-offline-vs-online",
    title: "Merge PDFs Offline vs. Online: A Privacy Comparison",
    tag: "PDF",
    excerpt:
      "Is browser-only actually private? We audit 4 popular PDF tools (including ours) for data leaks.",
    mins: 4,
    date: "2025-08-18",
  },
];

export default function BlogIndex() {
  const jsonLd = websiteJsonLd();
  return (
    <>
      <SiteHeader />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main className="flex-1">
        <section className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
          <nav aria-label="Breadcrumb" className="mb-6 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Link href="/" className="hover:text-primary">All Tools</Link>
            <span>/</span>
            <span className="text-foreground/70">Blog</span>
          </nav>

          <header className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              ✍️ Module 8 · SEO blog placeholder
            </div>
            <h1 className="mt-4 text-4xl font-extrabold tracking-tight sm:text-5xl">
              AI productivity, demystified.
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">
              Compare guides, how-tos, and tool teardowns. Wire up Sanity / MDX here post-MVP;
              current posts are placeholders so <code className="rounded bg-muted/60 px-1.5 py-0.5 text-[12px]">/blog/[slug]</code> routing has a home.
            </p>
          </header>

          <div className="mt-12 grid gap-6 lg:grid-cols-2">
            {PLACEHOLDER_POSTS.map((post, i) => (
              <article
                key={post.slug}
                className={[
                  "group flex flex-col justify-between rounded-2xl border border-border bg-card p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md",
                  i === 0 ? "lg:col-span-2" : "",
                ].join(" ")}
              >
                <div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span className="rounded-full bg-muted/60 px-2.5 py-0.5 font-medium text-foreground/70">
                      {post.tag}
                    </span>
                    <span>· {post.date}</span>
                    <span>· {post.mins} min read</span>
                  </div>
                  <h2 className={["mt-3 font-bold tracking-tight", i === 0 ? "text-2xl sm:text-3xl" : "text-xl"].join(" ")}>
                    <Link href={`/blog/${post.slug}`} className="after:absolute after:inset-0">
                      {post.title}
                    </Link>
                  </h2>
                  <p className="mt-3 text-muted-foreground">{post.excerpt}</p>
                </div>
                <div className="relative mt-5 flex items-center gap-1 text-sm font-medium text-primary">
                  Read article →
                </div>
              </article>
            ))}
          </div>

          <div className="mt-10 rounded-xl border border-dashed border-border/70 bg-muted/10 p-5 text-sm text-muted-foreground">
            Post-MVP expansion slots:
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Add <code>/blog/[slug]</code> route with MDX/Sanity renderer + per-post TOC, schema.org Article JSON-LD.</li>
              <li>Append entries in <code>app/sitemap.ts</code> from CMS list.</li>
              <li>Tag pages (<code>/blog/tag/pdf</code>) and RSS feed (<code>/blog/rss.xml</code>).</li>
            </ul>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
