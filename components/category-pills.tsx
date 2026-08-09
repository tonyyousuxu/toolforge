"use client";

import { CATEGORIES, getCategoryCounts, type CategorySlug } from "@/lib/tool-registry";
import { useMemo } from "react";

interface Props {
  active: CategorySlug;
  onChange: (slug: CategorySlug) => void;
}

/**
 * Module 1: Category Filter Bar
 *  - Auto-generated from CATEGORIES registry
 *  - Live counts from getCategoryCounts() (counts "live" tools only)
 *  - Mobile: horizontal scroll container
 *  - New categories auto-appear (Module 6 § Expansion Vector 2)
 * ---------------------------------------------------------------------- */
export function CategoryPills({ active, onChange }: Props) {
  const counts = useMemo(() => getCategoryCounts(), []);

  return (
    <div
      role="tablist"
      aria-label="Tool categories"
      className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0 [scrollbar-width:thin]"
    >
      {CATEGORIES.map((c) => {
        const isActive = c.slug === active;
        const count = counts[c.slug] ?? 0;
        return (
          <button
            key={c.slug}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(c.slug)}
            className={[
              "inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium transition",
              isActive
                ? "border-primary bg-primary text-primary-foreground shadow-sm"
                : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground",
            ].join(" ")}
          >
            <span aria-hidden>{c.icon}</span>
            <span>{c.name}</span>
            <span
              className={[
                "rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                isActive
                  ? "bg-white/20 text-primary-foreground"
                  : "bg-muted text-muted-foreground",
              ].join(" ")}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
