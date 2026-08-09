"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useMemo, useRef, useEffect } from "react";
import { searchTools } from "@/lib/tool-registry";
import type { ToolDefinition } from "@/lib/tool-registry";

/**
 * Module 1: Sticky Header
 *  - Logo
 *  - Search (real-time, autocomplete at 2 chars)
 *  - Pro button (auth'd Pro users see avatar dropdown — stubbed)
 *
 * Expansion hooks:
 *  - AUTH SLOT: swap ProButton for AvatarDropdown when Module 6 ships.
 *  - THEME SLOT: insert theme toggle next to search if dark-mode shipped.
 * ---------------------------------------------------------------------- */
export function SiteHeader() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const suggestions: ToolDefinition[] = useMemo(() => {
    if (query.trim().length < 2) return [];
    // Search runs over LIVE tool registry (same data → same grid).
    return searchTools(query).slice(0, 6);
  }, [query]);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setFocused(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2 font-bold tracking-tight">
          <span className="text-2xl">🛠️</span>
          <span className="text-xl">
            Tool<span className="text-primary">Forge</span>
          </span>
        </Link>

        {/* Search */}
        <div ref={wrapRef} className="relative hidden flex-1 md:block">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setFocused(true)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && query.trim()) {
                  router.push(`/?q=${encodeURIComponent(query.trim())}`);
                  setFocused(false);
                }
              }}
              type="search"
              placeholder="Search tools: compress PDF, summarize, resize image…"
              className="h-10 w-full rounded-lg border border-input bg-background pl-10 pr-4 text-sm shadow-sm transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          {focused && suggestions.length > 0 && (
            <ul className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-lg border border-border bg-card shadow-xl">
              {suggestions.map((t) => (
                <li key={t.slug}>
                  <Link
                    href={`/tools/${t.slug}`}
                    onClick={() => setFocused(false)}
                    className="flex items-start gap-3 px-4 py-3 text-sm transition hover:bg-muted"
                  >
                    <span className="text-xl leading-none">{t.icon}</span>
                    <div className="min-w-0">
                      <div className="font-medium text-foreground">{t.name}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {t.tagline}
                      </div>
                    </div>
                    <span className="ml-auto shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                      {t.category}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* AUTH SLOT — avatar dropdown replaces this when Module 6 active. */}
        <Link
          href="/pricing"
          className="ml-auto inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          Go Pro
        </Link>
      </div>

      {/* Mobile search row */}
      <div className="md:hidden">
        <div className="mx-auto w-full max-w-7xl px-4 pb-3 sm:px-6 lg:px-8">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && query.trim()) {
                  router.push(`/?q=${encodeURIComponent(query.trim())}`);
                }
              }}
              type="search"
              placeholder="Search tools…"
              className="h-10 w-full rounded-lg border border-input bg-background pl-10 pr-4 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>
      </div>
    </header>
  );
}

function SearchIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}
