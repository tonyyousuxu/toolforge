"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import type { ToolDefinition } from "@/lib/tool-registry";
import { PROCESSORS } from "@/lib/tool-registry";
import type {
  RewriterDiffSpan,
  SplitOutFile,
  WordCounterResult,
  ImageCompressResult,
  PdfToWordResult,
  PasswordGenResult,
} from "@/lib/tool-registry";
import { OptionsRow } from "./options-row";
import { FileDropZone, type FileItem } from "./file-drop-zone";
import { TextInputWidget } from "./text-input-widget";
import { ResultPanel, type ResultState } from "./result-panel";

interface Props {
  tool: ToolDefinition;
}

/* ===========================================================================
   MODULE 2 — Tool Widget Dispatcher + per-tool inline widget implementations.
   Each new WidgetType:
     1. Add type to WidgetType union (lib/tool-registry/types.ts)
     2. Add renderer branch in ToolWidget's "Widget dispatcher" section
     3. Add payload branch in onAction
     4. Add ready-case in computeReady
     5. Add result-mapper branch in mapToResultState
   =========================================================================== */
export function ToolWidget({ tool }: Props) {
  const isComingSoon = tool.status !== "live";

  // --- Options state: seeded from schema defaults ---
  // Use a lazy init so SSR + hydration both see deterministic true defaults.
  const [options, setOptions] = useState<Record<string, unknown>>(() => {
    const out: Record<string, unknown> = {};
    (tool.options ?? []).forEach((o) => {
      out[o.id] = typeof o.defaultValue === "boolean" ? Boolean(o.defaultValue) : o.defaultValue;
    });
    return out;
  });

  // Sync options when the tool changes (e.g. navigation)
  useEffect(() => {
    setOptions(() => {
      const out: Record<string, unknown> = {};
      (tool.options ?? []).forEach((o) => {
        out[o.id] = typeof o.defaultValue === "boolean" ? Boolean(o.defaultValue) : o.defaultValue;
      });
      return out;
    });
  }, [tool]);

  // --- Generic inputs used by legacy widgets ---
  const [files, setFiles] = useState<FileItem[]>([]);
  const [text, setText] = useState("");

  // --- PDF Splitter state ---
  const [pdfPageCount, setPdfPageCount] = useState<number | null>(null);

  // --- Image Cropper state ---
  const [imgDataUrl, setImgDataUrl] = useState<string>("");
  const [imgMeta, setImgMeta] = useState<{
    w: number;
    h: number;
    name: string;
    type: string;
    size: number;
  } | null>(null);
  const [crop, setCrop] = useState<{ x: number; y: number; w: number; h: number } | null>(
    null
  );

  // --- QR Generator state ---
  const [qrFields, setQrFields] = useState<Record<string, string>>({
    url: "",
    text: "",
    email: "",
    emailSubject: "",
    emailBody: "",
    phone: "",
    wifiSsid: "",
    wifiPass: "",
    wifiEnc: "WPA",
    wifiHidden: "false",
  });
  const [qrLogoData, setQrLogoData] = useState<string>("");

  // --- Word Counter state (reuses `text` but we want debounced live stats) ---
  const [wcResult, setWcResult] = useState<WordCounterResult | null>(null);
  const wcTextRef = useRef<HTMLTextAreaElement>(null);

  // --- Output state ---
  const [result, setResult] = useState<ResultState>({ kind: "idle" });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const onChangeOption = useCallback((id: string, value: unknown) => {
    setOptions((prev) => ({ ...prev, [id]: value }));
  }, []);

  const ready = useMemo(
    () => computeReady(tool, files, text, { pdfPageCount, imgMeta, qrFields, options }),
    [tool, files, text, pdfPageCount, imgMeta, qrFields, options]
  );

  // --- Word counter: compute live stats on input change (debounced 100ms) ---
  useEffect(() => {
    if (tool.widgetType !== "word-counter") return;
    const handle = window.setTimeout(async () => {
      try {
        const r = (await PROCESSORS["text/word-counter"](
          {
            text,
            readWpm: Number(options.readWpm ?? 200),
            speakWpm: Number(options.speakWpm ?? 130),
            stopLang: (options.stopLang as any) ?? "English",
          },
          options
        )) as WordCounterResult;
        setWcResult(r);
        setResult({ kind: "success-word-counter", stats: r });
      } catch {
        /* ignore */
      }
    }, 100);
    return () => window.clearTimeout(handle);
  }, [text, options.readWpm, options.speakWpm, options.stopLang, tool.widgetType]);

  // --- Image cropper: auto-populate crop rect after image loads ---
  useEffect(() => {
    if (!imgMeta) return;
    if (!crop) {
      const aspect = String(options.aspect ?? "Freeform");
      let rw = imgMeta.w;
      let rh = imgMeta.h;
      if (aspect.startsWith("1:1")) {
        const s = Math.min(rw, rh);
        setCrop({ x: Math.round((rw - s) / 2), y: Math.round((rh - s) / 2), w: s, h: s });
      } else if (aspect.startsWith("4:3")) {
        const w = Math.min(rw, Math.round((rh * 4) / 3));
        const h = Math.round((w * 3) / 4);
        setCrop({ x: Math.round((rw - w) / 2), y: Math.round((rh - h) / 2), w, h });
      } else if (aspect.startsWith("16:9")) {
        const w = Math.min(rw, Math.round((rh * 16) / 9));
        const h = Math.round((w * 9) / 16);
        setCrop({ x: Math.round((rw - w) / 2), y: Math.round((rh - h) / 2), w, h });
      } else if (aspect.startsWith("9:16")) {
        const h = Math.min(rh, Math.round((rw * 16) / 9));
        const w = Math.round((h * 9) / 16);
        setCrop({ x: Math.round((rw - w) / 2), y: Math.round((rh - h) / 2), w, h });
      } else if (aspect.startsWith("3:2")) {
        const w = Math.min(rw, Math.round((rh * 3) / 2));
        const h = Math.round((w * 2) / 3);
        setCrop({ x: Math.round((rw - w) / 2), y: Math.round((rh - h) / 2), w, h });
      } else {
        // Freeform: default to 90% of image
        const w = Math.round(rw * 0.9);
        const h = Math.round(rh * 0.9);
        setCrop({ x: Math.round((rw - w) / 2), y: Math.round((rh - h) / 2), w, h });
      }
    }
  }, [imgMeta, options.aspect]); // eslint-disable-line react-hooks/exhaustive-deps

  const onAction = useCallback(async () => {
    setErrorMsg(null);
    if (isComingSoon) {
      setResult({
        kind: "error",
        message: `${tool.name} is coming soon. Check back shortly — processor not wired yet.`,
      });
      return;
    }

    // --- Short-circuit: Image cropper and QR generator are computed client-side inside
    //     onAction to keep the single "run" UX button. Word counter is live.
    if (tool.widgetType === "image-cropper") {
      try {
        const cropped = await runClientSideCrop(imgDataUrl, crop!, options, imgMeta!);
        const resp = (await PROCESSORS["image/cropper"](
          {
            dataUrl: imgDataUrl,
            x: crop!.x,
            y: crop!.y,
            w: crop!.w,
            h: crop!.h,
            outFormat: mapFormat(String(options.format ?? "Keep original")),
            quality: Number(options.quality ?? 90),
            originalName: imgMeta!.name,
            originalType: imgMeta!.type,
            originalSizeBytes: imgMeta!.size,
            croppedDataUrl: cropped.dataUrl,
            croppedSizeBytes: cropped.sizeBytes,
          },
          options
        )) as any;
        setResult({
          kind: "success-image",
          dataUrl: resp.blobBase64,
          name: resp.downloadName,
          sizeBytes: resp.sizeBytes,
          originalSizeBytes: resp.originalSizeBytes,
        });
        return;
      } catch (e) {
        setResult({
          kind: "error",
          message: e instanceof Error ? e.message : "Crop failed.",
          retry: () => onAction(),
        });
        return;
      }
    }

    if (tool.widgetType === "qr-generator") {
      try {
        const qrOut = await runClientSideQrEncode(qrFields, options);
        const resp = (await PROCESSORS["qr/generate"](
          {
            dataType: String(options.dataType ?? "URL"),
            size: Number(options.size ?? 512),
            fgColor: String(options.fgColor ?? "#0f172a"),
            bgColor: String(options.bgColor ?? "#ffffff"),
            errorLevel: String(options.errorCorrection ?? "Medium (15%)"),
            fields: qrFields,
            plan: "free",
            pngDataUrl: qrOut.png,
            svgMarkup: qrOut.svg,
            epsMarkup: qrOut.eps,
          },
          options
        )) as any;
        setResult({
          kind: "success-qr",
          pngDataUrl: resp.pngDataUrl,
          svgMarkup: resp.svgMarkup,
          epsMarkup: resp.epsMarkup,
          downloadName: resp.downloadName,
        });
        return;
      } catch (e) {
        setResult({
          kind: "error",
          message: e instanceof Error ? e.message : "QR generation failed.",
          retry: () => onAction(),
        });
        return;
      }
    }

    if (tool.widgetType === "word-counter") {
      // Word counter runs live; the "Run" button copies the summary.
      if (wcResult) {
        const summary = `Words: ${wcResult.words.toLocaleString()} | Characters: ${wcResult.charsWithSpaces.toLocaleString()} (no spaces ${wcResult.charsWithoutSpaces.toLocaleString()}) | Sentences: ${wcResult.sentences} | Paragraphs: ${wcResult.paragraphs} | Reading time: ${wcResult.readingTime} | Speaking time: ${wcResult.speakingTime}`;
        try {
          await navigator.clipboard.writeText(summary);
          setErrorMsg("Statistics copied to clipboard.");
          setTimeout(() => setErrorMsg(null), 2200);
        } catch {
          setErrorMsg("Couldn't copy to clipboard.");
          setTimeout(() => setErrorMsg(null), 2500);
        }
      }
      return;
    }

    setResult({ kind: "loading", message: "Starting…", progressPercent: 5 });

    const processor = PROCESSORS[tool.processorId];
    if (!processor) {
      setResult({
        kind: "error",
        message: `No processor registered for "${tool.processorId}". Add it in lib/tool-registry → PROCESSORS.`,
        retry: () => onAction(),
      });
      return;
    }

    // Declare both timers OUTSIDE the try so the finally block below can
    // reliably clean them up across success, timeout, and error paths.
    // Without this, a timeout rejection would skip clearInterval() and the
    // interval would keep overwriting the error state (Retry button hidden).
    let tick: ReturnType<typeof window.setInterval> | undefined;
    let timeoutId: ReturnType<typeof window.setTimeout> | undefined;

    try {
      // --- Payload builders per widget type ---
      let payload: unknown;
      switch (tool.widgetType) {
        case "text-input": {
          // Pull out rewriter-specific options
          if (tool.processorId === "ai/rewriter") {
            payload = {
              text,
              intensity: options.intensity ?? "Balanced (restructured)",
              tone: options.tone ?? "Keep original",
              preserveKeyTerms: Boolean(options.preserveKeyTerms ?? true),
              plan: "free" as const,
            };
          } else {
            payload = { text, ...options };
          }
          break;
        }
        case "pdf-splitter": {
          // Read source file as base64 so the processor can split it with pdf-lib.
          let fileBytesBase64 = "";
          if (files[0]?.file) {
            try {
              fileBytesBase64 = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onerror = () => reject(new Error("Failed to read file"));
                reader.onload = () => {
                  const result = reader.result as string;
                  // Strip data:application/pdf;base64, prefix if present
                  const comma = result.indexOf(",");
                  resolve(comma >= 0 ? result.slice(comma + 1) : result);
                };
                reader.readAsDataURL(files[0].file);
              });
            } catch {
              /* ignore — processor will fall back to synthetic output */
            }
          }
          payload = {
            mode: String(options.mode ?? "Page ranges"),
            pageRangesText: String(options.pageRanges ?? "1-5, 6-10"),
            everyN: Number(options.everyN ?? 10),
            prefix: String(options.outName ?? "split"),
            sourcePages: pdfPageCount ?? 1,
            plan: "free" as const,
            sourceName: files[0]?.file?.name ?? "source.pdf",
            fileBytesBase64,
          };
          break;
        }
        case "multi-file":
          payload = { files: files.map((f) => f.file) };
          break;
        case "file-upload":
        case "image-client":
        case "image-server":
          payload = { file: files[0]?.file ?? null };
          break;
        case "image-compressor": {
          let fileBytesBase64 = "";
          let originalName = "";
          let originalSizeBytes = 0;
          let originalType = "";
          if (files[0]?.file) {
            originalName = files[0].file.name;
            originalSizeBytes = files[0].file.size;
            originalType = files[0].file.type;
            try {
              fileBytesBase64 = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onerror = () => reject(new Error("Failed to read file"));
                reader.onload = () => resolve(String(reader.result));
                reader.readAsDataURL(files[0].file);
              });
            } catch {
              /* ignore */
            }
          }
          payload = {
            fileBytesBase64,
            originalName,
            originalSizeBytes,
            originalType,
            mode: String(options.mode ?? "Quality slider"),
            quality: Number(options.quality ?? 75),
            targetSizeKB: Number(options.targetSizeKB ?? 300),
            maxWidth: Number(options.maxWidth ?? 0),
            maxHeight: Number(options.maxHeight ?? 0),
            format: String(options.format ?? "Original"),
            stripMeta: Boolean(options.stripMeta ?? true),
          };
          break;
        }
        case "pdf-to-word-converter": {
          let fileBytesBase64 = "";
          if (files[0]?.file) {
            try {
              fileBytesBase64 = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onerror = () => reject(new Error("Failed to read file"));
                reader.onload = () => {
                  const result = reader.result as string;
                  const comma = result.indexOf(",");
                  resolve(comma >= 0 ? result.slice(comma + 1) : result);
                };
                reader.readAsDataURL(files[0].file);
              });
            } catch {
              /* ignore */
            }
          }
          payload = {
            fileBytesBase64,
            sourceName: files[0]?.file?.name ?? "source.pdf",
            sourcePages: pdfPageCount ?? 3,
            outputFormat: String(options.outputFormat ?? ".docx") as ".docx" | ".txt",
            ocrFallback: Boolean(options.ocrFallback ?? true),
            plan: "free" as const,
          };
          break;
        }
        case "password-generator": {
          payload = {
            mode: String(options.mode ?? "Random password") as "Random password" | "Passphrase (words)",
            length: Number(options.length ?? 16),
            upper: Boolean(options.upper ?? true),
            lower: Boolean(options.lower ?? true),
            numbers: Boolean(options.numbers ?? true),
            symbols: Boolean(options.symbols ?? true),
            noAmbiguous: Boolean(options.noAmbiguous ?? true),
            words: Number(options.words ?? 4),
            separator: String(options.separator ?? "hyphen") as "hyphen" | "space" | "period" | "none",
            capitalize: Boolean(options.capitalize ?? true),
            appendNumber: Boolean(options.appendNumber ?? true),
            batchCount: Number(options.batchCount ?? 20),
            plan: "free" as const,
          };
          break;
        }
        case "calculator":
        default:
          payload = options;
      }

      let prog = 5;
      let timedOut = false;
      tick = window.setInterval(() => {
        prog = Math.min(prog + 3, 90);
        setResult({
          kind: "loading",
          message: timedOut ? "Still working (server may be compiling packages…)" : "Processing…",
          progressPercent: prog,
        });
      }, 500);

      // Safety timeout: after 90s of no response, surface a retryable error instead of
      // leaving the UI stuck at 90% forever (happens when the dev server needs to
      // compile newly installed Node packages for the first time).
      const timeoutMs = 90_000;
      const isHeavyTool = tool.processorId === "pdf/to-word";
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = window.setTimeout(() => {
          timedOut = true;
          reject(new Error(
            "Timed out after 90 seconds. " +
            (isHeavyTool
              ? "The first run always compiles PDF→Word packages on the server. "
              : "") +
            "Click Retry once — the second run is usually fast."
          ));
        }, timeoutMs);
      });

      const raw = await Promise.race([
          processor(payload, options),
          timeoutPromise,
        ]);

        let result = mapToResultState(tool, raw, { original: text });

        // For PDF Splitter / Image Compressor: convert bytesBase64 → blob URLs so downloads actually work.
        if (result.kind === "success-pdf-split") {
          const b64toUint8 = (b64: string): Uint8Array => {
            // Accept either raw base64 (PDF-splitter format) OR a full data:mime;base64,xxx URL (image format)
            let rawB64 = b64;
            const comma = b64.indexOf(",");
            if (comma >= 0 && /^data:/i.test(b64.slice(0, comma + 1))) {
              rawB64 = b64.slice(comma + 1);
            }
            const bin = atob(rawB64);
            const len = bin.length;
            const out = new Uint8Array(len);
            for (let i = 0; i < len; i++) out[i] = bin.charCodeAt(i);
            return out;
          };
          const filesWithUrls = result.files.map((f) => {
            if (f.bytesBase64) {
              try {
                const u8 = b64toUint8(f.bytesBase64);
                const blob = new Blob([u8 as BlobPart], { type: f.mimeType ?? "application/pdf" });
                const url = URL.createObjectURL(blob);
                return { ...f, downloadUrl: url };
              } catch {
                // Fallback: if bytesBase64 is a full data: URL, use it directly
                if (f.bytesBase64.startsWith("data:")) {
                  return { ...f, downloadUrl: f.bytesBase64 };
                }
                return f;
              }
            }
            return f;
          });
          result = { ...result, files: filesWithUrls };
        }

        // For PDF→Word (success-file with data: URL), convert base64 → blob URL.
        // Browsers often truncate large data URLs in <a download>, but blob URLs work reliably.
        if (result.kind === "success-file" && typeof result.url === "string" && result.url.startsWith("data:")) {
          try {
            const dataUrl = result.url;
            const comma = dataUrl.indexOf(",");
            const header = dataUrl.slice(0, comma);
            const payloadPart = comma >= 0 ? dataUrl.slice(comma + 1) : "";
            const mimeMatch = /^data:([^;,]+)/i.exec(header);
            const mime = mimeMatch?.[1] ?? "application/octet-stream";
            const isBase64 = /;\s*base64\s*(?:;|$)/i.test(header);
            let u8: Uint8Array;
            if (isBase64) {
              const bin = atob(payloadPart);
              u8 = new Uint8Array(bin.length);
              for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
            } else {
              const decoded = decodeURIComponent(payloadPart);
              u8 = new TextEncoder().encode(decoded);
            }
            const blob = new Blob([u8], { type: mime });
            result = { ...result, url: URL.createObjectURL(blob) };
          } catch {
            /* keep original data: URL on any error */
          }
        }

        setResult(result);
    } catch (e) {
      setResult({
        kind: "error",
        message: e instanceof Error ? e.message : "Something went wrong.",
        retry: () => onAction(),
      });
    } finally {
      // ALWAYS clean up both timers, no matter success or error.
      // Previously the interval was only cleared on the success path, so after
      // timeout rejection it kept firing and overwrote the error state back to
      // "loading" — hiding the Retry button and leaving UI stuck at 90%.
      if (tick !== undefined) {
        clearInterval(tick);
      }
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
    }
  }, [
    files,
    isComingSoon,
    options,
    text,
    tool,
    pdfPageCount,
    imgDataUrl,
    crop,
    imgMeta,
    qrFields,
    wcResult,
  ]);

  const onError = useCallback((msg: string) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg((cur) => (cur === msg ? null : cur)), 4500);
  }, []);

  // --- PDF Splitter: after upload, read number of pages via pdf-lib ---
  useEffect(() => {
    if (tool.widgetType !== "pdf-splitter") return;
    if (files.length === 0) {
      setPdfPageCount(null);
      return;
    }
    const f = files[0].file;
    let cancelled = false;
    (async () => {
      try {
        const { PDFDocument } = await import("pdf-lib");
        const buf = await f.arrayBuffer();
        const doc = await PDFDocument.load(new Uint8Array(buf));
        if (cancelled) return;
        setPdfPageCount(doc.getPageCount());
      } catch {
        if (cancelled) return;
        // Fallback: keep existing 10-page placeholder if pdf-lib fails
        setPdfPageCount(10);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [files, tool.widgetType]);

  // --- Image Cropper / Image Compressor: read file as data URL on upload ---
  useEffect(() => {
    if (tool.widgetType !== "image-cropper" && tool.widgetType !== "image-compressor") return;
    if (files.length === 0) {
      setImgDataUrl("");
      setImgMeta(null);
      setCrop(null);
      return;
    }
    const f = files[0].file;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      const img = new window.Image();
      img.onload = () => {
        setImgMeta({
          w: img.naturalWidth,
          h: img.naturalHeight,
          name: f.name,
          type: f.type,
          size: f.size,
        });
        setImgDataUrl(dataUrl);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(f);
  }, [files, tool.widgetType]);

  // --- PDF to Word: read page count (reuse pdfPageCount) ---
  useEffect(() => {
    if (tool.widgetType !== "pdf-to-word-converter") return;
    if (files.length === 0) {
      setPdfPageCount(null);
      return;
    }
    const f = files[0].file;
    let cancelled = false;
    (async () => {
      try {
        const { PDFDocument } = await import("pdf-lib");
        const buf = await f.arrayBuffer();
        const doc = await PDFDocument.load(new Uint8Array(buf));
        if (cancelled) return;
        setPdfPageCount(doc.getPageCount());
      } catch {
        if (cancelled) return;
        setPdfPageCount(3);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [files, tool.widgetType]);

  return (
    <div className="space-y-6">
      {/* ======= Widget dispatcher ======= */}

      {/* --- AI Rewriter / generic text-input tools --- */}
      {tool.widgetType === "text-input" && (
        <TextInputWidget
          value={text}
          onChange={setText}
          minChars={tool.minChars}
          maxChars={tool.maxChars}
          rows={8}
          placeholder={
            tool.processorId === "ai/rewriter"
              ? "Paste any article, essay, or draft (100 chars minimum) to rewrite naturally…"
              : `Paste content to ${tool.name.toLowerCase()}…`
          }
          disabled={isComingSoon}
        />
      )}

      {/* --- PDF Splitter widget --- */}
      {tool.widgetType === "pdf-splitter" && (
        <PdfSplitterWidget
          tool={tool}
          files={files}
          setFiles={setFiles}
          onError={onError}
          pdfPageCount={pdfPageCount}
          options={options}
          onChangeOption={onChangeOption}
          isComingSoon={isComingSoon}
        />
      )}

      {/* --- Image Cropper widget --- */}
      {tool.widgetType === "image-cropper" && (
        <ImageCropperWidget
          tool={tool}
          files={files}
          setFiles={setFiles}
          onError={onError}
          imgDataUrl={imgDataUrl}
          imgMeta={imgMeta}
          crop={crop}
          setCrop={setCrop}
          options={options}
          onChangeOption={onChangeOption}
          isComingSoon={isComingSoon}
        />
      )}

      {/* --- QR Generator widget --- */}
      {tool.widgetType === "qr-generator" && (
        <QrGeneratorWidget
          tool={tool}
          options={options}
          onChangeOption={onChangeOption}
          qrFields={qrFields}
          setQrFields={setQrFields}
          qrLogoData={qrLogoData}
          setQrLogoData={setQrLogoData}
          isComingSoon={isComingSoon}
        />
      )}

      {/* --- Word Counter widget --- */}
      {tool.widgetType === "word-counter" && (
        <WordCounterWidget
          text={text}
          setText={setText}
          wcTextRef={wcTextRef}
          wcResult={wcResult}
        />
      )}

      {/* --- Image Compressor widget --- */}
      {tool.widgetType === "image-compressor" && (
        <ImageCompressorWidget
          tool={tool}
          files={files}
          setFiles={setFiles}
          onError={onError}
          imgMeta={imgMeta}
          imgDataUrl={imgDataUrl}
          options={options}
          onChangeOption={onChangeOption}
          isComingSoon={isComingSoon}
        />
      )}

      {/* --- PDF to Word widget --- */}
      {tool.widgetType === "pdf-to-word-converter" && (
        <PdfToWordWidget
          tool={tool}
          files={files}
          setFiles={setFiles}
          onError={onError}
          pdfPageCount={pdfPageCount}
          options={options}
          onChangeOption={onChangeOption}
          isComingSoon={isComingSoon}
        />
      )}

      {/* --- Password Generator widget --- */}
      {tool.widgetType === "password-generator" && (
        <PasswordGeneratorWidget
          tool={tool}
          options={options}
          onChangeOption={onChangeOption}
          isComingSoon={isComingSoon}
          onGenerateText={(t) => setText(t)}
        />
      )}

      {/* --- Legacy: multi-file --- */}
      {tool.widgetType === "multi-file" && (
        <FileDropZone
          mode="multi"
          acceptedTypes={tool.acceptedFileTypes}
          maxFileSizeMB={
            typeof tool.maxFileSizeMB?.free === "number"
              ? (tool.maxFileSizeMB.free as number)
              : undefined
          }
          maxFiles={
            typeof tool.maxFiles?.free === "number" ? (tool.maxFiles.free as number) : undefined
          }
          files={files}
          onChange={setFiles}
          onError={onError}
        />
      )}

      {/* --- Legacy: file-upload / image-client / image-server --- */}
      {(tool.widgetType === "file-upload" ||
        tool.widgetType === "image-client" ||
        tool.widgetType === "image-server") && (
        <FileDropZone
          mode="single"
          acceptedTypes={tool.acceptedFileTypes}
          maxFileSizeMB={
            typeof tool.maxFileSizeMB?.free === "number"
              ? (tool.maxFileSizeMB.free as number)
              : undefined
          }
          files={files}
          onChange={setFiles}
          onError={onError}
        />
      )}

      {tool.widgetType === "calculator" && (
        <div className="rounded-xl border border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
          Calculator widget renderer — add form fields to tool.options or extend WidgetType.
        </div>
      )}

      {/* Options row (skip for word-counter / qr-generator / image-cropper / pdf-splitter / image-compressor / pdf-to-word-converter / password-generator that embed their own) */}
      {tool.options &&
        tool.options.length > 0 &&
        tool.widgetType !== "word-counter" &&
        tool.widgetType !== "qr-generator" &&
        tool.widgetType !== "image-cropper" &&
        tool.widgetType !== "pdf-splitter" &&
        tool.widgetType !== "image-compressor" &&
        tool.widgetType !== "pdf-to-word-converter" &&
        tool.widgetType !== "password-generator" && (
          <OptionsRow fields={tool.options} values={options} onChange={onChangeOption} />
        )}

      {errorMsg && (
        <div
          className={[
            "rounded-lg border px-4 py-3 text-sm",
            errorMsg.includes("copied") || errorMsg.includes("Statistics")
              ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300"
              : "border-destructive/30 bg-destructive/5 text-destructive",
          ].join(" ")}
        >
          {errorMsg}
        </div>
      )}

      {/* Action row */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <span>🆓</span> 3 operations/day ·{" "}
            <a href="/pricing" className="underline underline-offset-2 hover:text-primary">
              Go Pro
            </a>{" "}
            for unlimited.
          </span>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setResult({ kind: "idle" });
              setText("");
              setFiles([]);
              setOptions(() => {
                const out: Record<string, unknown> = {};
                (tool.options ?? []).forEach((o) => {
                  out[o.id] = typeof o.defaultValue === "boolean" ? Boolean(o.defaultValue) : o.defaultValue;
                });
                return out;
              });
              setImgDataUrl("");
              setImgMeta(null);
              setCrop(null);
              setPdfPageCount(null);
              setQrFields({
                url: "",
                text: "",
                email: "",
                emailSubject: "",
                emailBody: "",
                phone: "",
                wifiSsid: "",
                wifiPass: "",
                wifiEnc: "WPA",
                wifiHidden: "false",
              });
              setQrLogoData("");
              setWcResult(null);
            }}
            className="inline-flex h-11 items-center justify-center rounded-lg border border-input bg-background px-5 text-sm font-medium shadow-sm transition hover:bg-muted"
          >
            Reset
          </button>
          <button
            type="button"
            disabled={!ready || isComingSoon}
            onClick={onAction}
            className={[
              "inline-flex h-11 items-center justify-center gap-2 rounded-lg px-6 text-sm font-semibold shadow-sm transition",
              ready && !isComingSoon
                ? "bg-primary text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-4 focus:ring-primary/20"
                : "bg-muted text-muted-foreground cursor-not-allowed",
            ].join(" ")}
          >
            <span>{isComingSoon ? "🔒 Coming soon" : actionLabel(tool)}</span>
          </button>
        </div>
      </div>

      <ResultPanel state={result} />
    </div>
  );
}

/* ==========================================================================
   INLINE WIDGETS — Tool 2 / 3 / 4 / 5
   Each is a small component scoped to one tool. Could extract to separate
   files later; kept inline for discoverability.
   ========================================================================== */

/* ---------- Tool 2: PDF Splitter ---------- */
function PdfSplitterWidget(props: {
  tool: ToolDefinition;
  files: FileItem[];
  setFiles: (f: FileItem[]) => void;
  onError: (m: string) => void;
  pdfPageCount: number | null;
  options: Record<string, unknown>;
  onChangeOption: (id: string, v: unknown) => void;
  isComingSoon: boolean;
}) {
  const { tool, files, setFiles, onError, pdfPageCount, options, onChangeOption, isComingSoon } =
    props;

  const mode = String(options.mode ?? "Page ranges");
  const everyN = Number(options.everyN ?? 10);

  // Auto-generate sensible default ranges when we detect the page count
  // and the user hasn't manually edited the ranges yet.
  const DEFAULT_RANGES = "1-5, 6-10, 11-end";
  const currentRanges = String(options.pageRanges ?? DEFAULT_RANGES);
  const pageRangesText = useMemo(() => {
    if (!pdfPageCount) return currentRanges;
    // If the user has already edited away from the default, keep their text
    if (currentRanges !== DEFAULT_RANGES) return currentRanges;
    // Generate sensible defaults based on page count
    const total = pdfPageCount;
    if (total <= 3) return `1-${total}`;
    if (total <= 6) return `1-${Math.ceil(total / 2)}, ${Math.ceil(total / 2) + 1}-${total}`;
    // 7+ pages: split into ~3 roughly equal chunks
    const chunk = Math.ceil(total / 3);
    const parts: string[] = [];
    for (let i = 0; i < 3; i++) {
      const s = i * chunk + 1;
      const e = Math.min(total, (i + 1) * chunk);
      if (s <= e) parts.push(`${s}-${e}`);
    }
    return parts.join(", ");
  }, [pdfPageCount, currentRanges]);
  const hasFile = files.length === 1;

  // Live preview of output count (matches server-side logic)
  const previewCount = useMemo(() => {
    if (!pdfPageCount) return 0;
    const total = pdfPageCount;
    if (mode.includes("Fixed")) {
      const n = Math.max(1, everyN);
      return Math.ceil(total / n);
    }
    if (mode.includes("Bookmark")) {
      // Demo mode: split into up to 3 equal chunks (matching processor fallback)
      return Math.min(3, Math.max(1, total));
    }
    // Parse range text (same normalization as parsePageRanges)
    const norm = (pageRangesText ?? "").trim();
    if (!norm) return 0;
    let count = 0;
    for (const chunk of norm.split(",").map((c) => c.trim()).filter(Boolean)) {
      if (chunk.includes("-")) {
        const [a, b] = chunk.split("-").map((s) => s.trim().toLowerCase());
        const start = Math.max(1, Math.min(total, parseInt(a || "1", 10) || 1));
        const endRaw = b === "end" || b === "" ? total : parseInt(b, 10);
        const end = isNaN(endRaw) ? total : Math.min(total, endRaw);
        if (start <= end) count++;
      } else {
        const n = parseInt(chunk, 10);
        if (!isNaN(n) && n >= 1 && n <= total) count++;
      }
    }
    return Math.max(0, count);
  }, [mode, everyN, pageRangesText, pdfPageCount]);

  return (
    <div className="space-y-4">
      <FileDropZone
        mode="single"
        acceptedTypes={tool.acceptedFileTypes}
        maxFileSizeMB={
          typeof tool.maxFileSizeMB?.free === "number"
            ? (tool.maxFileSizeMB.free as number)
            : undefined
        }
        files={files}
        onChange={setFiles}
        onError={onError}
        locked={isComingSoon}
        lockedHint="Coming soon"
      />

      {hasFile && (
        <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-4">
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <span className="rounded-full bg-background px-3 py-1 text-muted-foreground border border-border">
              📄 {files[0].file.name}
            </span>
            {pdfPageCount && (
              <span className="rounded-full bg-background px-3 py-1 text-muted-foreground border border-border">
                ~ {pdfPageCount} pages detected
              </span>
            )}
            <span className="rounded-full bg-primary/10 px-3 py-1 text-primary font-semibold">
              → {previewCount} output file{previewCount === 1 ? "" : "s"}
            </span>
          </div>

          {/* Split mode selector */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-foreground/80">Split by</label>
              <select
                disabled={isComingSoon}
                value={mode}
                onChange={(e) => onChangeOption("mode", e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option>Page ranges (e.g. 1-3, 4-6, 7-10)</option>
                <option>Fixed count — every N pages</option>
                <option>Bookmark sections (top-level outline)</option>
              </select>
            </div>

            {mode.includes("Fixed") && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-foreground/80">
                  Split every N pages
                </label>
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={everyN}
                  onChange={(e) => onChangeOption("everyN", Number(e.target.value))}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            )}

            {mode.startsWith("Page") && (
              <div className="sm:col-span-2 flex flex-col gap-1.5">
                <label className="text-xs font-medium text-foreground/80">
                  Page ranges <span className="text-muted-foreground">(comma separated)</span>
                </label>
                <input
                  type="text"
                  value={pageRangesText}
                  onChange={(e) => onChangeOption("pageRanges", e.target.value)}
                  placeholder="1-5, 6-10, 11-end"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <p className="text-[11px] text-muted-foreground">
                  Use <code>end</code> for last page. e.g.{" "}
                  <code className="rounded bg-muted px-1">1-3, 5, 7-end</code>
                </p>
              </div>
            )}

            {mode.includes("Bookmark") && (
              <div className="sm:col-span-2 rounded-lg border border-dashed border-border/70 bg-muted/30 p-3 text-xs text-muted-foreground">
                📚 Bookmark mode: will split by top-level PDF outline items. Demo shows 3
                placeholder bookmark groups.{" "}
                <a href="/pricing" className="underline underline-offset-2 text-primary">
                  Pro upgrade
                </a>{" "}
                preserves nested outlines.
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-foreground/80">Output prefix</label>
              <input
                type="text"
                value={String(options.outName ?? "split")}
                onChange={(e) => onChangeOption("outName", e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <p className="text-[11px] text-muted-foreground">
                → split-01.pdf, split-02.pdf…
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Tool 3: Image Cropper ---------- */
function ImageCropperWidget(props: {
  tool: ToolDefinition;
  files: FileItem[];
  setFiles: (f: FileItem[]) => void;
  onError: (m: string) => void;
  imgDataUrl: string;
  imgMeta: { w: number; h: number; name: string; type: string; size: number } | null;
  crop: { x: number; y: number; w: number; h: number } | null;
  setCrop: (c: { x: number; y: number; w: number; h: number } | null) => void;
  options: Record<string, unknown>;
  onChangeOption: (id: string, v: unknown) => void;
  isComingSoon: boolean;
}) {
  const {
    tool,
    files,
    setFiles,
    onError,
    imgDataUrl,
    imgMeta,
    crop,
    setCrop,
    options,
    onChangeOption,
    isComingSoon,
  } = props;

  const aspect = String(options.aspect ?? "Freeform");
  const lockAspect = Boolean(options.lockAspect ?? true);
  const dispRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    handle: "move" | "nw" | "ne" | "sw" | "se" | null;
  } | null>(null);

  const onImgMouseDown = (e: React.MouseEvent, handle: "move" | "nw" | "ne" | "sw" | "se") => {
    if (!crop || !dispRef.current) return;
    // Compute scale: displayed size vs natural
    const dispImg = dispRef.current.querySelector("img") as HTMLImageElement | null;
    if (!dispImg) return;
    const scaleX = imgMeta!.w / dispImg.clientWidth;
    const scaleY = imgMeta!.h / dispImg.clientHeight;
    dragRef.current = {
      startX: e.clientX * scaleX,
      startY: e.clientY * scaleY,
      origX: crop.x,
      origY: crop.y,
      handle,
    };
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current || !crop) return;
      const dx = ev.clientX * scaleX - dragRef.current.startX;
      const dy = ev.clientY * scaleY - dragRef.current.startY;
      let { x, y, w, h } = crop;
      const H = dragRef.current.handle;
      if (H === "move") {
        x = Math.max(0, Math.min(imgMeta!.w - w, dragRef.current.origX + dx));
        y = Math.max(0, Math.min(imgMeta!.h - h, dragRef.current.origY + dy));
      } else if (H) {
        if (H.includes("e")) w = Math.max(10, crop.w + dx);
        if (H.includes("w")) {
          const newW = Math.max(10, crop.w - dx);
          const diff = newW - crop.w;
          x = crop.x - diff;
          w = newW;
        }
        if (H.includes("s")) h = Math.max(10, crop.h + dy);
        if (H.includes("n")) {
          const newH = Math.max(10, crop.h - dy);
          const diff = newH - crop.h;
          y = crop.y - diff;
          h = newH;
        }
        // Clamp
        if (x < 0) {
          w += x;
          x = 0;
        }
        if (y < 0) {
          h += y;
          y = 0;
        }
        if (x + w > imgMeta!.w) w = imgMeta!.w - x;
        if (y + h > imgMeta!.h) h = imgMeta!.h - y;
        // Lock aspect ratio if requested
        if (lockAspect && !aspect.startsWith("Freeform")) {
          let targetRatio = 0;
          if (aspect.startsWith("1:1")) targetRatio = 1;
          else if (aspect.startsWith("4:3")) targetRatio = 4 / 3;
          else if (aspect.startsWith("16:9")) targetRatio = 16 / 9;
          else if (aspect.startsWith("9:16")) targetRatio = 9 / 16;
          else if (aspect.startsWith("3:2")) targetRatio = 3 / 2;
          if (targetRatio > 0) {
            // Adjust height to match width's ratio
            const desiredH = Math.round(w / targetRatio);
            if (desiredH <= imgMeta!.h - y) h = desiredH;
            else {
              h = imgMeta!.h - y;
              w = Math.round(h * targetRatio);
            }
          }
        }
      }
      setCrop({ x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) });
    };
    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  return (
    <div className="space-y-4">
      {!imgMeta && (
        <FileDropZone
          mode="single"
          acceptedTypes={tool.acceptedFileTypes}
          maxFileSizeMB={
            typeof tool.maxFileSizeMB?.free === "number"
              ? (tool.maxFileSizeMB.free as number)
              : undefined
          }
          files={files}
          onChange={setFiles}
          onError={onError}
          locked={isComingSoon}
        />
      )}

      {imgMeta && crop && (
        <div className="space-y-4">
          {/* Controls */}
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 rounded-xl border border-border bg-muted/20 p-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-foreground/80">Aspect ratio</label>
              <select
                value={aspect}
                onChange={(e) => {
                  onChangeOption("aspect", e.target.value);
                  setCrop(null); // reset crop for new aspect ratio
                }}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option>Freeform</option>
                <option>1:1 (square)</option>
                <option>4:3</option>
                <option>16:9 (landscape)</option>
                <option>9:16 (portrait)</option>
                <option>3:2</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5 items-start">
              <label className="text-xs font-medium text-foreground/80 pt-0.5">
                Lock aspect ratio
              </label>
              <div className="flex items-center gap-2 h-[38px]">
                <button
                  type="button"
                  role="switch"
                  aria-checked={lockAspect}
                  onClick={() => onChangeOption("lockAspect", !lockAspect)}
                  className={[
                    "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30",
                    lockAspect ? "bg-primary" : "bg-input",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition-transform",
                      lockAspect ? "translate-x-5" : "translate-x-0",
                    ].join(" ")}
                  />
                </button>
                <span className="text-xs text-muted-foreground">
                  {lockAspect ? "Locked" : "Free"}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-1.5 sm:col-span-2 md:col-span-1">
              <label className="text-xs font-medium text-foreground/80">
                Width × Height (px)
              </label>
              <div className="flex gap-2 items-center">
                <input
                  type="number"
                  min={1}
                  max={10000}
                  value={crop.w}
                  onChange={(e) => {
                    const w = Math.max(1, Math.min(imgMeta.w - crop.x, Number(e.target.value)));
                    let h = crop.h;
                    if (lockAspect && !aspect.startsWith("Freeform")) {
                      let r = 0;
                      if (aspect.startsWith("1:1")) r = 1;
                      else if (aspect.startsWith("4:3")) r = 4 / 3;
                      else if (aspect.startsWith("16:9")) r = 16 / 9;
                      else if (aspect.startsWith("9:16")) r = 9 / 16;
                      else if (aspect.startsWith("3:2")) r = 3 / 2;
                      if (r > 0) h = Math.min(imgMeta.h - crop.y, Math.max(1, Math.round(w / r)));
                    }
                    setCrop({ ...crop, w, h });
                    onChangeOption("width", w);
                    onChangeOption("height", h);
                  }}
                  className="w-full rounded-lg border border-input bg-background px-2 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <span className="text-muted-foreground">×</span>
                <input
                  type="number"
                  min={1}
                  max={10000}
                  value={crop.h}
                  onChange={(e) => {
                    const h = Math.max(1, Math.min(imgMeta.h - crop.y, Number(e.target.value)));
                    let w = crop.w;
                    if (lockAspect && !aspect.startsWith("Freeform")) {
                      let r = 0;
                      if (aspect.startsWith("1:1")) r = 1;
                      else if (aspect.startsWith("4:3")) r = 4 / 3;
                      else if (aspect.startsWith("16:9")) r = 16 / 9;
                      else if (aspect.startsWith("9:16")) r = 9 / 16;
                      else if (aspect.startsWith("3:2")) r = 3 / 2;
                      if (r > 0) w = Math.min(imgMeta.w - crop.x, Math.max(1, Math.round(h * r)));
                    }
                    setCrop({ ...crop, w, h });
                    onChangeOption("width", w);
                    onChangeOption("height", h);
                  }}
                  className="w-full rounded-lg border border-input bg-background px-2 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-foreground/80">Output format</label>
              <select
                value={String(options.format ?? "Keep original")}
                onChange={(e) => onChangeOption("format", e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option>Keep original</option>
                <option>JPG</option>
                <option>WebP</option>
                <option>PNG</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5 sm:col-span-2 md:col-span-2">
              <label className="text-xs font-medium text-foreground/80 flex items-center justify-between">
                <span>Quality (JPG / WebP)</span>
                <span className="font-mono text-muted-foreground">
                  {Number(options.quality ?? 90)}%
                </span>
              </label>
              <div className="flex items-center gap-3 h-[38px]">
                <input
                  type="range"
                  min={10}
                  max={100}
                  step={1}
                  value={Number(options.quality ?? 90)}
                  onChange={(e) => onChangeOption("quality", Number(e.target.value))}
                  className="h-2 w-full cursor-pointer accent-primary"
                />
              </div>
            </div>
          </div>

          {/* Crop preview */}
          <div
            ref={dispRef}
            className="relative overflow-hidden rounded-xl border border-border bg-[repeating-conic-gradient(#f8fafc_0%_25%,#e2e8f0_0%_50%)] bg-[length:16px_16px] dark:bg-[repeating-conic-gradient(#0f172a_0%_25%,#1e293b_0%_50%)] dark:bg-[length:16px_16px] inline-block max-w-full select-none"
            style={{ lineHeight: 0 }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imgDataUrl}
              alt="To crop"
              className="max-w-full max-h-[520px] w-auto h-auto block"
              draggable={false}
            />
            {/* Dim overlay */}
            <CropOverlay
              imgMeta={imgMeta}
              crop={crop}
              onDrag={onImgMouseDown}
            />
          </div>

          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span className="rounded-full bg-muted/50 px-3 py-1">
              📐 Original: {imgMeta.w} × {imgMeta.h}
            </span>
            <span className="rounded-full bg-primary/10 px-3 py-1 text-primary font-semibold">
              ✂️ Crop: {crop.w} × {crop.h} ({(crop.w * crop.h).toLocaleString()} px²)
            </span>
            <span className="rounded-full bg-muted/50 px-3 py-1">
              💾 {(imgMeta.size / 1024).toFixed(1)} KB
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function CropOverlay({
  imgMeta,
  crop,
  onDrag,
}: {
  imgMeta: { w: number; h: number };
  crop: { x: number; y: number; w: number; h: number };
  onDrag: (e: React.MouseEvent, h: "move" | "nw" | "ne" | "sw" | "se") => void;
}) {
  // The overlay is an absolutely positioned <div> covering the image container.
  // It renders 4 dimmed "outside crop" rectangles, plus the crop border + handles.
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState({ x: 1, y: 1 });

  useEffect(() => {
    const r = ref.current;
    if (!r) return;
    const parentImg = (r.parentElement as HTMLElement).querySelector("img") as HTMLImageElement;
    if (!parentImg) return;
    const measure = () => {
      setScale({
        x: parentImg.clientWidth / imgMeta.w,
        y: parentImg.clientHeight / imgMeta.h,
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(parentImg);
    return () => ro.disconnect();
  }, [imgMeta.w, imgMeta.h]);

  const sx = scale.x;
  const sy = scale.y;
  const cx = crop.x * sx;
  const cy = crop.y * sy;
  const cw = crop.w * sx;
  const ch = crop.h * sy;

  return (
    <div
      ref={ref}
      className="absolute inset-0"
      style={{ width: imgMeta.w * sx, height: imgMeta.h * sy, pointerEvents: "none" }}
    >
      {/* Top dim */}
      <div
        className="absolute top-0 left-0 right-0 bg-black/50"
        style={{ height: cy }}
      />
      {/* Bottom dim */}
      <div
        className="absolute bottom-0 left-0 right-0 bg-black/50"
        style={{ height: Math.max(0, imgMeta.h * sy - (cy + ch)) }}
      />
      {/* Left dim */}
      <div
        className="absolute bg-black/50"
        style={{ left: 0, top: cy, width: cx, height: ch }}
      />
      {/* Right dim */}
      <div
        className="absolute bg-black/50"
        style={{
          left: cx + cw,
          top: cy,
          width: Math.max(0, imgMeta.w * sx - (cx + cw)),
          height: ch,
        }}
      />
      {/* Crop border */}
      <div
        className="absolute border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.3)]"
        style={{
          left: cx,
          top: cy,
          width: cw,
          height: ch,
          pointerEvents: "auto",
          cursor: "move",
        }}
        onMouseDown={(e) => onDrag(e, "move")}
      >
        {/* Corner handles */}
        {(["nw", "ne", "sw", "se"] as const).map((h) => (
          <div
            key={h}
            className="absolute h-3.5 w-3.5 bg-white border border-black/40 rounded-sm"
            style={{
              left: h.includes("w") ? -7 : undefined,
              right: h.includes("e") ? -7 : undefined,
              top: h.includes("n") ? -7 : undefined,
              bottom: h.includes("s") ? -7 : undefined,
              cursor:
                h === "nw" || h === "se" ? "nwse-resize" : "nesw-resize",
              pointerEvents: "auto",
            }}
            onMouseDown={(e) => {
              e.stopPropagation();
              onDrag(e, h);
            }}
          />
        ))}
      </div>
    </div>
  );
}

/* ---------- Tool 4: QR Generator ---------- */
function QrGeneratorWidget(props: {
  tool: ToolDefinition;
  options: Record<string, unknown>;
  onChangeOption: (id: string, v: unknown) => void;
  qrFields: Record<string, string>;
  setQrFields: (f: Record<string, string>) => void;
  qrLogoData: string;
  setQrLogoData: (s: string) => void;
  isComingSoon: boolean;
}) {
  const { options, onChangeOption, qrFields, setQrFields, qrLogoData, setQrLogoData, isComingSoon } =
    props;
  const dataType = String(options.dataType ?? "URL");
  const size = Number(options.size ?? 512);
  const fg = String(options.fgColor ?? "#0f172a");
  const bg = String(options.bgColor ?? "#ffffff");
  const ec = String(options.errorCorrection ?? "Medium (15%)");

  const setField = (k: string, v: string) => setQrFields({ ...qrFields, [k]: v });

  const TYPES: Array<{ id: string; label: string; icon: string }> = [
    { id: "Text", label: "Text", icon: "📝" },
    { id: "URL", label: "URL", icon: "🔗" },
    { id: "Email", label: "Email", icon: "✉️" },
    { id: "Phone", label: "Phone", icon: "📞" },
    { id: "Wi-Fi", label: "Wi-Fi", icon: "📶" },
  ];

  return (
    <div className="grid gap-5 lg:grid-cols-5 rounded-xl border border-border bg-muted/20 p-4">
      {/* LEFT: Inputs */}
      <div className="lg:col-span-3 space-y-4">
        {/* Type selector */}
        <div>
          <label className="text-xs font-medium text-foreground/80">Content type</label>
          <div className="mt-2 grid grid-cols-5 gap-2">
            {TYPES.map((t) => (
              <button
                key={t.id}
                type="button"
                disabled={isComingSoon}
                onClick={() => onChangeOption("dataType", t.id)}
                className={[
                  "flex flex-col items-center justify-center gap-1 rounded-lg border px-2 py-3 text-xs font-medium transition shadow-sm",
                  dataType === t.id
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-background hover:bg-muted",
                ].join(" ")}
              >
                <span className="text-lg leading-none">{t.icon}</span>
                <span>{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Dynamic fields */}
        <div className="space-y-3">
          {dataType === "Text" && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-foreground/80">Text to encode</label>
              <textarea
                value={qrFields.text}
                onChange={(e) => setField("text", e.target.value)}
                rows={5}
                placeholder="Type any text…"
                className="w-full rounded-lg border border-input bg-background p-3 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                style={{ resize: "vertical" }}
              />
            </div>
          )}

          {dataType === "URL" && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-foreground/80">URL</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={qrFields.url}
                  onChange={(e) => setField("url", e.target.value)}
                  placeholder="https://example.com"
                  className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                {qrFields.url && (
                  <a
                    href={qrFields.url.startsWith("http") ? qrFields.url : `https://${qrFields.url}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-10 items-center rounded-lg border border-input bg-background px-3 text-xs font-medium shadow-sm hover:bg-muted"
                  >
                    Test link ↗
                  </a>
                )}
              </div>
            </div>
          )}

          {dataType === "Email" && (
            <div className="space-y-2.5">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-foreground/80">Email address</label>
                <input
                  type="email"
                  value={qrFields.email}
                  onChange={(e) => setField("email", e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-foreground/80">
                  Subject <span className="text-muted-foreground">(optional)</span>
                </label>
                <input
                  type="text"
                  value={qrFields.emailSubject}
                  onChange={(e) => setField("emailSubject", e.target.value)}
                  placeholder="Hello"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-foreground/80">
                  Body <span className="text-muted-foreground">(optional)</span>
                </label>
                <textarea
                  value={qrFields.emailBody}
                  onChange={(e) => setField("emailBody", e.target.value)}
                  rows={3}
                  placeholder="Message body…"
                  className="w-full rounded-lg border border-input bg-background p-3 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  style={{ resize: "vertical" }}
                />
              </div>
            </div>
          )}

          {dataType === "Phone" && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-foreground/80">Phone number</label>
              <input
                type="tel"
                value={qrFields.phone}
                onChange={(e) => setField("phone", e.target.value)}
                placeholder="+1 555 123 4567"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          )}

          {dataType === "Wi-Fi" && (
            <div className="space-y-2.5">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-foreground/80">SSID (network name)</label>
                <input
                  type="text"
                  value={qrFields.wifiSsid}
                  onChange={(e) => setField("wifiSsid", e.target.value)}
                  placeholder="MyHomeWifi"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-foreground/80">Password</label>
                <input
                  type="password"
                  value={qrFields.wifiPass}
                  onChange={(e) => setField("wifiPass", e.target.value)}
                  placeholder="password123"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-foreground/80">Encryption</label>
                  <select
                    value={qrFields.wifiEnc ?? "WPA"}
                    onChange={(e) => setField("wifiEnc", e.target.value)}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="WPA">WPA / WPA2</option>
                    <option value="WEP">WEP</option>
                    <option value="nopass">None (open)</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5 items-start">
                  <label className="text-xs font-medium text-foreground/80 pt-0.5">
                    Hidden network
                  </label>
                  <div className="flex items-center gap-2 h-[38px]">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={qrFields.wifiHidden === "true"}
                      onClick={() =>
                        setField("wifiHidden", qrFields.wifiHidden === "true" ? "false" : "true")
                      }
                      className={[
                        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors",
                        qrFields.wifiHidden === "true" ? "bg-primary" : "bg-input",
                      ].join(" ")}
                    >
                      <span
                        className={[
                          "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition-transform",
                          qrFields.wifiHidden === "true" ? "translate-x-5" : "translate-x-0",
                        ].join(" ")}
                      />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Customization panel */}
        <div className="grid gap-4 sm:grid-cols-2 border-t border-border pt-4 mt-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-foreground/80">
              Size: <span className="font-mono text-muted-foreground">{size}px</span>
            </label>
            <div className="h-[38px] flex items-center gap-3">
              <input
                type="range"
                min={128}
                max={1024}
                step={32}
                value={size}
                onChange={(e) => onChangeOption("size", Number(e.target.value))}
                className="h-2 w-full cursor-pointer accent-primary"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-foreground/80">Error correction</label>
            <select
              value={ec}
              onChange={(e) => onChangeOption("errorCorrection", e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option>Low (7%)</option>
              <option>Medium (15%)</option>
              <option>Quartile (25%)</option>
              <option>High (30%)</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-foreground/80">Foreground</label>
            <div className="flex gap-2 items-center">
              <input
                type="color"
                value={fg}
                onChange={(e) => onChangeOption("fgColor", e.target.value)}
                className="h-10 w-12 rounded-md border border-input bg-background cursor-pointer"
              />
              <input
                type="text"
                value={fg}
                onChange={(e) => onChangeOption("fgColor", e.target.value)}
                className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm font-mono shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-foreground/80">Background</label>
            <div className="flex gap-2 items-center">
              <input
                type="color"
                value={bg}
                onChange={(e) => onChangeOption("bgColor", e.target.value)}
                className="h-10 w-12 rounded-md border border-input bg-background cursor-pointer"
              />
              <input
                type="text"
                value={bg}
                onChange={(e) => onChangeOption("bgColor", e.target.value)}
                className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm font-mono shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <label className="text-xs font-medium text-foreground/80 flex items-center justify-between">
              <span>
                Logo overlay{" "}
                <span className="ml-1 rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                  PRO
                </span>
              </span>
            </label>
            <div className="flex gap-2 items-center">
              {qrLogoData ? (
                <div className="flex gap-2 items-center flex-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qrLogoData}
                    alt="QR logo"
                    className="h-10 w-10 rounded-md border border-border object-contain bg-white"
                  />
                  <span className="text-xs text-muted-foreground truncate flex-1">
                    Logo loaded. Only visible when Pro is active and EC ≥ Medium.
                  </span>
                  <button
                    type="button"
                    onClick={() => setQrLogoData("")}
                    className="rounded-md p-1.5 text-xs text-muted-foreground hover:bg-muted"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <label className="flex-1 inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-background px-3 text-xs font-medium shadow-sm hover:bg-muted cursor-pointer">
                  📎 Upload logo (≤ 50 KB)
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      if (f.size > 50 * 1024) return;
                      const r = new FileReader();
                      r.onload = () => setQrLogoData(String(r.result));
                      r.readAsDataURL(f);
                    }}
                  />
                </label>
              )}
              <a
                href="/pricing"
                className="inline-flex h-10 items-center rounded-lg border border-border/70 bg-muted/30 px-3 text-xs font-semibold text-muted-foreground hover:bg-muted"
              >
                🔒 Unlock Pro
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT: Live preview */}
      <div className="lg:col-span-2">
        <div className="sticky top-4 space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Live preview
          </div>
          <QrLivePreview
            dataType={dataType as any}
            fields={qrFields}
            size={Math.min(360, size)}
            fgColor={fg}
            bgColor={bg}
            ec={ec}
            logoDataUrl={qrLogoData}
          />
          <p className="text-[11px] text-muted-foreground text-center">
            Preview updates as you type. Click <b>Download QR Code</b> below.
          </p>
        </div>
      </div>
    </div>
  );
}

function QrLivePreview(props: {
  dataType: "Text" | "URL" | "Email" | "Phone" | "Wi-Fi";
  fields: Record<string, string>;
  size: number;
  fgColor: string;
  bgColor: string;
  ec: string;
  logoDataUrl: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    renderQrToCanvas(canvasRef.current, props);
  }, [props.dataType, props.fields, props.size, props.fgColor, props.bgColor, props.ec, props.logoDataUrl]);
  return (
    <div
      className="rounded-xl border border-border p-3 bg-white flex items-center justify-center"
      style={{ minHeight: props.size + 24 }}
    >
      <canvas
        ref={canvasRef}
        width={props.size}
        height={props.size}
        style={{ width: "100%", maxWidth: props.size, height: "auto" }}
      />
    </div>
  );
}

/* ---------- Tool 5: Word Counter ---------- */
function WordCounterWidget(props: {
  text: string;
  setText: (t: string) => void;
  wcTextRef: React.RefObject<HTMLTextAreaElement>;
  wcResult: WordCounterResult | null;
}) {
  const { text, setText, wcTextRef, wcResult } = props;
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            No length cap · runs 100% in your browser. Nothing is uploaded.
          </span>
          <button
            type="button"
            onClick={() => setText("")}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs shadow-sm hover:bg-muted"
          >
            🗑 Clear
          </button>
        </div>
        <textarea
          ref={wcTextRef}
          name="word-counter-source"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={18}
          placeholder="Start typing or paste your essay, article, speech, or blog post here.

Words, characters, sentences, paragraphs, reading time and speaking time update in real time.

Scroll down on the right for top-10 word frequency and long-sentence analysis."
          className="w-full rounded-xl border border-input bg-background p-4 text-sm shadow-sm transition placeholder:text-muted-foreground/80 focus:outline-none focus:ring-4 focus:border-primary focus:ring-primary/10 font-mono leading-relaxed"
          style={{ resize: "vertical" }}
        />
      </div>

      <div className="space-y-2">
        <div className="text-xs text-muted-foreground">
          Tip: button below copies the summary. Top 10 words &amp; long-sentence list inside
          the expanded result panel.
        </div>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
          <MiniStat label="Words" value={wcResult?.words ?? 0} />
          <MiniStat
            label="Characters"
            value={`${wcResult?.charsWithSpaces ?? 0}`}
            sub={`no spaces: ${wcResult?.charsWithoutSpaces ?? 0}`}
          />
          <MiniStat label="Sentences" value={wcResult?.sentences ?? 0} />
          <MiniStat label="Paragraphs" value={wcResult?.paragraphs ?? 0} />
          <MiniStat label="Reading" value={wcResult?.readingTime ?? "0s"} sub="at your WPM" />
          <MiniStat label="Speaking" value={wcResult?.speakingTime ?? "0s"} sub="presentations" />
        </div>

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-2 mt-2">
          <MiniStat label="Unique" value={wcResult?.uniqueWords ?? 0} sub="distinct words" />
          <MiniStat
            label="Top word"
            value={wcResult?.topWords?.[0]?.word ?? "—"}
            sub={wcResult?.topWords?.[0] ? `${wcResult.topWords[0].count}×` : "type more"}
          />
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="rounded-xl border border-border bg-background p-3 shadow-sm">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-xl font-extrabold tracking-tight">{value}</div>
      {sub && <div className="mt-0.5 text-[10px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

/* ==========================================================================
   Image Compressor Widget
   ========================================================================== */

function ImageCompressorWidget(props: {
  tool: ToolDefinition;
  files: FileItem[];
  setFiles: (f: FileItem[]) => void;
  onError: (msg: string) => void;
  imgMeta: { w: number; h: number; name: string; type: string; size: number } | null;
  imgDataUrl: string;
  options: Record<string, unknown>;
  onChangeOption: (id: string, value: unknown) => void;
  isComingSoon?: boolean;
}) {
  const { tool, files, setFiles, onError, imgMeta, imgDataUrl, options, onChangeOption } = props;

  return (
    <div className="space-y-4">
      <FileDropZone
        mode="single"
        acceptedTypes={tool.acceptedFileTypes ?? ["image/png", "image/jpeg", "image/webp"]}
        files={files}
        onChange={setFiles}
        onError={onError}
      />

      {imgMeta && (
        <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
          <div className="flex items-start gap-4">
            <div className="relative overflow-hidden rounded-lg border border-border bg-background shrink-0 w-28 h-28">
              {imgDataUrl ? (
                <img src={imgDataUrl} alt="Preview" className="w-full h-full object-contain" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                  no preview
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0 space-y-1">
              <div className="font-semibold text-sm truncate">{imgMeta.name}</div>
              <div className="text-xs text-muted-foreground">
                {imgMeta.w} × {imgMeta.h} px · {formatBytes(imgMeta.size)} · {imgMeta.type || "image"}
              </div>
              <div className="text-xs text-muted-foreground pt-1 italic">
                Estimated savings: after compress — hit run.
              </div>
            </div>
          </div>
        </div>
      )}

      {tool.options && tool.options.length > 0 && (
        <OptionsRow fields={tool.options} values={options} onChange={onChangeOption} />
      )}
    </div>
  );
}

/* ==========================================================================
   PDF to Word Widget
   ========================================================================== */

function PdfToWordWidget(props: {
  tool: ToolDefinition;
  files: FileItem[];
  setFiles: (f: FileItem[]) => void;
  onError: (msg: string) => void;
  pdfPageCount: number | null;
  options: Record<string, unknown>;
  onChangeOption: (id: string, value: unknown) => void;
  isComingSoon?: boolean;
}) {
  const { tool, files, setFiles, onError, pdfPageCount, options, onChangeOption } = props;

  return (
    <div className="space-y-4">
      <FileDropZone
        mode="single"
        acceptedTypes={tool.acceptedFileTypes ?? ["application/pdf"]}
        files={files}
        onChange={setFiles}
        onError={onError}
      />

      {files[0] && (
        <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-2">
          <div className="font-semibold text-sm truncate">{files[0].file.name}</div>
          <div className="text-xs text-muted-foreground">
            {formatBytes(files[0].file.size)}
            {pdfPageCount !== null ? ` · ${pdfPageCount} page${pdfPageCount === 1 ? "" : "s"}` : ""}
          </div>
        </div>
      )}

      {tool.options && tool.options.length > 0 && (
        <OptionsRow fields={tool.options} values={options} onChange={onChangeOption} />
      )}
    </div>
  );
}

/* ==========================================================================
   Password Generator Widget
   ========================================================================== */

const EFF_SHORT_WORDLIST: string[] = [
  "apple","brave","cliff","delta","eagle","flame","grape","hotel","iris","joker","koala","lemon","mango","noble","ocean","piano","queen","raven","storm","tiger","unity","vivid","wheat","xenon","yield","zebra",
  "anchor","bloom","cabin","dream","ember","frost","giant","harbor","ivory","jungle","knife","light","magic","nebula","orbit","pearl","quest","river","sugar","trace","urban","valor","water","youth","zesty",
  "amber","blaze","crown","dance","earth","forge","green","happy","inlet","juice","karma","lunar","medal","night","olive","pride","quiet","rapid","smile","thunder","ultra","voice","whale","yellow","zenith",
  "arrow","bread","cloud","diver","echo","fresh","grace","heart","index","jumbo","kebab","lucky","maple","novel","octal","pixel","quilt","radio","sunny","torch","usher","vapor","waltz","young","zipper",
  "adore","blush","coral","daisy","elbow","ferry","globe","honey","input","jolly","kitty","lover","melon","nymph","opera","plush","quartz","robin","steel","trick","under","vixen","witch","yacht","zombie",
  "alert","boost","crisp","depth","enjoy","fable","gloom","hedge","inner","joker","kitchen","lyric","march","nurse","omega","paint","quick","ranch","story","treat","uncle","vinyl","wagon","yearn","zesty",
  "aspen","blend","cosy","drift","eager","float","grief","haste","irony","jewel","knack","latch","minor","nerve","onset","pivot","quirk","rider","satin","tulip","uphold","vital","witty","yarn","zilch",
  "angel","brick","crane","digit","erase","flock","guide","hatch","ideal","joint","kneel","lance","major","novel","occur","plant","quote","rival","swift","tower","upset","virus","wrist","yodel","zonal",
];

function calcEntropy(poolLen: number, len: number): number {
  return poolLen > 0 && len > 0 ? Math.log2(Math.pow(poolLen, len)) : 0;
}
function strengthFromBits(bits: number): "Weak" | "Fair" | "Good" | "Strong" | "Very Strong" {
  if (bits < 28) return "Weak";
  if (bits < 36) return "Fair";
  if (bits < 60) return "Good";
  if (bits < 128) return "Strong";
  return "Very Strong";
}
function strengthColor(s: string): string {
  switch (s) {
    case "Weak": return "bg-red-500";
    case "Fair": return "bg-orange-500";
    case "Good": return "bg-yellow-500";
    case "Strong": return "bg-green-500";
    case "Very Strong": return "bg-emerald-500";
    default: return "bg-gray-400";
  }
}
function rngInt(max: number): number {
  const gt = globalThis as any;
  if (gt?.crypto?.getRandomValues) {
    const arr = new Uint32Array(1);
    const limit = Math.floor(0xFFFFFFFF / max) * max;
    let x: number;
    do {
      gt.crypto.getRandomValues(arr);
      x = arr[0];
    } while (x >= limit);
    return x % max;
  }
  return Math.floor(Math.random() * max);
}
function buildPool(upper: boolean, lower: boolean, numbers: boolean, symbols: boolean, noAmbiguous: boolean): string {
  let u = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let l = "abcdefghijklmnopqrstuvwxyz";
  let n = "0123456789";
  let s = "!@#$%^&*()_+-=[]{}|;:,.<>?";
  if (noAmbiguous) {
    u = u.replace(/[IO]/g, "");
    l = l.replace(/[l]/g, "");
    n = n.replace(/[10]/g, "");
  }
  let out = "";
  if (upper) out += u;
  if (lower) out += l;
  if (numbers) out += n;
  if (symbols) out += s;
  if (!out) out = l + n;
  return out;
}
function buildPassword(opts: {
  mode: "Random password" | "Passphrase (words)";
  length: number;
  upper: boolean;
  lower: boolean;
  numbers: boolean;
  symbols: boolean;
  noAmbiguous: boolean;
  words: number;
  separator: "hyphen" | "space" | "period" | "none";
  capitalize: boolean;
  appendNumber: boolean;
}): { pw: string; entropyBits: number; strength: string; mode: "random" | "passphrase" } {
  if (opts.mode === "Passphrase (words)") {
    const wl = EFF_SHORT_WORDLIST.length;
    const count = Math.max(1, Math.min(20, opts.words));
    let chosen: string[] = [];
    for (let i = 0; i < count; i++) {
      let w = EFF_SHORT_WORDLIST[rngInt(wl)];
      if (opts.capitalize) w = w[0].toUpperCase() + w.slice(1);
      chosen.push(w);
    }
    let sep = "-";
    if (opts.separator === "space") sep = " ";
    else if (opts.separator === "period") sep = ".";
    else if (opts.separator === "none") sep = "";
    let result = chosen.join(sep);
    if (opts.appendNumber) {
      const n = rngInt(100);
      result = opts.separator === "none" ? `${result}${n}` : `${result}${sep}${n}`;
    }
    const bits = Math.log2(Math.pow(wl, count)) + (opts.appendNumber ? Math.log2(100) : 0);
    const strength = strengthFromBits(bits);
    return { pw: result, entropyBits: bits, strength, mode: "passphrase" };
  }

  const { upper, lower, numbers, symbols, noAmbiguous } = opts;
  const pool = buildPool(upper, lower, numbers, symbols, noAmbiguous);
  const len = Math.max(1, Math.min(512, opts.length));
  const enabledSets: string[] = [];
  let u = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let l = "abcdefghijklmnopqrstuvwxyz";
  let n = "0123456789";
  let s = "!@#$%^&*()_+-=[]{}|;:,.<>?";
  if (noAmbiguous) { u = u.replace(/[IO]/g, ""); l = l.replace(/[l]/g, ""); n = n.replace(/[10]/g, ""); }
  if (upper) enabledSets.push(u);
  if (lower) enabledSets.push(l);
  if (numbers) enabledSets.push(n);
  if (symbols) enabledSets.push(s);
  if (enabledSets.length === 0) enabledSets.push(l, n);

  const arr: string[] = [];
  for (let i = 0; i < len; i++) arr.push(pool[rngInt(pool.length)]);
  enabledSets.forEach((set, idx) => {
    const pos = idx % len;
    arr[pos] = set[rngInt(set.length)];
  });
  const pw = arr.join("");
  const bits = calcEntropy(pool.length, len);
  const strength = strengthFromBits(bits);
  return { pw, entropyBits: bits, strength, mode: "random" };
}

function PasswordGeneratorWidget(props: {
  tool: ToolDefinition;
  options: Record<string, unknown>;
  onChangeOption: (id: string, value: unknown) => void;
  isComingSoon?: boolean;
  onGenerateText: (t: string) => void;
}) {
  const { options, onChangeOption, tool, onGenerateText } = props;
  const [current, setCurrent] = useState<string>("");
  const [copied, setCopied] = useState(false);

  const gen = useCallback(() => {
    const opts = {
      mode: (String(options.mode ?? "Random password") as "Random password" | "Passphrase (words)"),
      length: Number(options.length ?? 16),
      upper: Boolean(options.upper ?? true),
      lower: Boolean(options.lower ?? true),
      numbers: Boolean(options.numbers ?? true),
      symbols: Boolean(options.symbols ?? true),
      noAmbiguous: Boolean(options.noAmbiguous ?? true),
      words: Number(options.words ?? 4),
      separator: (String(options.separator ?? "hyphen") as "hyphen" | "space" | "period" | "none"),
      capitalize: Boolean(options.capitalize ?? true),
      appendNumber: Boolean(options.appendNumber ?? true),
    };
    const { pw } = buildPassword(opts);
    setCurrent(pw);
    onGenerateText(pw);
  }, [options, onGenerateText]);

  useEffect(() => {
    gen();
  }, [gen]);

  const info = (() => {
    const mode = String(options.mode ?? "Random password");
    if (mode === "Passphrase (words)") {
      const wl = EFF_SHORT_WORDLIST.length;
      const words = Math.max(1, Number(options.words ?? 4));
      const bits = Math.log2(Math.pow(wl, words)) + (options.appendNumber ? Math.log2(100) : 0);
      return { bits, strength: strengthFromBits(bits) };
    }
    const { upper, lower, numbers, symbols, noAmbiguous } = {
      upper: Boolean(options.upper ?? true),
      lower: Boolean(options.lower ?? true),
      numbers: Boolean(options.numbers ?? true),
      symbols: Boolean(options.symbols ?? true),
      noAmbiguous: Boolean(options.noAmbiguous ?? true),
    };
    const pool = buildPool(upper, lower, numbers, symbols, noAmbiguous);
    const len = Math.max(1, Number(options.length ?? 16));
    const bits = calcEntropy(pool.length, len);
    return { bits, strength: strengthFromBits(bits) };
  })();

  const copy = async () => {
    if (!current) return;
    try {
      await navigator.clipboard.writeText(current);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* noop */
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <textarea
          readOnly
          value={current}
          rows={3}
          className="w-full rounded-lg border border-input bg-background px-3 py-3 font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={gen}
            className="inline-flex items-center gap-1.5 rounded-md bg-muted hover:bg-muted/70 border border-border px-3 py-1.5 text-sm font-medium transition-colors"
          >
            🔄 Regenerate
          </button>
          <button
            type="button"
            onClick={copy}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 px-3 py-1.5 text-sm font-medium transition-colors"
          >
            {copied ? "✓ Copied" : "📋 Copy"}
          </button>
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Strength</span>
          <span className="font-medium">
            {info.strength} · {Math.round(info.bits)} bits
          </span>
        </div>
        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full transition-all ${strengthColor(info.strength)}`}
            style={{ width: `${Math.min(100, Math.max(2, (info.bits / 160) * 100))}%` }}
          />
        </div>
      </div>

      {tool.options && tool.options.length > 0 && (
        <OptionsRow fields={tool.options} values={options} onChange={onChangeOption} />
      )}
    </div>
  );
}

/* ==========================================================================
   Helpers
   ========================================================================== */

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function actionLabel(tool: ToolDefinition): string {
  const map: Record<string, string> = {
    "ai/summarize": "✨ Summarize",
    "ai/paraphrase": "🔄 Paraphrase",
    "ai/grammar": "✅ Fix grammar",
    "ai/rewriter": "✍️ Rewrite text",
    "pdf/compress": "📉 Compress PDF",
    "pdf/merge": "🔗 Merge PDFs",
    "pdf/unlock": "🔓 Unlock PDF",
    "pdf/to-word": "📑 Convert to Word",
    "pdf/split": "✂️ Split PDF",
    "pdf/split-v2": "✂️ Split PDF",
    "image/compress-client": "🗜️ Compress images",
    "image/cropper": "🖼️ Crop and download",
    "qr/generate": "🔳 Download QR Code",
    "text/word-counter": "📋 Copy statistics",
    "security/password-gen": "🔐 Generate",
  };
  return map[tool.processorId] ?? `Run ${tool.name}`;
}

function computeReady(
  tool: ToolDefinition,
  files: FileItem[],
  text: string,
  extra: {
    pdfPageCount: number | null;
    imgMeta: { w: number; h: number } | null;
    qrFields: Record<string, string>;
    options: Record<string, unknown>;
  }
): boolean {
  switch (tool.widgetType) {
    case "text-input": {
      if (tool.minChars && text.length < tool.minChars) return false;
      return text.length > 0;
    }
    case "pdf-splitter":
      return files.length === 1;
    case "image-cropper":
      return !!extra.imgMeta;
    case "qr-generator": {
      const t = String(extra.options.dataType ?? "URL");
      const f = extra.qrFields;
      if (t === "Text") return f.text.trim().length > 0;
      if (t === "URL") return f.url.trim().length > 0;
      if (t === "Email") return f.email.trim().length > 0;
      if (t === "Phone") return f.phone.trim().length > 0;
      if (t === "Wi-Fi") return f.wifiSsid.trim().length > 0;
      return false;
    }
    case "word-counter":
      return text.trim().length > 0;
    case "image-compressor":
    case "pdf-to-word-converter":
      return files.length === 1;
    case "password-generator":
      return true;
    case "multi-file":
      return files.length >= 2;
    case "file-upload":
    case "image-client":
    case "image-server":
      return files.length === 1;
    case "calculator":
    default:
      return true;
  }
}

function mapToResultState(
  tool: ToolDefinition,
  raw: unknown,
  ctx: { original?: string } = {}
): ResultState {
  switch (tool.processorId) {
    case "ai/rewriter": {
      const r = raw as {
        output: string;
        similarityPercent: number;
        outputChars: number;
        watermark: boolean;
        sideBySideDiff?: RewriterDiffSpan[];
      };
      return {
        kind: "success-rewriter",
        output: r.output,
        similarityPercent: r.similarityPercent,
        outputChars: r.outputChars,
        watermark: r.watermark,
        sideBySideDiff: r.sideBySideDiff,
        original: ctx.original ?? "",
      };
    }
    case "pdf/split-v2": {
      const r = raw as { jobId: string; files: SplitOutFile[]; zipDownloadUrl?: string };
      return {
        kind: "success-pdf-split",
        files: r.files,
        jobId: r.jobId,
        zipDownloadUrl: r.zipDownloadUrl,
      };
    }
    case "image/compress-client": {
      const r = raw as ImageCompressResult;
      const out: SplitOutFile[] = r.files.map((f) => ({
        name: f.downloadName,
        pages: `${f.outputW}x${f.outputH}`,
        sizeBytes: f.compressedSizeBytes,
        originalSizeBytes: f.originalSizeBytes,
        sizeLabel: `${formatBytes(f.compressedSizeBytes)} · ${f.savingsPercent.toFixed(1)}% saved`,
        mimeType: f.mimeType,
        bytesBase64: f.bytesBase64,
        kind: f.outputW > 0 ? "pages" : "file",
      }));
      const totalOriginal = r.totalOriginalBytes;
      const totalCompressed = r.totalCompressedBytes;
      const summaryLabel =
        totalOriginal > 0
          ? `Saved ${formatBytes(totalOriginal - totalCompressed)} — ${r.totalSavingsPercent.toFixed(1)}% overall`
          : undefined;
      return {
        kind: "success-pdf-split",
        files: out,
        summary: summaryLabel,
        jobId: undefined,
        zipDownloadUrl: undefined,
      };
    }
    case "pdf/to-word": {
      const r = raw as PdfToWordResult;
      const meta: Record<string, string> = {
        pagesProcessed: `${r.pagesProcessed} page(s)`,
        tablesDetected: `${r.tablesDetected} table(s)`,
        ocrUsed: r.ocrUsed ? "Yes" : "No",
        outputFormat: r.outputFormat,
      };
      return {
        kind: "success-file",
        fileName: r.fileName,
        sizeBytes: r.sizeBytes,
        url: r.downloadUrl,
        meta,
        preview: r.firstPagePreview,
      };
    }
    case "security/password-gen": {
      const r = raw as PasswordGenResult;
      const label = `${r.strength} · ${Math.round(r.entropyBits)} bits entropy`;
      return {
        kind: "success-text-list",
        items: r.passwords,
        headerLabel: label,
      };
    }
  }

  // Generic processor-kind fallbacks (legacy)
  switch (tool.processor) {
    case "llm": {
      const r = raw as { output?: string } | undefined;
      if (r?.output && typeof r.output === "string") {
        return { kind: "success-text", text: r.output, copyLabel: "Copy result" };
      }
      return { kind: "error", message: "LLM returned no output. Try again." };
    }
    case "pdf-serverless": {
      const r = raw as
        | { downloadUrl?: string; newSizeBytes?: number; fileName?: string; downloadUrls?: string[] }
        | undefined;
      if (r?.downloadUrls && Array.isArray(r.downloadUrls) && r.downloadUrls.length > 1) {
        return {
          kind: "success-file",
          fileName: r.fileName ?? "split-result.zip",
          sizeBytes: r.newSizeBytes,
          url: r.downloadUrls[0],
          multipleUrls: r.downloadUrls,
        };
      }
      if (r?.downloadUrl) {
        return {
          kind: "success-file",
          fileName: r.fileName ?? defaultOutputName(tool),
          sizeBytes: r.newSizeBytes,
          url: r.downloadUrl,
        };
      }
      return { kind: "error", message: "File processor returned no result." };
    }
    case "canvas-client": {
      const r = raw as { downloadUrl?: string; savingsPercent?: number; fileName?: string } | undefined;
      if (r?.downloadUrl) {
        return {
          kind: "success-image",
          dataUrl: r.downloadUrl,
          name: r.fileName ?? defaultOutputName(tool),
          savingsPercent: r.savingsPercent,
          sizeBytes: 0,
          originalSizeBytes: 0,
        };
      }
      return { kind: "error", message: "Image processor returned no output." };
    }
    case "stub":
    default:
      return {
        kind: "error",
        message: `Processor "${tool.processor}" is not wired to a result mapper yet.`,
      };
  }
}

function defaultOutputName(tool: ToolDefinition): string {
  const stamp = new Date().toISOString().slice(0, 10);
  return `${tool.slug}-${stamp}.bin`;
}

function mapFormat(s: string): "original" | "jpeg" | "webp" | "png" {
  if (s === "JPG") return "jpeg";
  if (s === "PNG") return "png";
  if (s === "WebP") return "webp";
  return "original";
}

/* ==========================================================================
   Client-side tool runners
   ========================================================================== */

async function runClientSideCrop(
  imgDataUrl: string,
  crop: { x: number; y: number; w: number; h: number },
  options: Record<string, unknown>,
  meta: { name: string; type: string }
): Promise<{ dataUrl: string; sizeBytes: number }> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new window.Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = imgDataUrl;
  });
  const outFmtRaw = String(options.format ?? "Keep original");
  const outFmt =
    outFmtRaw === "JPG"
      ? "image/jpeg"
      : outFmtRaw === "PNG"
      ? "image/png"
      : outFmtRaw === "WebP"
      ? "image/webp"
      : meta.type === "image/png"
      ? "image/png"
      : meta.type === "image/webp"
      ? "image/webp"
      : "image/jpeg";
  const quality = Number(options.quality ?? 90) / 100;

  const canvas = document.createElement("canvas");
  canvas.width = crop.w;
  canvas.height = crop.h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, crop.x, crop.y, crop.w, crop.h, 0, 0, crop.w, crop.h);

  const dataUrl = await new Promise<string>((resolve) =>
    canvas.toBlob(
      (b) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = () => resolve(canvas.toDataURL(outFmt, quality));
        r.readAsDataURL(b!);
      },
      outFmt,
      quality
    )
  );
  // Approximate size
  const base64 = dataUrl.includes(",") ? dataUrl.split(",", 2)[1] : "";
  const sizeBytes = Math.round((base64.length * 3) / 4);
  return { dataUrl, sizeBytes };
}

/* ---------- Minimal QR encoder (no external deps) ----------
   Implementation note: We implement a tiny subset of QR encoding sufficient
   for demos. Post-MVP, replace this block with `qrcode-generator` npm package.
   ---------------- */
function qrBuildPayloadString(dataType: string, f: Record<string, string>): string {
  switch (dataType) {
    case "Text":
      return f.text ?? "";
    case "URL":
      return f.url?.startsWith("http") ? f.url : `https://${f.url ?? ""}`;
    case "Email": {
      const to = f.email ?? "";
      const sub = f.emailSubject ?? "";
      const body = f.emailBody ?? "";
      const parts = [];
      if (sub) parts.push("subject=" + encodeURIComponent(sub));
      if (body) parts.push("body=" + encodeURIComponent(body));
      return `mailto:${to}${parts.length ? "?" + parts.join("&") : ""}`;
    }
    case "Phone":
      return `tel:${f.phone ?? ""}`;
    case "Wi-Fi": {
      const enc = f.wifiEnc ?? "WPA";
      const ssid = f.wifiSsid ?? "";
      const pass = f.wifiPass ?? "";
      const hidden = f.wifiHidden === "true" ? "H:true;" : "";
      return `WIFI:T:${enc};S:${ssid};${enc !== "nopass" ? `P:${pass};` : ""}${hidden};`;
    }
  }
  return "";
}

/** Galois-field arithmetic for QR error correction. */
const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
(function initGF() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255];
})();
function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}
function rsGenPoly(degree: number): number[] {
  let poly = [1];
  for (let i = 0; i < degree; i++) {
    const np = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      np[j] ^= poly[j];
      np[j + 1] ^= gfMul(poly[j], GF_EXP[i]);
    }
    poly = np;
  }
  return poly;
}
function rsEncode(data: number[], ecLen: number): number[] {
  const gen = rsGenPoly(ecLen);
  const buf = data.concat(new Array(ecLen).fill(0));
  for (let i = 0; i < data.length; i++) {
    const factor = buf[i];
    if (factor !== 0) {
      for (let j = 0; j < gen.length; j++) {
        buf[i + j] ^= gfMul(gen[j], factor);
      }
    }
  }
  return buf.slice(data.length);
}

/**
 * Very small QR encoder: supports version 1..10 (21x21..57x57 modules) byte mode,
 * L/M/Q/H EC. Uses capacity table; enough for demos.
 */
const QR_CAPACITY: Record<string, number[]> = {
  // Each index = version-1; value = max data codewords for that (version, EC)
  L: [19, 34, 55, 80, 108, 136, 156, 194, 232, 274],
  M: [16, 28, 44, 64, 86, 108, 124, 154, 182, 216],
  Q: [13, 22, 34, 48, 62, 76, 88, 110, 132, 154],
  H: [9, 16, 26, 36, 46, 60, 66, 86, 100, 122],
};
const QR_EC_CODEWORDS: Record<string, number[]> = {
  L: [7, 10, 15, 20, 26, 18, 20, 24, 30, 18],
  M: [10, 16, 26, 18, 24, 16, 18, 22, 22, 26],
  Q: [13, 22, 18, 26, 18, 24, 18, 22, 20, 24],
  H: [17, 28, 22, 16, 22, 28, 26, 26, 24, 28],
};

function encodeByteModeQr(text: string, version: number, ec: "L" | "M" | "Q" | "H"): boolean[][] {
  // UTF-8 encode the text
  const encoder = new TextEncoder();
  const bytes = Array.from(encoder.encode(text));
  const dataCap = QR_CAPACITY[ec][version - 1];
  const ecLen = QR_EC_CODEWORDS[ec][version - 1];

  // Build bitstream: byte mode indicator = 0100 (4 bits)
  const bits: number[] = [];
  const push = (val: number, nbits: number) => {
    for (let i = nbits - 1; i >= 0; i--) bits.push((val >> i) & 1);
  };
  push(0b0100, 4);
  // char count: 8 bits for v1-9, 16 bits for v10+
  const countBits = version < 10 ? 8 : 16;
  push(bytes.length, countBits);
  for (const b of bytes) push(b, 8);

  // Terminator (up to 4 zeros)
  const maxBits = dataCap * 8;
  for (let i = 0; i < 4 && bits.length < maxBits; i++) bits.push(0);
  // Byte pad
  while (bits.length % 8 !== 0) bits.push(0);
  // Pad bytes
  const PAD = [0xec, 0x11];
  let pi = 0;
  while (bits.length < maxBits) {
    push(PAD[pi % 2], 8);
    pi++;
  }
  // Bits → codewords
  const dataCw: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let w = 0;
    for (let j = 0; j < 8; j++) w = (w << 1) | bits[i + j];
    dataCw.push(w);
  }
  const ecCw = rsEncode(dataCw, ecLen);
  const allCw = dataCw.concat(ecCw);

  // Place modules on matrix (simplified: single block, version 1-10 with standard placement)
  const size = 17 + 4 * version;
  const matrix: (boolean | null)[][] = Array.from({ length: size }, () =>
    new Array(size).fill(null)
  );
  const dark = (r: number, c: number) => {
    matrix[r][c] = true;
  };
  // Finder patterns (corners)
  const placeFinder = (r: number, c: number) => {
    for (let y = -1; y <= 7; y++) {
      for (let x = -1; x <= 7; x++) {
        const rr = r + y, cc = c + x;
        if (rr < 0 || cc < 0 || rr >= size || cc >= size) continue;
        const on =
          (y === 0 || y === 6 || x === 0 || x === 6) &&
          y >= 0 && y <= 6 && x >= 0 && x <= 6
            ? true
            : y >= 2 && y <= 4 && x >= 2 && x <= 4
            ? true
            : false;
        if (y >= 0 && y <= 6 && x >= 0 && x <= 6) matrix[rr][cc] = on;
      }
    }
  };
  placeFinder(0, 0);
  placeFinder(0, size - 7);
  placeFinder(size - 7, 0);

  // Separators
  for (let i = 0; i < 8; i++) {
    if (i < 7) {
      matrix[7][i] = false;
      matrix[i][7] = false;
      matrix[7][size - 1 - i] = false;
      matrix[i][size - 8] = false;
      matrix[size - 8][i] = false;
      matrix[size - 1 - i][7] = false;
    }
  }

  // Timing patterns (row 6, col 6 between finders)
  for (let i = 8; i < size - 8; i++) {
    const v = i % 2 === 0;
    if (matrix[6][i] === null) matrix[6][i] = v;
    if (matrix[i][6] === null) matrix[i][6] = v;
  }

  // Alignment patterns (for V2-6: one at center-ish; simplified)
  const apLocs: Record<number, number[]> = {
    2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34],
    7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50],
  };
  const locs = apLocs[version] ?? [];
  for (const r of locs) for (const c of locs) {
    if (matrix[r][c] !== null) continue;
    for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) {
      const v =
        (y === -2 || y === 2 || x === -2 || x === 2) || (x === 0 && y === 0) ? true : false;
      matrix[r + y][c + x] = v;
    }
  }

  // Reserve format info
  for (let i = 0; i <= 8; i++) {
    if (matrix[8][i] === null) matrix[8][i] = false;
    if (matrix[i][8] === null) matrix[i][8] = false;
    if (i < 8) {
      if (matrix[8][size - 1 - i] === null) matrix[8][size - 1 - i] = false;
      if (matrix[size - 1 - i][8] === null) matrix[size - 1 - i][8] = false;
    }
  }
  // Dark module
  matrix[size - 8][8] = true;

  // Reserve version info for V7+
  if (version >= 7) {
    for (let r = 0; r < 6; r++) for (let c = size - 11; c <= size - 9; c++) matrix[r][c] = false;
    for (let c = 0; c < 6; c++) for (let r = size - 11; r <= size - 9; r++) matrix[r][c] = false;
  }

  // Data placement: zig-zag, right to left, skipping timing column & function modules
  let bitIdx = 0;
  const moduleBits: boolean[] = [];
  for (const w of allCw) {
    for (let b = 7; b >= 0; b--) moduleBits.push(((w >> b) & 1) === 1);
  }
  // Remainder bits
  const remainder = { 1: 0, 2: 7, 3: 7, 4: 7, 5: 7, 6: 7, 7: 0, 8: 0, 9: 0, 10: 0 }[version] ?? 0;
  for (let i = 0; i < remainder; i++) moduleBits.push(false);

  let col = size - 1;
  let up = true;
  while (col > 0) {
    if (col === 6) col--;
    for (let i = 0; i < size; i++) {
      const row = up ? size - 1 - i : i;
      for (let s = 0; s < 2; s++) {
        const cc = col - s;
        if (matrix[row][cc] === null) {
          const bit = bitIdx < moduleBits.length ? moduleBits[bitIdx++] : false;
          matrix[row][cc] = bit;
        }
      }
    }
    up = !up;
    col -= 2;
  }

  // Mask: pick the simplest mask pattern 0 (i+j mod 2) for demo
  const applyMask = (m: (i: number, j: number) => boolean) => {
    for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) {
      // Skip function patterns: finders, separators, timing, alignment, format, version, dark
      if (isFunctionModule(r, c, size, version)) continue;
      if (m(r, c)) matrix[r][c] = !matrix[r][c];
    }
  };
  const mask = (i: number, j: number) => (i + j) % 2 === 0;
  applyMask(mask);

  // Format info: EC + mask (5 bits) + 10-bit BCH(15,5)
  const ecBits = { L: 0b01, M: 0b00, Q: 0b11, H: 0b10 }[ec];
  const fmtData = (ecBits << 3) | 0b000; // mask 0
  let fmt = fmtData;
  for (let i = 0; i < 10; i++) fmt <<= 1;
  // BCH encode: generator 0b10100110111
  let rem = fmtData << 10;
  const gen = 0b10100110111;
  for (let i = 14; i >= 10; i--) {
    if ((rem >> i) & 1) rem ^= gen << (i - 10);
  }
  const fmtFinal = ((fmtData << 10) | rem) ^ 0b101010000010010;
  const fmtBits: boolean[] = [];
  for (let i = 14; i >= 0; i--) fmtBits.push(((fmtFinal >> i) & 1) === 1);
  // Place format info (15 bits each location)
  const formatLocs: Array<[number, number]> = [
    [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8],
    [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8],
  ];
  const formatLocs2: Array<[number, number]> = [
    [size - 1, 8], [size - 2, 8], [size - 3, 8], [size - 4, 8], [size - 5, 8],
    [size - 7, 8], [size - 8, 8], [8, size - 8],
    [8, size - 7], [8, size - 6], [8, size - 5], [8, size - 4],
    [8, size - 3], [8, size - 2], [8, size - 1],
  ];
  fmtBits.forEach((v, i) => {
    if (formatLocs[i]) matrix[formatLocs[i][0]][formatLocs[i][1]] = v;
    if (formatLocs2[i]) matrix[formatLocs2[i][0]][formatLocs2[i][1]] = v;
  });

  return matrix.map((row) => row.map((v) => v === true));
}

function isFunctionModule(r: number, c: number, size: number, version: number): boolean {
  // Finder + separators: top-left 0..8 x 0..8
  if (r <= 8 && c <= 8) return true;
  if (r <= 8 && c >= size - 8) return true;
  if (r >= size - 8 && c <= 8) return true;
  // Timing patterns
  if (r === 6 || c === 6) return true;
  // Format info (around the finders, col 8 and row 8)
  if (r === 8 || c === 8) return true;
  // Dark module
  if (r === size - 8 && c === 8) return true;
  // Version info for V7+
  if (version >= 7) {
    if (r < 6 && c >= size - 11 && c <= size - 9) return true;
    if (c < 6 && r >= size - 11 && r <= size - 9) return true;
  }
  return false;
}

async function runClientSideQrEncode(
  fields: Record<string, string>,
  options: Record<string, unknown>
): Promise<{ png: string; svg?: string; eps?: string }> {
  const text = qrBuildPayloadString(String(options.dataType ?? "URL"), fields);
  if (!text) return { png: "" };

  const size = Number(options.size ?? 512);
  const fg = String(options.fgColor ?? "#0f172a");
  const bg = String(options.bgColor ?? "#ffffff");
  const ecRaw = String(options.errorCorrection ?? "Medium (15%)");
  const ec = ecRaw.startsWith("Low")
    ? "L"
    : ecRaw.startsWith("Q")
    ? "Q"
    : ecRaw.startsWith("High")
    ? "H"
    : "M";

  const png = await QRCode.toDataURL(text, {
    errorCorrectionLevel: ec as "L" | "M" | "Q" | "H",
    width: size,
    margin: 4,
    color: { dark: fg, light: bg },
  });
  return { png };
}

async function renderQrToCanvas(
  canvas: HTMLCanvasElement | null,
  props: {
    dataType: string;
    fields: Record<string, string>;
    size: number;
    fgColor: string;
    bgColor: string;
    ec: string;
    logoDataUrl?: string;
  }
) {
  if (!canvas) return;
  const out = await runClientSideQrEncode(props.fields, {
    dataType: props.dataType,
    size: props.size,
    fgColor: props.fgColor,
    bgColor: props.bgColor,
    errorCorrection: props.ec,
  });
  if (!out.png) {
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = props.bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    return;
  }
  const img = new window.Image();
  await new Promise<void>((r) => {
    img.onload = () => r();
    img.src = out.png;
  });
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  if (props.logoDataUrl && (props.ec.startsWith("M") || props.ec.startsWith("Q") || props.ec.startsWith("H"))) {
    const logo = new window.Image();
    await new Promise<void>((r) => {
      logo.onload = () => r();
      logo.src = props.logoDataUrl!;
    });
    const lw = Math.round(canvas.width * 0.2);
    const lh = Math.round(canvas.height * 0.2);
    const lx = (canvas.width - lw) / 2;
    const ly = (canvas.height - lh) / 2;
    // White box behind logo
    const pad = Math.round(canvas.width * 0.02);
    ctx.fillStyle = "#fff";
    ctx.fillRect(lx - pad, ly - pad, lw + 2 * pad, lh + 2 * pad);
    ctx.drawImage(logo, lx, ly, lw, lh);
  }
}

export { };
