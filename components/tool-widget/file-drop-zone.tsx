"use client";

import { useCallback, useRef, useState } from "react";

interface FileItem {
  id: string;
  file: File;
}

interface Props {
  mode: "single" | "multi";
  acceptedTypes?: string[];
  maxFileSizeMB?: number; // per file
  maxFiles?: number; // for multi mode
  files: FileItem[];
  onChange: (files: FileItem[]) => void;
  onError?: (msg: string) => void;
  /** Disable when Pro-only batch or limit reached (Module 7 guard). */
  locked?: boolean;
  lockedHint?: string;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Module 2: File Drop Zone
 *  - mode "single": compress-pdf, unlock-pdf, pdf-to-word, split-pdf, image-compressor
 *  - mode "multi": merge-pdf (sortable list with remove handle)
 *  - Validates type + size against tool tiered limits
 *  - Expansion: wire dropzone to object-storage uploader when processors ship.
 * ------------------------------------------------------------------------- */
export function FileDropZone({
  mode,
  acceptedTypes,
  maxFileSizeMB,
  maxFiles,
  files,
  onChange,
  onError,
  locked,
  lockedHint,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const addFiles = useCallback(
    (list: FileList | null) => {
      if (!list || list.length === 0) return;
      const incoming: FileItem[] = Array.from(list).map((f) => ({
        id: `${f.name}-${f.size}-${f.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
        file: f,
      }));

      // Validate type + size.
      const keep: FileItem[] = [];
      for (const item of incoming) {
        if (acceptedTypes && acceptedTypes.length) {
          const ok = acceptedTypes.some(
            (t) =>
              item.file.type === t ||
              (t.startsWith(".") && item.file.name.toLowerCase().endsWith(t.toLowerCase()))
          );
          if (!ok) {
            onError?.(`Invalid file type "${item.file.name}". Please upload ${acceptedTypes.join(", ")}.`);
            continue;
          }
        }
        if (maxFileSizeMB && item.file.size > maxFileSizeMB * 1024 * 1024) {
          onError?.(
            `"${item.file.name}" is too large (${formatSize(
              item.file.size
            )}). Max ${maxFileSizeMB} MB on Free — upgrade for larger files.`
          );
          continue;
        }
        keep.push(item);
      }

      if (mode === "single") {
        onChange(keep.slice(0, 1));
        return;
      }

      // Multi mode. Apply maxFiles cap.
      let next = [...files, ...keep];
      if (maxFiles !== undefined && next.length > maxFiles) {
        onError?.(
          `Maximum ${maxFiles} files on Free. Upgrade to Pro for unlimited batch processing.`
        );
        next = next.slice(0, maxFiles);
      }
      onChange(next);
    },
    [acceptedTypes, files, maxFileSizeMB, maxFiles, mode, onChange, onError]
  );

  const removeAt = (id: string) => onChange(files.filter((f) => f.id !== id));
  const move = (id: string, dir: -1 | 1) => {
    const i = files.findIndex((f) => f.id === id);
    if (i === -1) return;
    const j = i + dir;
    if (j < 0 || j >= files.length) return;
    const next = [...files];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  const acceptAttr = acceptedTypes?.join(",") ?? "*";
  const hasMax = mode === "multi" && maxFiles !== undefined;

  return (
    <div className="space-y-4">
      <div
        onDragEnter={(e) => {
          e.preventDefault();
          if (!locked) setDragging(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!locked) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (locked) return;
          addFiles(e.dataTransfer.files);
        }}
        onClick={() => {
          if (locked) return;
          inputRef.current?.click();
        }}
        className={[
          "group relative flex min-h-[180px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition",
          dragging
            ? "border-primary bg-primary/5"
            : locked
            ? "border-border/70 bg-muted/30 opacity-70 cursor-not-allowed"
            : "border-border hover:border-primary/50 hover:bg-muted/20",
        ].join(" ")}
      >
        <div className="pointer-events-none">
          <div
            className={[
              "mx-auto flex h-12 w-12 items-center justify-center rounded-full text-2xl transition",
              dragging ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
            ].join(" ")}
          >
            📁
          </div>
          <p className="mt-3 text-sm font-medium">
            {locked
              ? lockedHint ?? "Limit reached on Free tier"
              : mode === "single"
              ? "Click or drop a file here"
              : "Click or drop files here"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {locked
              ? "Upgrade to Pro to continue."
              : [
                  acceptedTypes ? acceptedTypes.join(", ") : "Any file",
                  maxFileSizeMB ? `· up to ${maxFileSizeMB} MB each` : "",
                  mode === "multi" && hasMax ? `· ${maxFiles} files max (Free)` : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple={mode === "multi"}
          accept={acceptAttr}
          onChange={(e) => addFiles(e.target.files)}
          className="hidden"
          disabled={locked}
        />
      </div>

      {/* File list */}
      {files.length > 0 && (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card overflow-hidden">
          {files.map((f, idx) => (
            <li
              key={f.id}
              className="flex items-center gap-3 px-4 py-3 text-sm"
            >
              {mode === "multi" && (
                <div className="flex flex-col text-muted-foreground">
                  <button
                    type="button"
                    aria-label="Move up"
                    onClick={() => move(f.id, -1)}
                    disabled={idx === 0}
                    className="h-4 w-5 rounded hover:bg-muted disabled:opacity-30"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    aria-label="Move down"
                    onClick={() => move(f.id, 1)}
                    disabled={idx === files.length - 1}
                    className="h-4 w-5 rounded hover:bg-muted disabled:opacity-30"
                  >
                    ▼
                  </button>
                </div>
              )}
              <div className="grid h-9 w-9 place-items-center rounded-md bg-muted text-lg">
                📄
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{f.file.name}</div>
                <div className="text-xs text-muted-foreground">{formatSize(f.file.size)}</div>
              </div>
              <button
                type="button"
                onClick={() => removeAt(f.id)}
                className="rounded-md p-1.5 text-sm text-muted-foreground transition hover:bg-muted hover:text-destructive"
                aria-label="Remove file"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export type { FileItem };
