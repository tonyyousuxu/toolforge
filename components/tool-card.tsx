import Link from "next/link";
import type { ToolDefinition, CategorySlug } from "@/lib/tool-registry";
import { CATEGORIES } from "@/lib/tool-registry";

interface Props {
  tool: ToolDefinition;
  /** If true, shows "Coming soon" badge instead of clickable. */
  showStatusBadge?: boolean;
}

const STATUS_BADGE: Record<ToolDefinition["status"], { label: string; cls: string }> = {
  live: { label: "Live", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400" },
  "coming-soon": { label: "Coming soon", cls: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400" },
  hidden: { label: "Hidden", cls: "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400" },
};

/**
 * Module 1: Tool Card
 *  - Source: ToolDefinition registry entry
 *  - Auto-renders category pill, icon, tagline
 *  - Desktop 4-col → tablet 3-col → mobile 2-col (grid in ToolGrid)
 *
 * Expansion: swap icon renderer (emoji → SVG sprites), add meta like
 * "Most popular" or user ratings.
 * ---------------------------------------------------------------------- */
export function ToolCard({ tool, showStatusBadge = true }: Props) {
  const isLive = tool.status === "live";
  const categoryInfo = CATEGORIES.find((c) => c.slug === tool.category);
  const href = `/tools/${tool.slug}`;

  const content = (
    <div
      className={[
        "group relative flex h-full flex-col rounded-xl border bg-card p-4 transition-all",
        isLive
          ? "border-border hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md"
          : "border-dashed border-border/70 opacity-80",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center justify-center h-11 w-11 rounded-lg bg-muted text-2xl">
          {tool.icon}
        </div>
        {showStatusBadge && (
          <span
            className={[
              "rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
              STATUS_BADGE[tool.status]?.cls ?? "",
            ].join(" ")}
          >
            {STATUS_BADGE[tool.status]?.label}
          </span>
        )}
      </div>

      <div className="mt-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span aria-hidden>{categoryInfo?.icon}</span>
          <span className="capitalize">{tool.category}</span>
          {tool.featured && (
            <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
              ★ Featured
            </span>
          )}
        </div>
        <h3 className="mt-2 font-semibold leading-tight text-foreground group-hover:text-primary">
          {tool.name}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{tool.tagline}</p>
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {tool.keywords.slice(0, 3).map((k) => (
          <span
            key={k}
            className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
          >
            #{k}
          </span>
        ))}
      </div>
    </div>
  );

  if (!isLive) {
    // Non-live cards are informational (click is no-op).
    return <div aria-disabled>{content}</div>;
  }
  return (
    <Link href={href} className="block h-full focus:outline-none">
      {content}
    </Link>
  );
}
