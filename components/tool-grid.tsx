import type { ToolDefinition } from "@/lib/tool-registry";
import { ToolCard } from "./tool-card";

interface Props {
  tools: ToolDefinition[];
  /** If true, show status pill for non-live (used by admin / staging grid). */
  showStatusBadge?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
}

/**
 * Module 1: Responsive Tool Grid
 *  - Desktop: 4 columns  ·  Tablet: 3  ·  Mobile: 2 (PRD § M1 Layout)
 *  - Empty state when no matches (search + category + no live)
 *  - Pass showStatusBadge=true on admin dashboard (Module 9 slot)
 *
 * Expansion: add sort / view toggles (cards/list), lazy pagination for 50+ tools.
 * ---------------------------------------------------------------------- */
export function ToolGrid({
  tools,
  showStatusBadge,
  emptyTitle = "No tools found",
  emptyDescription = "Try a different search or category.",
}: Props) {
  if (tools.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 py-16 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted text-2xl">
          🔍
        </div>
        <h3 className="mt-4 font-semibold">{emptyTitle}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{emptyDescription}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:gap-5 lg:grid-cols-4 animate-fade-in">
      {tools.map((t) => (
        <ToolCard key={t.slug} tool={t} showStatusBadge={showStatusBadge} />
      ))}
    </div>
  );
}
