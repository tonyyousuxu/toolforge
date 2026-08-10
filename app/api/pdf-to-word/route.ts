import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ReqBody {
  fileBytesBase64: string;
  sourceName?: string;
  sourcePages?: number;
  outputFormat: ".docx" | ".txt";
  ocrFallback: boolean;
  plan?: "free" | "pro";
}

// --- Pure JS docx builder (OOXML ZIP) — zero external deps, avoids webpack mangling ---
function crc32Table(): Uint32Array {
  if (crcCache) return crcCache;
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n >>> 0;
    for (let k = 0; k < 8; k++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return (crcCache = t);
}
let crcCache: Uint32Array | null = null;

function crc32(bytes: Uint8Array, start: number, len: number): number {
  const t = crc32Table();
  let c = 0xffffffff;
  const end = start + len;
  for (let i = start; i < end; i++) c = t[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function enc(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

function concatAll(parts: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const p of parts) total += p.length;
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

function u16(n: number): Uint8Array { return new Uint8Array([n & 0xff, (n >>> 8) & 0xff]); }
function u32(n: number): Uint8Array { return new Uint8Array([n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff]); }

interface ZipFile { path: string; data: Uint8Array; crc: number; offset: number; }

function buildZip(files: { path: string; data: Uint8Array }[]): Uint8Array {
  const parts: Uint8Array[] = [];
  const entries: ZipFile[] = [];
  let offset = 0;
  for (const f of files) {
    const nameBytes = enc(f.path);
    const crc = crc32(f.data, 0, f.data.length);
    const size = f.data.length;
    // Local file header
    const sig = u32(0x04034b50);
    const version = u16(20);
    const flags = u16(0);
    const compression = u16(0); // store (no compression)
    const modTime = u16(0);
    const modDate = u16(0);
    const crcBytes = u32(crc);
    const compSize = u32(size);
    const uncompSize = u32(size);
    const nameLen = u16(nameBytes.length);
    const extraLen = u16(0);
    const lfh = concatAll([sig, version, flags, compression, modTime, modDate, crcBytes, compSize, uncompSize, nameLen, extraLen, nameBytes]);
    parts.push(lfh);
    parts.push(f.data);
    entries.push({ path: f.path, data: f.data, crc, offset });
    offset += lfh.length + f.data.length;
  }
  // Central directory
  const cdStart = offset;
  for (const e of entries) {
    const nameBytes = enc(e.path);
    const size = e.data.length;
    const cd = concatAll([
      u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0),
      u32(e.crc), u32(size), u32(size), u16(nameBytes.length), u16(0), u16(0),
      u16(0), u16(0), u32(0), u32(e.offset), nameBytes,
    ]);
    parts.push(cd);
    offset += cd.length;
  }
  const cdLen = offset - cdStart;
  // End of central directory
  const eocd = concatAll([
    u32(0x06054b50), u16(0), u16(0), u16(entries.length), u16(entries.length),
    u32(cdLen), u32(cdStart), u16(0),
  ]);
  parts.push(eocd);
  return concatAll(parts);
}

function xmlEscape(s: string): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function buildDocxBytes(sections: { heading1?: string; headerSubtitle?: string; footerCenter?: string; pages: { idx: number; paragraphs: { kind: "h" | "p" | "tbl"; level?: 1 | 2 | 3; lines: string[] }[] }[] }): Uint8Array {
  const children: string[] = [];
  if (sections.heading1) {
    children.push(`<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="30"/></w:rPr><w:t xml:space="preserve">${xmlEscape(sections.heading1)}</w:t></w:r></w:p>`);
  }
  if (sections.headerSubtitle) {
    children.push(`<w:p><w:pPr><w:spacing w:after="240"/></w:pPr><w:r><w:rPr><w:i/><w:sz w:val="20"/><w:color w:val="64748b"/></w:rPr><w:t xml:space="preserve">${xmlEscape(sections.headerSubtitle)}</w:t></w:r></w:p>`);
  }
  for (const page of sections.pages) {
    if (page.idx > 0) {
      children.push(`<w:p><w:pPr><w:pStyle w:val="Heading2"/><w:spacing w:before="400" w:after="120"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="24"/></w:rPr><w:t xml:space="preserve">Page ${page.idx + 1}</w:t></w:r></w:p>`);
    }
    for (const para of page.paragraphs) {
      if (para.lines.length === 1 && !para.lines[0]) {
        // Empty placeholder paragraph for "no text extracted" page
        children.push(`<w:p><w:pPr><w:spacing w:after="200"/></w:pPr><w:r><w:rPr><w:i/><w:color w:val="94a3b8"/></w:rPr><w:t>(No extractable text on this page.)</w:t></w:p>`);
        continue;
      }
      let style = "";
      let rPr = "";
      if (para.kind === "h") {
        style = para.level === 2 ? `<w:pStyle w:val="Heading2"/>` : `<w:pStyle w:val="Heading3"/>`;
        rPr = `<w:b/>`;
      }
      let pPr = `<w:pPr>${style}<w:spacing w:after="160" w:line="276"/></w:pPr>`;
      let runs = "";
      for (let i = 0; i < para.lines.length; i++) {
        const rawLine = para.lines[i];
        const line = para.kind === "tbl" ? rawLine.replace(/\t/g, "   ") : rawLine.trim();
        const prefix = i > 0 ? (para.kind === "tbl" ? "\n" : " ") : "";
        const showLine = prefix + line;
        if (!showLine) continue;
        const font = para.kind === "tbl" ? `<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/>` : "";
        runs += `<w:r><w:rPr>${rPr}${font}</w:rPr><w:t xml:space="preserve">${xmlEscape(showLine)}</w:t></w:r>`;
      }
      children.push(`<w:p>${pPr}${runs}</w:p>`);
    }
  }
  const docXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${children.join("")}<w:sectPr><w:footerReference w:type="default" r:id="rIdFooter"/><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>`;

  const footerText = xmlEscape(footerCenter ?? "");
  const footerXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:pPr><w:jc w:val="center"/></w:pPr>${footerText ? `<w:r><w:rPr><w:sz w:val="16"/><w:color w:val="64748b"/></w:rPr><w:t xml:space="preserve">${footerText}</w:t></w:r>` : ""}</w:p></w:ftr>`;

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/></Types>`;

  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;

  const docRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdFooter" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/></Relationships>`;

  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:before="240" w:after="120"/></w:pPr><w:rPr><w:b/><w:sz w:val="32"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:before="200" w:after="120"/></w:pPr><w:rPr><w:b/><w:sz w:val="26"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:before="160" w:after="100"/></w:pPr><w:rPr><w:b/><w:sz w:val="24"/></w:rPr></w:style></w:styles>`;

  const settingsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:zoom w:percent="100"/></w:settings>`;

  return buildZip([
    { path: "[Content_Types].xml", data: enc(contentTypes) },
    { path: "_rels/.rels", data: enc(rels) },
    { path: "word/document.xml", data: enc(docXml) },
    { path: "word/styles.xml", data: enc(stylesXml) },
    { path: "word/settings.xml", data: enc(settingsXml) },
    { path: "word/footer1.xml", data: enc(footerXml) },
    { path: "word/_rels/document.xml.rels", data: enc(docRels) },
  ]);
}

// --- PDF text extraction via ISOLATED CHILD PROCESS ---
//
// We've burned MANY attempts at running pdf-parse or pdfjs inside the
// Next.js /api route bundle. The root cause: webpack eagerly walks any
// statically-visible require() or import statement, then either:
//   (a) bundles the pdfjs modules and breaks the internal namespace,
//       triggering "Object.defineProperty called on non-object" errors;
//   (b) tries to parse binary worker chunks and throws ModuleParseError;
//   (c) wraps the CJS module badly so the pdf-parse entry's debug guard
//       fires (ENOENT on ./test/data/05-versions-space.pdf).
//
// The most robust fix is to launch a tiny plain-CJS node child process
// whose source we read at runtime. Webpack has zero visibility into a
// file we only reference by path string via child_process.spawn, so the
// pdf-parse/lib/pdf-parse.js module loads exactly as its author
// intended — with a real CJS require() and its bundled pdf.js v1.10.
async function extractTextFromPdfBytes(rawBytes: Uint8Array): Promise<{ text: string; numpages: number }> {
  const os = await import("node:os");
  const fs = await import("node:fs");
  const path = await import("node:path");
  const cp = await import("node:child_process");

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pdf2w-"));
  const inFile = path.join(tmpDir, "pdf.b64");
  const outFile = path.join(tmpDir, "result.json");
  const workerScript = path.join(
    process.cwd(),
    "lib",
    "pdf-parse-worker",
    "pdf-worker.cjs"
  );

  // Sanity check the worker script is where we expect it
  try {
    fs.accessSync(workerScript, (fs.constants ?? { R_OK: 4 } as any).R_OK as number);
  } catch {
    throw new Error(
      "PDF text extraction: pdf-worker helper script is missing. " +
      "Expected at: " + workerScript
    );
  }

  try {
    fs.writeFileSync(inFile, Buffer.from(rawBytes).toString("base64"), "utf8");

    // Execute with a generous timeout. PDFs parse in well under 30s in
    // practice, but we give 60s headroom for very large documents.
    const run = cp.spawnSync(process.execPath, [workerScript, inFile, outFile], {
      cwd: tmpDir,
      timeout: 60_000,
      maxBuffer: 100 * 1024 * 1024,
      windowsHide: true,
    });
    if (run.error) throw run.error;
    if (!fs.existsSync(outFile)) {
      const stderr = (run.stderr ?? "").toString("utf8").trim();
      const stdout = (run.stdout ?? "").toString("utf8").trim();
      throw new Error(
        `PDF worker did not produce output (exit ${run.status ?? "?"}). ` +
        `${stderr ? "stderr: " + stderr.slice(0, 300) : ""}` +
        `${stdout ? " stdout: " + stdout.slice(0, 200) : ""}`
      );
    }
    let parsed: any;
    try {
      parsed = JSON.parse(fs.readFileSync(outFile, "utf8"));
    } catch (e: any) {
      throw new Error("PDF worker produced unparseable JSON: " + (e?.message ?? String(e)));
    }
    if (!parsed?.ok) {
      const msg: string = parsed?.error ?? "Unknown error in PDF parser child process.";
      if (msg.toLowerCase().includes("password")) {
        throw new Error(
          "This PDF is password protected. Remove the password first, then try again."
        );
      }
      throw new Error("PDF text extraction failed: " + msg);
    }
    const text: string = typeof parsed.text === "string" ? parsed.text.replace(/\r\n/g, "\n") : "";
    const numpages: number = typeof parsed.numpages === "number" ? parsed.numpages : 0;
    if (!text.trim() && numpages > 0) {
      return {
        text:
          "[No extractable text was found in this PDF. It may be a scanned document, " +
          "an image-only PDF, or contain only vector graphics. Run it through an OCR " +
          "tool first, then re-upload to convert.]",
        numpages,
      };
    }
    return { text, numpages };
  } finally {
    // Always clean up temp files, even if parsing fails.
    try {
      for (const f of [inFile, outFile]) {
        try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch { /* ignore */ }
      }
      try { fs.rmdirSync(tmpDir); } catch { /* ignore */ }
    } catch { /* ignore */ }
  }
}

function detectTables(text: string): { tables: number } {
  let tables = 0;
  if (!text.trim()) return { tables: 0 };
  const lines = text.split(/\n/);
  let inRun = false;
  for (const line of lines) {
    if (/^\s*$/.test(line)) { inRun = false; continue; }
    const chunks = line.split(/\s{2,}/).filter((c) => c.trim().length > 0);
    if (chunks.length >= 3) {
      if (!inRun) tables++;
      inRun = true;
    } else {
      inRun = false;
    }
  }
  return { tables };
}

function classifyLine(line: string): { kind: "h" | "p" | "tbl"; level?: 1 | 2 | 3 } {
  const trimmed = line.trim();
  if (!trimmed) return { kind: "p" };
  if (/^[A-Z0-9][A-Z0-9\s&:.,'\-]{1,80}$/.test(trimmed) && !/[.!?]$/.test(trimmed)) {
    return { kind: "h", level: trimmed.length < 25 ? 2 : 3 };
  }
  const chunks = line.split(/\s{2,}/).filter((c) => c.trim().length > 0);
  if (chunks.length >= 3) return { kind: "tbl" };
  return { kind: "p" };
}

async function serverSideConvert(p: ReqBody) {
  const cap = p.plan === "pro" ? 99999 : 20;
  let pagesProcessed = Math.max(1, p.sourcePages ?? 1);
  const exceeded = pagesProcessed > cap;
  if (exceeded) pagesProcessed = cap;

  let rawBytes: Uint8Array;
  try {
    const b64 = (p.fileBytesBase64 ?? "").trim();
    if (!b64) throw new Error("No PDF bytes");
    rawBytes = new Uint8Array(Buffer.from(b64, "base64"));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`Could not decode the PDF file. ${msg}`);
  }

  const { text: extractedText, numpages: numpagesFromPdf } = await extractTextFromPdfBytes(rawBytes);

  if (numpagesFromPdf > 0) {
    pagesProcessed = Math.min(pagesProcessed, numpagesFromPdf);
  }
  const ocrUsed = Boolean(p.ocrFallback) && extractedText.trim().length < 40;
  const { tables: tablesDetected } = detectTables(extractedText);

  const rawPages = extractedText.split(/\f/);
  let pagesArr: string[] = rawPages;
  if (pagesArr.length < 2 && numpagesFromPdf > 1 && extractedText.length > 200) {
    const paragraphs = extractedText.split(/\n\s*\n/).filter(Boolean);
    const perPage = Math.max(1, Math.ceil(paragraphs.length / numpagesFromPdf));
    const rebuilt: string[] = [];
    for (let i = 0; i < numpagesFromPdf; i++) {
      rebuilt.push(paragraphs.slice(i * perPage, (i + 1) * perPage).join("\n\n"));
    }
    pagesArr = rebuilt;
  }
  if (pagesArr.length > pagesProcessed) pagesArr = pagesArr.slice(0, pagesProcessed);
  const cleanedPages = pagesArr.map((t) =>
    t.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim()
  );

  const srcBase = (p.sourceName || "document").replace(/\.[^.]+$/, "");
  const fileName = `${srcBase}${p.outputFormat}`;

  if (p.outputFormat === ".txt") {
    const footerMsg = exceeded
      ? `\n\n⚠ Note: Source PDF exceeded the free-tier ${cap}-page limit. Only the first ${pagesProcessed} pages were converted.`
      : "";
    const parts: string[] = [];
    cleanedPages.forEach((page, i) => {
      if (pagesProcessed > 1) parts.push(`=== Page ${i + 1} ===`);
      parts.push(page || "(No extractable text on this page.)");
      parts.push("");
    });
    const text = parts.join("\n");
    const finalText = `Converted from PDF by ToolForge\n${text}\n${footerMsg}\n`;
    const body = Buffer.from("\uFEFF" + finalText, "utf8");
    const firstPageText = cleanedPages[0] ?? extractedText.slice(0, 500);
    const firstPagePreview = (
      ocrUsed
        ? "[OCR mode: PDF contained no selectable text — this free-tier preview shows best-effort extracted text]\n\n" +
          firstPageText
        : firstPageText
    ).slice(0, 500);
    return {
      mime: "text/plain;charset=utf-8",
      fileName,
      fileBytesBase64: body.toString("base64"),
      pagesProcessed,
      pagesTotal: numpagesFromPdf || pagesProcessed,
      textChars: extractedText.length,
      tablesDetected,
      ocrUsed,
      exceeded,
      firstPagePreview,
    };
  }

  // === Build .docx using pure OOXML builder (no docx library import ===
  const pagesForDocx = cleanedPages.map((pageText, pageIdx) => {
    if (!pageText) return { idx: pageIdx, paragraphs: [{ kind: "p" as const, lines: [""] }] };
    const pageParagraphs: { kind: "h" | "p" | "tbl"; level?: 1 | 2 | 3; lines: string[] }[] = [];
    const paragraphs = pageText.split(/\n\s*\n/);
    for (const para of paragraphs) {
      const lines = para.split(/\n/);
      const merged = para.replace(/\s+/g, " ").trim();
      if (lines.length <= 2 && merged.length > 0 && merged.length < 100) {
        const cls = classifyLine(merged);
        if (cls.kind === "h") {
          pageParagraphs.push({ kind: "h", level: cls.level ?? 3, lines: [merged] });
          continue;
        }
      }
      // Normal paragraph or table
      const firstLineCls = lines[0] ? classifyLine(lines[0]) : { kind: "p" as const };
      const kind: "h" | "p" | "tbl" = firstLineCls.kind === "tbl" ? "tbl" : "p";
      pageParagraphs.push({ kind, lines });
    }
    return { idx: pageIdx, paragraphs: pageParagraphs };
  });

  const pro = p.plan === "pro";
  const today = new Date().toDateString();
  const footerCenter = pro
    ? `Converted from PDF · ToolForge Pro · ${today}`
    : `Converted by ToolForge (free tier) · ${today}`;

  const headerSubtitle = `Source: ${p.sourceName ?? "document.pdf"} · Pages processed: ${pagesProcessed}${
    exceeded ? ` (source has more; free tier cap: ${cap})` : ""
  }`;

  const docxBytes = buildDocxBytes({
    heading1: `Converted from PDF by ToolForge`,
    headerSubtitle,
    pages: pagesForDocx,
    footerCenter,
  });

  const outBase64 = Buffer.from(docxBytes).toString("base64");

  const firstPagePreview = (() => {
    const firstPageText = cleanedPages[0] ?? extractedText.slice(0, 500);
    const base = ocrUsed
      ? "[OCR mode: PDF contained no selectable text — this free-tier preview shows best-effort extracted text]\n\n" +
        firstPageText
      : firstPageText;
    return base.slice(0, 500);
  })();

  return {
    mime:
      p.outputFormat === ".txt"
        ? "text/plain;charset=utf-8"
        : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    fileName,
    fileBytesBase64: outBase64,
    pagesProcessed,
    pagesTotal: numpagesFromPdf || pagesProcessed,
    textChars: extractedText.length,
    tablesDetected,
    ocrUsed,
    exceeded,
    firstPagePreview,
  };
}

export async function POST(req: NextRequest): Promise<Response> {
  try {
    const body = (await req.json()) as ReqBody;
    const result = await serverSideConvert(body);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { ok: false, error: `PDF→Word conversion failed: ${msg}` },
      { status: 500 }
    );
  }
}
