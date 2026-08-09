"use client";

import type { TieredLimit } from "@/lib/tool-registry";

interface Props {
  value: string;
  onChange: (v: string) => void;
  minChars?: number;
  maxChars?: TieredLimit;
  rows?: number;
  placeholder?: string;
  disabled?: boolean;
}

/**
 * Module 2 / Module 3: Textarea for AI tools.
 *  - Min 100 chars (LLM needs signal) · Max 5,000 free / 50,000 Pro (PRD)
 *  - Live char counter + auto-expanding rows
 *  - Expansion: wire to PROMPT registry when LLM proxy ships (ai/summarize…)
 * ------------------------------------------------------------------------- */
export function TextInputWidget({
  value,
  onChange,
  minChars,
  maxChars,
  rows = 6,
  placeholder = "Paste your text here…",
  disabled,
}: Props) {
  const len = value.length;
  const freeCap =
    maxChars && typeof maxChars.free === "number" ? (maxChars.free as number) : null;
  const warn = freeCap ? len / freeCap > 0.8 : false;
  const over = freeCap ? len > freeCap : false;

  return (
    <div className="space-y-2">
      <textarea
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        className={[
          "w-full min-h-[180px] rounded-xl border bg-background p-4 text-sm shadow-sm transition placeholder:text-muted-foreground/80 focus:outline-none focus:ring-4",
          over
            ? "border-destructive focus:border-destructive focus:ring-destructive/10"
            : "border-input focus:border-primary focus:ring-primary/10",
          disabled ? "cursor-not-allowed opacity-60" : "",
        ].join(" ")}
        style={{ resize: "vertical" }}
      />
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {minChars ? (
            <>
              Min <b className="text-foreground">{minChars}</b> chars
              {" · "}
            </>
          ) : null}
          Pro tip: cleaner input = higher-quality output.
        </span>
        <span
          className={[
            "font-mono",
            over
              ? "text-destructive font-semibold"
              : warn
              ? "text-amber-600 dark:text-amber-400"
              : "",
          ].join(" ")}
        >
          {len.toLocaleString()}
          {freeCap ? ` / ${freeCap.toLocaleString()} free` : ""}
          {over ? " — Free limit exceeded. Upgrade to Pro for 50,000." : ""}
        </span>
      </div>
    </div>
  );
}
