"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { CategoryPills } from "@/components/category-pills";
import { ToolGrid } from "@/components/tool-grid";
import {
  CATEGORIES,
  TOOLS,
  searchTools,
  getLiveTools,
  getToolsByCategory,
  type CategorySlug,
  type ToolDefinition,
} from "@/lib/tool-registry";

/**
 * Module 1: Home Page body (wrapped in Suspense by page.tsx because
 * useSearchParams() requires a Suspense boundary for static prerender).
 *
 * STATE MACHINE (per PRD § M1 STATE):
 *   Default → (type search) → Filtered → (click category)
 *   → Filtered by both → (clear) → Default → (click card) → tool page.
 *
 * Search param "?q=" deep-links a filtered view and syncs to the grid
 * (header search submit also lands here with ?q).
 *
 * SOURCE OF TRUTH: Tool Registry.
 *   - New tools added to TOOLS[] appear automatically.
 *   - New categories added to CATEGORIES appear in pills + counts automatically.
 * ---------------------------------------------------------------------- */
export default function HomePageBody() {
  const searchParams = useSearchParams();
  const q = searchParams.get("q") ?? "";
  const catParam = searchParams.get("cat") as CategorySlug | null;

  const [category, setCategory] = useState<CategorySlug>(catParam ?? "all");
  const [searchInput, setSearchInput] = useState(q);
  // Keep local state synced with URL (back/forward nav).
  useEffect(() => setSearchInput(q), [q]);

  const tools: ToolDefinition[] = useMemo(() => {
    // If search string present, run search across ALL live tools (ignore category).
    if (searchInput.trim()) return searchTools(searchInput);
    if (category === "all") return getLiveTools();
    return getToolsByCategory(category);
  }, [category, searchInput]);

  // For staging visibility: show "coming-soon" ALSO (appended after, badge shown).
  // Remove in production when all hero tools are live.
  const stagedVisible = useMemo(() => {
    if (searchInput.trim()) return [];
    return TOOLS.filter(
      (t) => t.status !== "live" && (category === "all" || t.category === category)
    );
  }, [category, searchInput]);

  const activeCat = CATEGORIES.find((c) => c.slug === category);

  return (
    <>
      <SiteHeader />

      <main className="flex-1">
        {/* Hero + filter row */}
        <section className="mx-auto w-full max-w-7xl px-4 pt-10 pb-6 sm:px-6 lg:px-8 sm:pt-14">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
              🎉 <span>3 free operations/day · files auto-delete in 1–2h</span>
            </span>
            <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
              Every free online tool you need,{" "}
              <span className="bg-gradient-to-r from-primary to-violet-500 bg-clip-text text-transparent">
                one generous hub.
              </span>
            </h1>
            <p className="mt-4 max-w-2xl text-muted-foreground sm:text-lg">
              Compress PDFs, summarize text, compress images, and more.
              First-class AI tools + generous free tier + no watermarks.
            </p>
          </div>

          {/* Inline search (desktop hero secondary, mobile primary) */}
          <div className="mt-8 md:hidden">
            <InlineSearchInput value={searchInput} onChange={setSearchInput} />
          </div>
          <div className="mt-8 hidden md:block">
            <InlineSearchInput value={searchInput} onChange={setSearchInput} />
          </div>
        </section>

        {/* Category filter bar */}
        <section className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <CategoryPills
            active={category}
            onChange={(s) => {
              setCategory(s);
              // Sync URL so deep-links work.
              const sp = new URLSearchParams();
              if (searchInput.trim()) sp.set("q", searchInput.trim());
              if (s !== "all") sp.set("cat", s);
              const qs = sp.toString();
              history.replaceState(null, "", qs ? `/?${qs}` : "/");
            }}
          />
        </section>

        {/* Category header copy (for SEO & orientation) */}
        {activeCat && category !== "all" && (
          <section className="mx-auto mt-6 w-full max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{activeCat.icon}</span>
              <div>
                <h2 className="text-xl font-semibold sm:text-2xl">{activeCat.landingTagline}</h2>
                <p className="mt-0.5 text-sm text-muted-foreground">{activeCat.description}</p>
              </div>
            </div>
          </section>
        )}

        {/* Tool grid */}
        <section className="mx-auto mt-8 w-full max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
          {/* Live tools */}
          <ToolGrid
            tools={tools}
            emptyTitle={
              searchInput
                ? `No tools match "${searchInput}"`
                : category === "all"
                ? "No live tools yet"
                : `No ${category} tools yet`
            }
            emptyDescription={
              searchInput
                ? "Try a different keyword, or clear search to browse all."
                : "We're building more tools — check back soon."
            }
          />

          {/* Staged / coming-soon cards (only when no search) */}
          {stagedVisible.length > 0 && (
            <div className="mt-12">
              <div className="mb-4 flex items-end justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Coming soon</h2>
                  <p className="text-sm text-muted-foreground">
                    Tools in development — flip status to &quot;live&quot; when processors ship.
                  </p>
                </div>
              </div>
              <ToolGrid tools={stagedVisible} showStatusBadge />
            </div>
          )}
        </section>
      </main>

      <SiteFooter />
    </>
  );
}

function InlineSearchInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="relative">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground"
      >
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.3-4.3" />
      </svg>
      <input
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          const sp = new URLSearchParams();
          if (e.target.value.trim()) sp.set("q", e.target.value.trim());
          const qs = sp.toString();
          history.replaceState(null, "", qs ? `/?${qs}` : "/");
        }}
        type="search"
        placeholder="Try 'compress PDF' or 'summarize text'…"
        className="h-14 w-full rounded-xl border border-input bg-card pl-12 pr-4 text-base shadow-sm transition focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10"
      />
    </div>
  );
}
