"use client";

import { useState } from "react";
import type {
  RewriterDiffSpan,
  SplitOutFile,
  WordCounterResult,
} from "@/lib/tool-registry";

type ResultState =
  | { kind: "idle" }
  | { kind: "loading"; progressPercent?: number; message?: string }
  | { kind: "error"; message: string; retry?: () => void }
  | { kind: "success-text"; text: string; copyLabel?: string }
  | { kind: "success-text-list"; items: string[]; headerLabel: string }
  | { kind: "success-file"; fileName: string; sizeBytes?: number; url: string; multipleUrls?: string[]; preview?: string; meta?: Record<string, string> }
  | {
      kind: "success-rewriter";
      output: string;
      similarityPercent: number;
      outputChars: number;
      watermark: boolean;
      sideBySideDiff?: RewriterDiffSpan[];
      original: string;
    }
  | {
      kind: "success-pdf-split";
      files: SplitOutFile[];
      jobId?: string;
      zipDownloadUrl?: string;
      summary?: string;
    }
  | {
      kind: "success-image";
      dataUrl: string;
      name: string;
      sizeBytes: number;
      originalSizeBytes: number;
      savingsPercent?: number;
    }
  | {
      kind: "success-qr";
      pngDataUrl: string;
      svgMarkup?: string;
      epsMarkup?: string;
      downloadName: string;
    }
  | {
      kind: "success-word-counter";
      stats: WordCounterResult;
    };

interface Props {
  state: ResultState;
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

/**
 * Module 2: Inline Result Panel
 * Extends: text / file / image outputs + AI Rewriter (similarity + Pro side-by-side diff),
 * PDF Splitter (per-file list + ZIP Pro CTA), QR code (PNG/SVG/EPS downloads),
 * Word Counter (6 metrics, top-10 bars, long sentences w/ jump-to).
 * ------------------------------------------------------------------------- */
export function ResultPanel({ state }: Props) {
  if (state.kind === "idle") return null;

  // Is this a client-side-only result (no server upload, so no auto-delete)?
  const splitFiles = state.kind === "success-pdf-split" ? state.files : undefined;
  const isImageResult =
    state.kind === "success-image" ||
    (state.kind === "success-pdf-split" &&
      !!splitFiles?.[0]?.mimeType?.toLowerCase().startsWith("image/"));
  const showAutoDelete =
    (state.kind === "success-file" && !isImageResult) ||
    (state.kind === "success-pdf-split" && !isImageResult);

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm animate-fade-in">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <StatusIcon kind={state.kind} files={splitFiles} />
          <StatusHeading state={state} />
        </div>
        {state.kind === "success-text" && <CopyButton text={state.text} />}
        {state.kind === "success-rewriter" && <CopyButton text={state.output} />}
        {showAutoDelete && (
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
            ⏳ Auto-deletes in 1–2h
          </span>
        )}
      </div>
      <div className="p-5">
        <ResultBody state={state} />
      </div>
    </div>
  );
}

function StatusIcon({ kind, files }: { kind: ResultState["kind"]; files?: SplitOutFile[] }) {
  const map: Record<ResultState["kind"], string> = {
    idle: "⏳",
    loading: "⚙️",
    error: "⚠️",
    "success-text": "✅",
    "success-text-list": "📋",
    "success-file": "📥",
    "success-image": "🖼️",
    "success-rewriter": "✍️",
    "success-pdf-split": "✂️",
    "success-qr": "🔳",
    "success-word-counter": "🧮",
  };
  // For success-pdf-split we may be showing images, PDFs, or other files — pick an icon based on mimeType.
  if (kind === "success-pdf-split" && files && files.length > 0) {
    const mt = (files[0].mimeType ?? "").toLowerCase();
    if (mt.startsWith("image/")) return <span aria-hidden className="text-base">🗜️</span>;
    if (mt === "application/pdf" || files[0].name.toLowerCase().endsWith(".pdf"))
      return <span aria-hidden className="text-base">✂️</span>;
  }
  return <span aria-hidden className="text-base">{map[kind]}</span>;
}

function StatusHeading({ state }: { state: ResultState }) {
  switch (state.kind) {
    case "loading":
      return <span>{state.message ?? "Processing…"}</span>;
    case "error":
      return <span className="text-destructive">Couldn&apos;t complete</span>;
    case "success-text":
      return <span>Result</span>;
    case "success-text-list":
      return <span>{state.headerLabel}</span>;
    case "success-file":
      return <span>Ready to download</span>;
    case "success-image":
      return <span>Your cropped image</span>;
    case "success-rewriter":
      return <span>Rewrite complete</span>;
    case "success-pdf-split": {
      const n = state.files.length;
      const first = state.files[0];
      const mt = (first?.mimeType ?? "").toLowerCase();
      if (mt.startsWith("image/")) {
        return <span>{n} compressed image{n === 1 ? "" : "s"} ready</span>;
      }
      if (first?.name.toLowerCase().endsWith(".pdf") || mt === "application/pdf" || !first?.mimeType) {
        return <span>{n} PDF file{n === 1 ? "" : "s"} ready</span>;
      }
      return <span>{n} file{n === 1 ? "" : "s"} ready</span>;
    }
    case "success-qr":
      return <span>QR code ready</span>;
    case "success-word-counter":
      return <span>Live statistics</span>;
    default:
      return null;
  }
}

function ResultBody({ state }: { state: ResultState }) {
  switch (state.kind) {
    case "loading":
      return (
        <div className="space-y-3">
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-[width] duration-500"
              style={{ width: `${state.progressPercent ?? 15}%` }}
            />
          </div>
          {state.progressPercent === undefined ? (
            <p className="text-xs text-muted-foreground">
              Usually takes a few seconds. If busy, you&apos;ll see your queue position.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">{state.progressPercent}% complete.</p>
          )}
        </div>
      );
    case "error":
      return (
        <div className="space-y-3">
          <p className="rounded-md border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
            {state.message}
          </p>
          {state.retry && (
            <button
              onClick={state.retry}
              className="inline-flex h-9 items-center justify-center rounded-lg border border-input bg-background px-4 text-sm font-medium shadow-sm transition hover:bg-muted"
            >
              Try again
            </button>
          )}
        </div>
      );
    case "success-text":
      return (
        <div className="space-y-3">
          <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap rounded-lg bg-muted/40 p-4 text-sm leading-relaxed">
            {state.text}
          </pre>
        </div>
      );
    case "success-text-list": {
      const { items } = state;
      return (
        <div className="space-y-3">
          <div className="max-h-[420px] overflow-auto space-y-2 rounded-lg bg-muted/40 p-3">
            {items.map((line, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 rounded-md bg-background px-3 py-2 border border-border"
              >
                <span className="font-mono text-xs text-muted-foreground shrink-0 w-8">
                  {idx + 1}
                </span>
                <code className="flex-1 text-sm truncate break-all">{line}</code>
                <CopyButton text={line} />
              </div>
            ))}
          </div>
        </div>
      );
    }
    case "success-file": {
      const { fileName, sizeBytes, url, multipleUrls, preview, meta } = state;
      return (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="grid h-12 w-12 place-items-center rounded-lg bg-primary/10 text-2xl">📄</div>
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{fileName}</div>
              <div className="text-xs text-muted-foreground">
                {sizeBytes !== undefined ? formatBytes(sizeBytes) : "Ready"}
              </div>
            </div>
            {url ? (
              <a
                href={url}
                download={fileName}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90"
              >
                ⬇️ Download
              </a>
            ) : null}
            {multipleUrls && multipleUrls.length > 1 && (
              <div className="w-full">
                <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">
                  Split files ({multipleUrls.length})
                </p>
                <div className="flex flex-wrap gap-2">
                  {multipleUrls.map((u, i) => (
                    <a
                      key={u}
                      href={u}
                      download={`part-${i + 1}.pdf`}
                      className="inline-flex h-8 items-center rounded-md border border-border bg-background px-3 text-xs shadow-sm hover:bg-muted"
                    >
                      Part {i + 1} ↓
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
          {meta && Object.keys(meta).length > 0 && (
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              {Object.entries(meta).map(([k, v]) => (
                <div
                  key={k}
                  className="rounded-lg border border-border bg-muted/30 px-3 py-2"
                >
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {k.replace(/([A-Z])/g, " $1").trim()}
                  </div>
                  <div className="mt-0.5 text-sm font-medium">{v}</div>
                </div>
              ))}
            </div>
          )}
          {preview && (
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                First page preview
              </p>
              <p className="text-xs text-gray-500 whitespace-pre-wrap leading-relaxed">
                {preview}
              </p>
            </div>
          )}
        </div>
      );
    }
    case "success-image": {
      const { dataUrl, name, sizeBytes, originalSizeBytes, savingsPercent } = state;
      return (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <div className="inline-flex items-center gap-2 rounded-full bg-muted/50 px-3 py-1 text-xs font-medium">
              Before: {formatBytes(originalSizeBytes)}
            </div>
            <div className="text-muted-foreground">→</div>
            <div className="inline-flex items-center gap-2 rounded-full bg-muted/50 px-3 py-1 text-xs font-medium">
              After: {formatBytes(sizeBytes)}
            </div>
            {savingsPercent !== undefined && (
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                🎉 {savingsPercent}% smaller
              </div>
            )}
          </div>
          <div className="overflow-hidden rounded-lg border border-border bg-muted/30">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={dataUrl} alt={name} className="mx-auto max-h-[380px] w-auto object-contain" />
          </div>
          <a
            href={dataUrl}
            download={name}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90"
          >
            ⬇️ Download {name}
          </a>
        </div>
      );
    }
    case "success-rewriter": {
      const s = state;
      const simColor =
        s.similarityPercent < 50
          ? "text-emerald-600"
          : s.similarityPercent < 75
          ? "text-amber-600"
          : "text-rose-600";
      return (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <StatChip label="Output chars" value={s.outputChars.toLocaleString()} />
              <StatChip
                label="Similarity"
                value={<span className={`font-bold ${simColor}`}>{s.similarityPercent}%</span>}
              />
              {s.watermark && (
                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                  Free-tier watermark applied on copy
                </span>
              )}
              {!s.watermark && (
                <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                  Pro · no watermark
                </span>
              )}
            </div>
            {!s.sideBySideDiff && (
              <a
                href="/pricing"
                className="text-xs font-semibold text-primary underline underline-offset-2 hover:no-underline"
              >
                Unlock side-by-side diff (Pro) →
              </a>
            )}
          </div>

          {s.sideBySideDiff ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-rose-600">
                  Original
                </h4>
                <div className="max-h-[480px] overflow-auto rounded-lg bg-muted/40 p-4 text-sm leading-relaxed">
                  {s.sideBySideDiff.map((span, i) => (
                    <span
                      key={i}
                      className={
                        span.kind === "del"
                          ? "bg-rose-100/70 line-through decoration-rose-400 dark:bg-rose-950/40"
                          : "whitespace-pre-wrap"
                      }
                    >
                      {span.text}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-emerald-600">
                  Rewritten
                </h4>
                <div className="max-h-[480px] overflow-auto rounded-lg bg-muted/40 p-4 text-sm leading-relaxed">
                  {s.sideBySideDiff.map((span, i) => (
                    <span
                      key={i}
                      className={
                        span.kind === "add"
                          ? "bg-emerald-100/70 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200 whitespace-pre-wrap"
                          : span.kind === "del"
                          ? "hidden"
                          : "whitespace-pre-wrap"
                      }
                    >
                      {span.text}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <pre className="max-h-[480px] overflow-auto whitespace-pre-wrap rounded-lg bg-muted/40 p-4 text-sm leading-relaxed">
              {s.output}
              {s.watermark ? "\n\n— Generated by ToolForge" : ""}
            </pre>
          )}
        </div>
      );
    }
    case "success-pdf-split": {
      const s = state;
      return (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <div className="text-xs text-muted-foreground">
              {s.jobId ? (
                <>
                  Job <span className="font-mono text-foreground">{s.jobId}</span> ·{" "}
                </>
              ) : null}
              {s.files.length} file{s.files.length === 1 ? "" : "s"}
              {s.summary ? (
                <span className="ml-2 rounded-full bg-emerald-500/10 px-3 py-1 font-semibold text-emerald-700 dark:text-emerald-300">
                  ✓ {s.summary}
                </span>
              ) : null}
            </div>
            {s.zipDownloadUrl ? (
              <a
                href={s.zipDownloadUrl}
                download={`${s.jobId ?? "result"}.zip`}
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-xs font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90"
              >
                📦 Download all as ZIP
              </a>
            ) : (
              <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                🔒 Pro only · ZIP of all files
              </span>
            )}
          </div>
          <ul className="divide-y divide-border rounded-lg border border-border bg-background overflow-hidden">
            <li className="grid grid-cols-12 gap-2 bg-muted/40 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <div className="col-span-1">#</div>
              <div className="col-span-6">File</div>
              <div className="col-span-2 text-right">Pages</div>
              <div className="col-span-2 text-right">Size</div>
              <div className="col-span-1 text-right">↓</div>
            </li>
            {s.files.map((f, i) => (
              <li
                key={f.name + i}
                className="grid grid-cols-12 items-center gap-2 px-4 py-3 text-sm hover:bg-muted/20"
              >
                <div className="col-span-1 text-muted-foreground">{i + 1}</div>
                <div className="col-span-6 truncate font-medium">{f.name}</div>
                <div className="col-span-2 text-right font-mono text-xs">{f.pages}</div>
                <div className="col-span-2 text-right text-xs text-muted-foreground">
                  {f.sizeLabel ?? formatBytes(f.sizeBytes)}
                </div>
                <div className="col-span-1 text-right">
                  {f.downloadUrl ? (
                    <a
                      href={f.downloadUrl}
                      download={f.name}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-xs shadow-sm hover:bg-muted"
                      title={`Download ${f.name}`}
                    >
                      ⬇️
                    </a>
                  ) : (
                    <span className="inline-flex h-8 w-8 items-center justify-center text-xs text-muted-foreground/50">
                      —
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      );
    }
    case "success-qr": {
      const s = state;
      return (
        <div className="space-y-5">
          <div className="mx-auto max-w-[320px] overflow-hidden rounded-lg border border-border bg-white p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={s.pngDataUrl} alt="Generated QR code" className="h-auto w-full" />
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <a
              href={s.pngDataUrl}
              download={s.downloadName}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90"
            >
              ⬇️ PNG
            </a>
            {s.svgMarkup ? (
              <a
                href={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(s.svgMarkup)}`}
                download={s.downloadName.replace(/\.png$/i, ".svg")}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-input bg-background px-5 text-sm font-semibold shadow-sm transition hover:bg-muted"
              >
                ⬇️ SVG <span className="text-[10px] uppercase text-primary">Pro</span>
              </a>
            ) : (
              <a
                href="/pricing"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 px-5 text-sm font-semibold text-muted-foreground hover:bg-muted"
              >
                🔒 SVG (Pro)
              </a>
            )}
            {s.epsMarkup ? (
              <a
                href={`data:application/postscript;charset=utf-8,${encodeURIComponent(s.epsMarkup)}`}
                download={s.downloadName.replace(/\.png$/i, ".eps")}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-input bg-background px-5 text-sm font-semibold shadow-sm transition hover:bg-muted"
              >
                ⬇️ EPS <span className="text-[10px] uppercase text-primary">Pro</span>
              </a>
            ) : (
              <a
                href="/pricing"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 px-5 text-sm font-semibold text-muted-foreground hover:bg-muted"
              >
                🔒 EPS (Pro)
              </a>
            )}
          </div>
          <p className="text-center text-xs text-muted-foreground">
            Tip: scan with your phone camera for a quick test.
          </p>
        </div>
      );
    }
    case "success-word-counter": {
      const s = state.stats;
      return (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
            <MetricCard label="Words" value={s.words.toLocaleString()} />
            <MetricCard
              label="Characters"
              value={
                <div className="text-right">
                  <div className="text-lg font-extrabold">
                    {s.charsWithSpaces.toLocaleString()}
                  </div>
                  <div className="text-[10px] font-semibold text-muted-foreground">
                    no spaces: {s.charsWithoutSpaces.toLocaleString()}
                  </div>
                </div>
              }
              wide
            />
            <MetricCard label="Sentences" value={s.sentences.toLocaleString()} />
            <MetricCard label="Paragraphs" value={s.paragraphs.toLocaleString()} />
            <MetricCard label="Reading" value={s.readingTime} sub={`${s.words} @ words/min`} />
            <MetricCard label="Speaking" value={s.speakingTime} sub="Presentations" />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h4 className="text-sm font-semibold">Top 10 words (excluding stop words)</h4>
                <span className="text-[11px] text-muted-foreground">
                  {s.uniqueWords.toLocaleString()} unique
                </span>
              </div>
              {s.topWords.length ? (
                <ul className="space-y-1.5">
                  {s.topWords.map((t) => (
                    <li key={t.word} className="flex items-center gap-3">
                      <div className="w-20 shrink-0 truncate font-mono text-xs text-foreground/80">
                        {t.word}
                      </div>
                      <div className="relative h-6 flex-1 rounded-md bg-muted/50">
                        <div
                          className="h-full rounded-md bg-gradient-to-r from-primary/70 to-primary"
                          style={{ width: `${Math.max(2, t.pct)}%` }}
                        />
                        <div className="absolute inset-y-0 right-2 flex items-center text-[11px] font-semibold text-foreground/80 mix-blend-difference text-white">
                          {t.count}×
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyHint text="No content words yet. Type more than a few words to see frequency." />
              )}
            </section>
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h4 className="text-sm font-semibold">Long sentences ({">"} 25 words)</h4>
                <span className="text-[11px] text-muted-foreground">
                  {s.longSentences.length} flagged
                </span>
              </div>
              {s.longSentences.length ? (
                <ul className="max-h-[380px] space-y-2 overflow-auto pr-1">
                  {s.longSentences.map((l) => (
                    <li
                      key={l.index + "-" + l.startChar}
                      className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs dark:border-amber-900/50 dark:bg-amber-950/20"
                    >
                      <div className="flex items-center justify-between text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                        <span>
                          Sentence #{l.index + 1} · {l.words} words
                        </span>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded-md bg-amber-200/70 px-2 py-0.5 text-[10px] hover:bg-amber-300/70 dark:bg-amber-800/50 dark:hover:bg-amber-800/70"
                          onClick={() => {
                            const ta = document.querySelector<HTMLTextAreaElement>(
                              "textarea[name='word-counter-source']"
                            );
                            if (!ta) return;
                            ta.focus();
                            const pos = Math.min(ta.value.length, Math.max(0, l.startChar));
                            ta.setSelectionRange(pos, pos);
                            ta.scrollTop =
                              (pos / Math.max(1, ta.value.length)) * (ta.scrollHeight || 0);
                          }}
                        >
                          ↳ Jump to
                        </button>
                      </div>
                      <p className="mt-1 line-clamp-3 leading-relaxed text-foreground/85">
                        {l.text}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyHint text="Nice — no sentences over 25 words. Keep going!" />
              )}
            </section>
          </div>
        </div>
      );
    }
    default:
      return null;
  }
}

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(
            text + (text.endsWith("Generated by ToolForge") ? "" : "")
          );
          setDone(true);
          setTimeout(() => setDone(false), 1600);
        } catch {
          /* clipboard blocked */
        }
      }}
      className="inline-flex h-8 items-center gap-1.5 rounded-md border border-input bg-background px-2.5 text-xs font-medium shadow-sm transition hover:bg-muted"
    >
      {done ? "✔ Copied" : "📋 Copy"}
    </button>
  );
}

function StatChip({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/30 px-3 py-1 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold text-foreground">{value}</span>
    </div>
  );
}

function MetricCard({
  label,
  value,
  sub,
  wide,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  wide?: boolean;
}) {
  return (
    <div
      className={[
        "rounded-xl border border-border bg-background p-4 shadow-sm",
        wide ? "sm:col-span-1 col-span-2" : "",
      ].join(" ")}
    >
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-2 text-2xl font-extrabold tracking-tight">{value}</div>
      {sub && <div className="mt-1 text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div className="grid h-28 place-items-center rounded-lg border border-dashed border-border/70 bg-muted/10 p-4 text-center text-xs text-muted-foreground">
      {text}
    </div>
  );
}

export type { ResultState };
