import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { buildBaseMetadata } from "@/lib/seo";

export const metadata = buildBaseMetadata({
  title: "About — ToolForge",
  description:
    "ToolForge is a privacy-first, browser-only hub for AI and PDF tools. No signup, no uploads to the cloud unless you opt in.",
  path: "/about",
});

export default function AboutPage() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <section className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
          <nav aria-label="Breadcrumb" className="mb-6 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Link href="/" className="hover:text-primary">All Tools</Link>
            <span>/</span>
            <span className="text-foreground/70">About</span>
          </nav>
          <h1 className="text-4xl font-extrabold tracking-tight">About ToolForge</h1>
          <p className="mt-4 text-lg text-muted-foreground">
            ToolForge is an online tools hub with a plugin-style Tool Registry. The first 8 hero tools are AI writing/proofreading/chat and the 5 most-searched PDF tasks.
          </p>
          <div className="mt-10 space-y-6 text-foreground/85">
            <div className="rounded-xl border border-border bg-card p-5">
              <h2 className="text-lg font-semibold">🧱 Architecture</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Next.js 14 App Router, TypeScript, Tailwind CSS, plugin-style Tool Registry that
                powers home / category / tool pages via JSON configuration — so new tools slot in
                without routing code.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-5">
              <h2 className="text-lg font-semibold">🔒 Privacy first</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Free-tier work runs browser-side; signed URLs only for uploads that require LLM or
                PDF processors. No accounts required for basic use.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-5">
              <h2 className="text-lg font-semibold">🧭 Roadmap</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                200 tools by Month 8 across AI, PDF, Image, Video, Audio, Document, Converter and
                Development categories.
              </p>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
