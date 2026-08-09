import { TOOLS } from "./tools";
import { CATEGORIES } from "./types";
import type {
  ToolDefinition,
  CategoryInfo,
  CategorySlug,
} from "./types";

export * from "./types";
export { TOOLS, CATEGORIES };

// ============================================================
//  Browser-compatible .docx builder (no external deps)
// ============================================================
// The real `docx` library cannot be loaded in-browser under Next.js
// (ESM interop + Node-only helpers cause "Object.defineProperty called
// on non-object" at import time). This section provides a minimal
// replacement that produces fully valid .docx files (OOXML ZIP)
// from the same API surface the processor code already uses.
// ============================================================

// ----- CRC-32 (IEEE 802.3, reflected) -----
const _crc32Table = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c >>> 0;
  }
  return t;
})();
function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = _crc32Table[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// ----- Minimal ZIP builder -----
interface ZipFile { path: string; data: Uint8Array; }
function buildZip(files: ZipFile[]): Uint8Array {
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  const encoder = new TextEncoder();
  for (const f of files) {
    const pathBytes = encoder.encode(f.path) as unknown as Uint8Array;
    const crc = crc32(f.data as unknown as Uint8Array);
    // Local file header (30 bytes) + path + data
    const hdr = new Uint8Array(30 + pathBytes.length);
    const dv = new DataView(hdr.buffer);
    dv.setUint32(0, 0x04034b50, true);
    dv.setUint16(4, 20, true);     // version needed
    dv.setUint16(6, 0, true);      // flags
    dv.setUint16(8, 0, true);      // method = stored
    dv.setUint16(10, 0, true);     // last mod time
    dv.setUint16(12, 0, true);     // last mod date
    dv.setUint32(14, crc, true);
    dv.setUint32(18, f.data.length, true);
    dv.setUint32(22, f.data.length, true);
    dv.setUint16(26, pathBytes.length, true);
    dv.setUint16(28, 0, true);     // extra length
    hdr.set(pathBytes, 30);
    parts.push(hdr);
    parts.push(f.data);
    // Central directory header (46 bytes) + path
    const cd = new Uint8Array(46 + pathBytes.length);
    const cdv = new DataView(cd.buffer);
    cdv.setUint32(0, 0x02014b50, true);
    cdv.setUint16(4, 20, true);
    cdv.setUint16(6, 20, true);
    cdv.setUint16(8, 0, true);     // flags
    cdv.setUint16(10, 0, true);    // method
    cdv.setUint16(12, 0, true);    // time
    cdv.setUint16(14, 0, true);    // date
    cdv.setUint32(16, crc, true);
    cdv.setUint32(20, f.data.length, true);
    cdv.setUint32(24, f.data.length, true);
    cdv.setUint16(28, pathBytes.length, true);
    cdv.setUint16(30, 0, true);    // extra
    cdv.setUint16(32, 0, true);    // comment
    cdv.setUint16(34, 0, true);    // disk start
    cdv.setUint16(36, 0, true);    // internal
    cdv.setUint32(38, 0x20, true); // external (archive bit)
    cdv.setUint32(42, offset, true);
    cd.set(pathBytes, 46);
    central.push(cd);
    offset += hdr.length + f.data.length;
  }
  const cdSize = central.reduce((s, c) => s + c.length, 0);
  const end = new Uint8Array(22);
  const edv = new DataView(end.buffer);
  edv.setUint32(0, 0x06054b50, true);
  edv.setUint16(4, 0, true);
  edv.setUint16(6, 0, true);
  edv.setUint16(8, files.length, true);
  edv.setUint16(10, files.length, true);
  edv.setUint32(12, cdSize, true);
  edv.setUint32(16, offset, true);
  edv.setUint16(20, 0, true);
  central.forEach((c) => parts.push(c));
  parts.push(end);
  const total = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  for (const p of parts) { out.set(p, pos); pos += p.length; }
  return out;
}

// ----- OOXML XML builder (minimal valid .docx) -----
function buildDocxXml(doc: any): Uint8Array {
  const encoder = new TextEncoder();
  const encode = (s: string): Uint8Array => encoder.encode(s) as unknown as Uint8Array;
  const esc = (s: string) => s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

  const children: any[] = doc?.sections?.[0]?.children ?? [];
  const footers: any[] = doc?.sections?.[0]?.footers?.[0]?.children ?? [];
  const paragraphs: string[] = [];

  for (const child of children) {
    if (!child) continue;
    const runs = child.children ?? [];
    const heading = child.heading ?? "";
    const alignment = child.alignment ?? "";
    const spacing = child.spacing;
    const pPrParts: string[] = [];
    if (heading) pPrParts.push(`<w:pStyle w:val="${heading}"/>`);
    if (alignment) {
      const aVal = alignment === "center" ? "ctr" : alignment === "right" ? "rgt" : alignment;
      pPrParts.push(`<w:jc w:val="${aVal}"/>`);
    }
    if (spacing) {
      const s: string[] = [];
      if (spacing.before) s.push(`w:before="${spacing.before}"`);
      if (spacing.after) s.push(`w:after="${spacing.after}"`);
      if (s.length) pPrParts.push(`<w:spacing ${s.join(" ")}/>`);
    }
    const runXml: string[] = [];
    for (const r of runs) {
      if (!r) continue;
      const rPrParts: string[] = [];
      if (r.bold) rPrParts.push("<w:b/>");
      if (r.italics) rPrParts.push("<w:i/>");
      if (r.color) rPrParts.push(`<w:color w:val="${r.color}"/>`);
      if (r.size) rPrParts.push(`<w:sz w:val="${r.size}"/>`);
      if (r.font) rPrParts.push(`<w:rFonts w:ascii="${r.font}" w:hAnsi="${r.font}"/>`);
      // Handle TextRun with page-number children (not text)
      const childrenArr: any[] = r.children ?? [];
      const hasPageNumber = childrenArr.some((c: any) =>
        c === "PAGE_CURRENT" || c === "PAGE_TOTAL"
      );
      if (hasPageNumber) {
        // Insert PAGE field: begin-instrText-end
        const instrText = childrenArr.includes("PAGE_CURRENT") ? " PAGE " : " NUMPAGES ";
        runXml.push(
          `<w:r>${rPrParts.length ? `<w:rPr>${rPrParts.join("")}</w:rPr>` : ""}<w:fldChar w:fldCharType="begin"/></w:r>` +
          `<w:r>${rPrParts.length ? `<w:rPr>${rPrParts.join("")}</w:rPr>` : ""}<w:instrText xml:space="preserve">${instrText}</w:instrText></w:r>` +
          `<w:r>${rPrParts.length ? `<w:rPr>${rPrParts.join("")}</w:rPr>` : ""}<w:fldChar w:fldCharType="end"/></w:r>`
        );
      } else {
        const text = esc(r.text ?? "");
        const hasSpace = /^\s|\s$/.test(text) || text.includes("  ") || text.includes("\n");
        if (text) {
          if (hasSpace) {
            runXml.push(`<w:r><w:rPr>${rPrParts.join("")}</w:rPr><w:t xml:space="preserve">${text}</w:t></w:r>`);
          } else {
            runXml.push(`<w:r>${rPrParts.length ? `<w:rPr>${rPrParts.join("")}</w:rPr>` : ""}<w:t>${text}</w:t></w:r>`);
          }
        } else if (childrenArr.length > 0) {
          // TextRun has children but no page numbers — skip unknown children
        }
      }
    }
    const pPr = pPrParts.length ? `<w:pPr>${pPrParts.join("")}</w:pPr>` : "";
    paragraphs.push(`<w:p>${pPr}${runXml.join("")}</w:p>`);
  }

  // Footer
  let footerXml = "";
  if (footers.length) {
    const fp: string[] = [];
    for (const f of footers) {
      const runs = f.children ?? [];
      const runXml: string[] = [];
      for (const r of runs) {
        if (!r) continue;
        const rPrParts: string[] = [];
        if (r.bold) rPrParts.push("<w:b/>");
        if (r.italics) rPrParts.push("<w:i/>");
        if (r.color) rPrParts.push(`<w:color w:val="${r.color}"/>`);
        if (r.size) rPrParts.push(`<w:sz w:val="${r.size}"/>`);
        // Handle page-number children
        const childrenArr: any[] = r.children ?? [];
        const hasPageNumber = childrenArr.some((c: any) =>
          c === "PAGE_CURRENT" || c === "PAGE_TOTAL"
        );
        if (hasPageNumber) {
          const instrText = childrenArr.includes("PAGE_CURRENT") ? " PAGE " : " NUMPAGES ";
          runXml.push(
            `<w:r>${rPrParts.length ? `<w:rPr>${rPrParts.join("")}</w:rPr>` : ""}<w:fldChar w:fldCharType="begin"/></w:r>` +
            `<w:r>${rPrParts.length ? `<w:rPr>${rPrParts.join("")}</w:rPr>` : ""}<w:instrText xml:space="preserve">${instrText}</w:instrText></w:r>` +
            `<w:r>${rPrParts.length ? `<w:rPr>${rPrParts.join("")}</w:rPr>` : ""}<w:fldChar w:fldCharType="end"/></w:r>`
          );
        } else {
          const text = esc(r.text ?? "");
          if (text) {
            const hasSpace = /^\s|\s$/.test(text);
            runXml.push(`<w:r>${rPrParts.length ? `<w:rPr>${rPrParts.join("")}</w:rPr>` : ""}<w:t${hasSpace ? ' xml:space="preserve"' : ""}>${text}</w:t></w:r>`);
          }
        }
      }
      const fpr = f.alignment === "center" ? '<w:pPr><w:jc w:val="ctr"/></w:pPr>' : "";
      fp.push(`<w:p>${fpr}${runXml.join("")}</w:p>`);
    }
    footerXml = `<w:footer w:type="default" r:id="rId1">${fp.join("")}</w:footer>`;
  }

  const body = `<w:body>${paragraphs.join("")}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body>`;
  const docXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">${body}</w:document>`;
  const footerPartXml = footerXml
    ? `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${footerXml}`
    : "";
  const docRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>
</Relationships>`;
  const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;
  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>
  <Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>
</Types>`;
  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" w:default="1">
  <w:style w:type="paragraph" w:styleId="1">
    <w:name w:val="Default Paragraph Font"/>
    <w:qFormat/>
  </w:style>
  <w:style w:type="paragraph" w:styleId="2">
    <w:name w:val="Heading 1"/>
    <w:basedOn w:val="1"/>
  </w:style>
  <w:style w:type="paragraph" w:styleId="3">
    <w:name w:val="Heading 2"/>
    <w:basedOn w:val="1"/>
  </w:style>
  <w:style w:type="paragraph" w:styleId="4">
    <w:name w:val="Heading 3"/>
    <w:basedOn w:val="1"/>
  </w:style>
</w:styles>`;
  const settingsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:defaultTabStop w:val="720"/>
</w:settings>`;

  const files: ZipFile[] = [
    { path: "[Content_Types].xml", data: encode(contentTypesXml) },
    { path: "_rels/.rels", data: encode(rootRelsXml) },
    { path: "word/document.xml", data: encode(docXml) },
    { path: "word/styles.xml", data: encode(stylesXml) },
    { path: "word/settings.xml", data: encode(settingsXml) },
    { path: "word/_rels/document.xml.rels", data: encode(docRelsXml) },
  ];
  if (footerPartXml) {
    files.push({ path: "word/footer1.xml", data: encode(footerPartXml) });
  }
  return buildZip(files);
}

// ----- Mock .docx API for browser -----
function createBrowserDocxApi() {
  const HeadingLevel = { HEADING_1: "2", HEADING_2: "3", HEADING_3: "4" };
  const AlignmentType = { LEFT: "left", CENTER: "center", RIGHT: "right" };
  const PageNumber_CURRENT = "PAGE_CURRENT";
  const PageNumber_TOTAL = "PAGE_TOTAL";

  class Paragraph {
    public opts: any;
    constructor(opts: any) { this.opts = opts; }
  }
  class TextRun {
    public opts: any;
    constructor(opts: any) { this.opts = opts; }
    get text(): string { return this.opts?.text ?? ""; }
    get children(): any[] { return this.opts?.children ?? []; }
    get bold(): boolean { return !!this.opts?.bold; }
    get italics(): boolean { return !!this.opts?.italics; }
    get color(): string { return this.opts?.color ?? ""; }
    get size(): number { return this.opts?.size ?? 0; }
    get font(): string { return this.opts?.font ?? ""; }
  }
  class Footer {
    public children: any[];
    public opts: any;
    constructor(opts: any) {
      this.opts = opts;
      this.children = opts?.children ?? [];
    }
    get alignment(): string { return this.opts?.alignment ?? ""; }
  }
  class PageNumberClass {
    static CURRENT = PageNumber_CURRENT;
    static TOTAL_PAGES = PageNumber_TOTAL;
    private value: string;
    constructor(value: string) { this.value = value; }
  }
  class Document {
    public sections: any[];
    constructor(opts: any) {
      const rawChildren = opts?.children ?? [];
      this.sections = [{
        properties: opts?.properties ?? {},
        children: rawChildren.map((c: any) => {
          if (c instanceof Paragraph) return c.opts;
          return c;
        }),
        footers: (opts?.footers?.default?.children ?? []).map((f: any) => {
          if (f instanceof Footer) return f;
          return f;
        }),
      }];
    }
  }

  const Packer = {
    async toBuffer(doc: any): Promise<Uint8Array> {
      const section = doc.sections[0];
      const paragraphOpts = section.children ?? [];
      const synthChildren = paragraphOpts.map((p: any) => {
        const runObjs = (p.children ?? []).map((c: any) => {
          const r = new TextRun(c);
          return r;
        });
        return { ...p, children: runObjs };
      });
      const synthFooters = (section.footers ?? []).map((f: any) => {
        const footerChildren = f?.children ?? [];
        const runObjs = footerChildren.map((c: any) => {
          if (c instanceof Paragraph) {
            // Footer's child is a Paragraph — flatten its children into the footer
            const innerRunObjs = (c.opts?.children ?? []).map((ic: any) => {
              const ir = new TextRun(ic);
              return ir;
            });
            return { kind: "paragraph", alignment: c.opts?.alignment ?? "", children: innerRunObjs };
          }
          const r = new TextRun(c);
          return r;
        });
        // Filter to just run objects for now (skip nested paragraphs in footer)
        const plainRuns: any[] = [];
        for (const ro of runObjs) {
          if (ro && typeof ro === "object" && "kind" in ro) {
            // It's a paragraph inside footer — extract its runs
            for (const inner of (ro.children ?? [])) plainRuns.push(inner);
          } else {
            plainRuns.push(ro);
          }
        }
        return { children: plainRuns, alignment: f?.alignment ?? f?.opts?.alignment ?? "" };
      });
      const docForXml = {
        sections: [{
          children: synthChildren,
          footers: synthFooters,
        }],
      };
      return buildDocxXml(docForXml);
    },
  };

  return { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Footer, PageNumber: PageNumberClass };
}

// --- PDF-to-Word helpers (client-bundle safe: no pdf-parse/docx imports) ---
//
// Important: do NOT import pdf-parse, docx, pdfjs-dist or any Node.js-only
// library from this file. The tool registry is bundled for the browser
// (imported by components/site-header.tsx → tool-widget), so any
// `await import("pdf-parse")` here causes webpack's static analysis to
// walk the pdf-parse entry, which top-level `require('fs')`. That produces
// "Module not found: Can't resolve 'fs'" build errors.
//
// Instead, PDF→Word conversion ALWAYS goes via the `/api/pdf-to-word`
// route (server-only). That route runs pdf-parse in an isolated child
// process (lib/pdf-parse-worker/pdf-worker.cjs), which is invisible to
// webpack and therefore guaranteed-stable.

/** --- Registry queries — typed, centralised. --- */

export function getLiveTools(): ToolDefinition[] {
  return TOOLS.filter((t) => t.status === "live");
}

export function getAllToolsForAdmin(): ToolDefinition[] {
  // Admin sees live + hidden + coming-soon; 410 controller still applies per-tool.
  return TOOLS;
}

export function getToolBySlug(slug: string): ToolDefinition | undefined {
  return TOOLS.find((t) => t.slug === slug);
}

export function getToolsByCategory(category: Exclude<CategorySlug, "all">): ToolDefinition[] {
  return TOOLS.filter((t) => t.category === category && t.status === "live");
}

export function getCategoryInfo(slug: CategorySlug): CategoryInfo | undefined {
  return CATEGORIES.find((c) => c.slug === slug);
}

export function getCategoryCounts(): Record<CategorySlug, number> {
  const counts = {} as Record<CategorySlug, number>;
  for (const c of CATEGORIES) counts[c.slug] = 0;
  for (const t of TOOLS) {
    if (t.status !== "live") continue;
    counts[t.category] = (counts[t.category] ?? 0) + 1;
    counts.all = (counts.all ?? 0) + 1;
  }
  return counts;
}

export function searchTools(query: string): ToolDefinition[] {
  const q = query.trim().toLowerCase();
  if (!q) return getLiveTools();
  return TOOLS.filter((t) => {
    if (t.status !== "live") return false;
    return (
      t.name.toLowerCase().includes(q) ||
      t.tagline.toLowerCase().includes(q) ||
      t.keywords.some((k) => k.toLowerCase().includes(q)) ||
      t.seo.relatedKeywords.some((k) => k.toLowerCase().includes(q))
    );
  });
}

export function getRelatedTools(tool: ToolDefinition, limit = 6): ToolDefinition[] {
  // Same category first; then keyword overlap. Avoid returning the same tool.
  const pool = TOOLS.filter((t) => t.slug !== tool.slug && t.status === "live");
  const score = (t: ToolDefinition) => {
    let s = 0;
    if (t.category === tool.category) s += 5;
    const overlap = new Set(
      [...t.keywords, ...t.seo.relatedKeywords].map((k) => k.toLowerCase())
    );
    const source = new Set(
      [...tool.keywords, ...tool.seo.relatedKeywords].map((k) => k.toLowerCase())
    );
    // Pre-ES2015-compatible iteration (avoid downlevelIteration requirement)
    Array.from(source).forEach((k) => { if (overlap.has(k)) s += 1; });
    return s;
  };
  return pool.sort((a, b) => score(b) - score(a)).slice(0, limit);
}

/** --- Static-generation helpers (Module 8 SEO). --- */

export function getAllSlugsForSitemap(): string[] {
  return TOOLS.filter((t) => t.status === "live").map((t) => t.slug);
}

export function getCategoryLandingSlugs(): CategorySlug[] {
  return CATEGORIES.filter((c) => c.slug !== "all").map((c) => c.slug);
}

/** --- Processor slots (Module 2 engine). Implementations go here. --- */
// Keyed by tool.processorId. Return type = `ProcessorFn`. When processor === "stub"
// the engine shows "Coming soon" automatically.
//
// PROCESSOR CONTRACTS (payload / response shape, specific to each toolId):
//   ai/rewriter
//       payload = { text: string, intensity: "light"|"balanced"|"deep", tone: string, preserveKeyTerms: boolean, plan: PlanTier }
//       response = { output: string, similarityPercent: number, outputChars: number, watermark: boolean, sideBySideDiff?: Array<{kind:"add"|"del"|"same",text:string}> }
//
//   pdf/split-v2
//       payload = { mode: "ranges"|"everyN"|"bookmarks", pageRangesText?: string, everyN?: number,
//                   prefix?: string, sourcePages?: number, plan: PlanTier, sourceName: string, fileBytesBase64?: string }
//       response = { jobId: string, files: Array<{name:string, sizeBytes:number, pages:string, downloadUrl:string}>, zipDownloadUrl?: string }
//
//   image/cropper
//       payload = { dataUrl: string, x: number, y: number, w: number, h: number,
//                   outFormat: "original"|"jpeg"|"webp"|"png", quality: number, originalName: string, originalType: string }
//       response = { downloadName: string, blobBase64: string, blobType: string, sizeBytes: number, originalSizeBytes: number }
//
//   qr/generate
//       payload = { dataType: "Text"|"URL"|"Email"|"Phone"|"Wi-Fi", size: number,
//                   fgColor: string, bgColor: string, errorLevel: "L"|"M"|"Q"|"H",
//                   fields: Record<string,string>, plan: PlanTier, logoDataUrl?: string }
//       response = { pngDataUrl: string, svgMarkup?: string, epsMarkup?: string, downloadName: string }
//
//   text/word-counter
//       payload = { text: string, readWpm: number, speakWpm: number, stopLang: "English"|"Spanish"|"French"|"German" }
//       response = WordCounterResult (see type below)
//
//   image/compress-client
//       payload = { fileBytesBase64: string, originalName: string, originalSizeBytes: number, originalType: string,
//                   mode: "Quality slider"|"Target file size"|"Auto (recommended)", quality: number, targetSizeKB: number,
//                   maxWidth: number, maxHeight: number, format: "Original"|"JPG"|"WebP"|"PNG", stripMeta: boolean }
//       response = ImageCompressResult (see type below)
//
//   pdf/to-word
//       payload = { fileBytesBase64?: string, sourceName?: string, sourcePages?: number,
//                   outputFormat: ".docx"|".txt", ocrFallback: boolean, plan?: "free"|"pro" }
//       response = PdfToWordResult (see type below)
//
//   security/password-gen
//       payload = { mode: "Random password"|"Passphrase (words)", length: number, upper: boolean, lower: boolean,
//                   numbers: boolean, symbols: boolean, noAmbiguous: boolean, words: number,
//                   separator: "hyphen"|"space"|"period"|"none", capitalize: boolean, appendNumber: boolean,
//                   batchCount: number, plan?: "free"|"pro" }
//       response = PasswordGenResult (see type below)

export type RewriterDiffSpan =
  | { kind: "add" | "del" | "same"; text: string };

export type SplitOutFile = {
  name: string;
  sizeBytes: number;
  pages: string;
  /** downloadUrl is filled in by the UI layer post-process (blob conversion) — may be empty at processor-response time. */
  downloadUrl?: string;
  /** Base64-encoded PDF bytes (client-side splitting), or image bytes (image compressor). */
  bytesBase64?: string;
  // Optional extras used by the UI layer (image compressor, etc)
  mimeType?: string;
  originalSizeBytes?: number;
  sizeLabel?: string;
  kind?: "pages" | "file";
};

export type WordCounterResult = {
  words: number;
  charsWithSpaces: number;
  charsWithoutSpaces: number;
  sentences: number;
  paragraphs: number;
  uniqueWords: number;
  readingTime: string; // "2m 17s"
  speakingTime: string;
  topWords: Array<{ word: string; count: number; pct: number }>;
  longSentences: Array<{ index: number; words: number; text: string; startChar: number }>;
};

export type PasswordGenResult = {
  passwords: string[];
  entropyBits: number;
  strength: "Weak" | "Fair" | "Good" | "Strong" | "Very Strong";
  mode: "random" | "passphrase";
};

export type ImageCompressResultItem = {
  originalName: string;
  originalSizeBytes: number;
  compressedSizeBytes: number;
  originalW: number;
  originalH: number;
  outputW: number;
  outputH: number;
  savingsPercent: number;
  bytesBase64: string;
  mimeType: string;
  downloadName: string;
};
export type ImageCompressResult = { files: ImageCompressResultItem[]; totalOriginalBytes: number; totalCompressedBytes: number; totalSavingsPercent: number };

export type PdfToWordResult = {
  fileName: string;
  downloadUrl: string;
  sizeBytes: number;
  pagesProcessed: number;
  tablesDetected: number;
  ocrUsed: boolean;
  outputFormat: ".docx" | ".txt";
  firstPagePreview: string;
};

/** 1h TTL LLM response cache — identical payloads reuse same LLM answer. */
const _rewriterCache = new Map<string, { ts: number; resp: unknown }>();
function getRewriterCached(key: string): unknown | undefined {
  const hit = _rewriterCache.get(key);
  if (!hit) return undefined;
  if (Date.now() - hit.ts > 60 * 60 * 1000) {
    _rewriterCache.delete(key);
    return undefined;
  }
  return hit.resp;
}
function setRewriterCached(key: string, resp: unknown) {
  _rewriterCache.set(key, { ts: Date.now(), resp });
}

/** Lightweight similarity (not cryptographically strong; UX display only).
 *  Token-based Jaccard + overlap Dice. Returns 0-100 percentage.
 */
function similarityScore(a: string, b: string): number {
  const tokenize = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9\u00C0-\u024F\s]/g, " ")
      .split(/\s+/)
      .filter(Boolean);
  const ta = tokenize(a);
  const tb = tokenize(b);
  if (ta.length === 0 && tb.length === 0) return 0;
  const sa = new Set(ta);
  const sb = new Set(tb);
  let inter = 0;
  sa.forEach((t) => {
    if (sb.has(t)) inter++;
  });
  const union = sa.size + sb.size - inter || 1;
  const jaccard = inter / union;
  const dice = (2 * inter) / (sa.size + sb.size || 1);
  return Math.round(100 * (jaccard * 0.4 + dice * 0.6));
}

/* ============================================================================
 *  LOCAL REWRITER — aggressive multi-pass text transformation engine.
 *
 *  Pipeline (5 stages):
 *    1. Phrase swaps   — multi-word pattern substitution
 *    2. Token rewrite  — per-occurrence synonym swap with position-aware hashing
 *    3. Sentence restructure — clause-level reordering, voice shift, prefixing
 *    4. Structural morph  — deep-only: sentence reorder, merge, split, frame
 *    5. Tone polish    — register shift (Formal / Casual / Academic)
 *
 *  Intensity controls:
 *    Light   → 50% token swap + Light restructuring only
 *    Balanced → 85% token swap + full clause restructure + voice shift
 *    Deep    → 100% token swap + all restructure + sentence reorder + framing
 *
 *  The key design choice: swap decisions are per-OCCURRENCE (not per word
 *  type), using position in the source string as hash input. This ensures
 *  "the" appearing 5 times gets independent decisions, producing genuinely
 *  transformed output rather than all-or-nothing replacements.
 * ============================================================================ */

/** Synonym dictionary. Each entry [source, replacement, alt].
 *  The processor cycles through alternatives for variety.
 */
const SYNONYMS: Array<[string, string, string?]> = [
  ["use", "utilize", "employ"],
  ["uses", "employs", "utilizes"],
  ["used", "utilized", "employed"],
  ["make", "create", "produce"],
  ["makes", "creates", "produces"],
  ["made", "created", "produced"],
  ["get", "obtain", "acquire"],
  ["gets", "obtains", "acquires"],
  ["got", "obtained", "acquired"],
  ["show", "demonstrate", "indicate"],
  ["shows", "demonstrates", "indicates"],
  ["showed", "demonstrated", "indicated"],
  ["help", "assist", "aid"],
  ["helps", "assists", "aids"],
  ["helped", "assisted", "aided"],
  ["need", "require", "necessitate"],
  ["needs", "requires", "necessitates"],
  ["needed", "required", "necessitated"],
  ["want", "desire", "seek"],
  ["wants", "desires", "seeks"],
  ["wanted", "desired", "sought"],
  ["think", "consider", "believe"],
  ["thinks", "considers", "believes"],
  ["thought", "considered", "believed"],
  ["know", "understand", "recognize"],
  ["knows", "understands", "recognizes"],
  ["knew", "understood", "recognized"],
  ["find", "discover", "identify"],
  ["finds", "discovers", "identifies"],
  ["found", "discovered", "identified"],
  ["try", "attempt", "endeavor"],
  ["tries", "attempts", "endeavors"],
  ["tried", "attempted", "endeavored"],
  ["start", "begin", "commence"],
  ["starts", "begins", "commences"],
  ["started", "began", "commenced"],
  ["stop", "cease", "terminate"],
  ["stops", "ceases", "terminates"],
  ["stopped", "ceased", "terminated"],
  ["change", "modify", "alter"],
  ["changes", "modifies", "alters"],
  ["changed", "modified", "altered"],
  ["create", "produce", "generate"],
  ["creates", "produces", "generates"],
  ["created", "produced", "generated"],
  ["build", "construct", "assemble"],
  ["builds", "constructs", "assembles"],
  ["built", "constructed", "assembled"],
  ["give", "provide", "supply"],
  ["gives", "provides", "supplies"],
  ["gave", "provided", "supplied"],
  ["see", "observe", "notice"],
  ["sees", "observes", "notices"],
  ["saw", "observed", "noticed"],
  ["seem", "appear", "look"],
  ["seems", "appears", "looks"],
  ["seemed", "appeared", "looked"],
  ["keep", "maintain", "preserve"],
  ["keeps", "maintains", "preserves"],
  ["kept", "maintained", "preserved"],
  ["allow", "enable", "permit"],
  ["allows", "enables", "permits"],
  ["allowed", "enabled", "permitted"],
  ["say", "state", "express"],
  ["says", "states", "expresses"],
  ["said", "stated", "expressed"],
  ["tell", "inform", "notify"],
  ["tells", "informs", "notifies"],
  ["told", "informed", "notified"],
  ["ask", "inquire", "query"],
  ["asks", "inquires", "queries"],
  ["asked", "inquired", "queried"],
  ["answer", "respond", "reply"],
  ["answers", "responds", "replies"],
  ["answered", "responded", "replied"],
  ["believe", "hold", "maintain"],
  ["believes", "holds", "maintains"],
  ["believed", "held", "maintained"],
  ["achieve", "attain", "accomplish"],
  ["achieves", "attains", "accomplishes"],
  ["achieved", "attained", "accomplished"],
  ["reduce", "decrease", "lower"],
  ["reduces", "decreases", "lowers"],
  ["reduced", "decreased", "lowered"],
  ["increase", "expand", "grow"],
  ["increases", "expands", "grows"],
  ["increased", "expanded", "grew"],
  ["improve", "enhance", "refine"],
  ["improves", "enhances", "refines"],
  ["improved", "enhanced", "refined"],
  ["develop", "evolve", "advance"],
  ["develops", "evolves", "advances"],
  ["developed", "evolved", "advanced"],
  ["establish", "found", "institute"],
  ["establishes", "founds", "institutes"],
  ["established", "founded", "instituted"],
  ["operate", "function", "perform"],
  ["operates", "functions", "performs"],
  ["operated", "functioned", "performed"],
  ["require", "demand", "call for"],
  ["requires", "demands", "calls for"],
  ["required", "demanded", "called for"],
  ["suggest", "propose", "recommend"],
  ["suggests", "proposes", "recommends"],
  ["suggested", "proposed", "recommended"],
  ["discuss", "examine", "explore"],
  ["discusses", "examines", "explores"],
  ["discussed", "examined", "explored"],
  ["argue", "contend", "assert"],
  ["argues", "contends", "asserts"],
  ["argued", "contended", "asserted"],
  ["consume", "utilize", "deplete"],
  ["consumes", "utilizes", "depletes"],
  ["consumed", "utilized", "depleted"],
  ["produce", "generate", "yield"],
  ["produces", "generates", "yields"],
  ["produced", "generated", "yielded"],
  ["obtain", "acquire", "secure"],
  ["obtains", "acquires", "secures"],
  ["obtained", "acquired", "secured"],
  ["examine", "inspect", "analyze"],
  ["examines", "inspects", "analyzes"],
  ["examined", "inspected", "analyzed"],
  ["involve", "entail", "include"],
  ["involves", "entails", "includes"],
  ["involved", "entailed", "included"],
  ["focus", "concentrate", "center"],
  ["focuses", "concentrates", "centers"],
  ["focused", "concentrated", "centered"],
  // Adjectives with alternates
  ["good", "favorable", "advantageous"],
  ["great", "excellent", "superb"],
  ["bad", "unfavorable", "detrimental"],
  ["big", "substantial", "considerable"],
  ["small", "modest", "minor"],
  ["large", "considerable", "sizable"],
  ["important", "significant", "crucial"],
  ["main", "primary", "principal"],
  ["key", "central", "critical"],
  ["new", "novel", "fresh"],
  ["old", "established", "longstanding"],
  ["first", "initial", "primary"],
  ["last", "final", "concluding"],
  ["next", "subsequent", "following"],
  ["easy", "straightforward", "simple"],
  ["hard", "challenging", "difficult"],
  ["fast", "rapid", "swift"],
  ["slow", "gradual", "leisurely"],
  ["high", "elevated", "advanced"],
  ["low", "reduced", "diminished"],
  ["strong", "robust", "powerful"],
  ["weak", "limited", "feeble"],
  ["clear", "evident", "obvious"],
  ["simple", "uncomplicated", "basic"],
  ["complex", "intricate", "complicated"],
  ["common", "prevalent", "widespread"],
  ["rare", "uncommon", "scarce"],
  ["different", "distinct", "separate"],
  ["similar", "comparable", "alike"],
  ["same", "identical", "equivalent"],
  ["whole", "entire", "complete"],
  ["part", "portion", "segment"],
  ["full", "complete", "comprehensive"],
  ["real", "genuine", "actual"],
  ["true", "accurate", "correct"],
  ["right", "correct", "proper"],
  ["wrong", "incorrect", "erroneous"],
  ["happy", "pleased", "delighted"],
  ["sad", "unhappy", "dejected"],
  ["effective", "efficient", "potent"],
  ["efficient", "effective", "streamlined"],
  ["valuable", "worthwhile", "beneficial"],
  ["significant", "substantial", "meaningful"],
  ["necessary", "essential", "vital"],
  ["available", "accessible", "obtainable"],
  ["relevant", "pertinent", "applicable"],
  ["adequate", "sufficient", "satisfactory"],
  ["appropriate", "suitable", "fitting"],
  ["particular", "specific", "distinct"],
  ["general", "overall", "broad"],
  ["specific", "particular", "precise"],
  ["efficient", "effective", "optimized"],
  ["powerful", "potent", "formidable"],
  ["diverse", "varied", "assorted"],
  ["unified", "consolidated", "integrated"],
  ["sophisticated", "complex", "advanced"],
  ["innovative", "novel", "creative"],
  ["successful", "effective", "prosperous"],
  ["comprehensive", "complete", "thorough"],
  ["fundamental", "basic", "essential"],
  ["crucial", "critical", "vital"],
  ["obvious", "apparent", "evident"],
  ["apparent", "obvious", "clear"],
  ["consistent", "uniform", "steady"],
  ["reliable", "dependable", "trustworthy"],
  ["flexible", "adaptable", "versatile"],
  ["aggressive", "assertive", "vigorous"],
  ["conservative", "cautious", "moderate"],
  ["significant", "meaningful", "important"],
  ["substantial", "considerable", "material"],
  ["controversial", "debatable", "disputed"],
  ["compatible", "harmonious", "congruous"],
  ["incompatible", "conflicting", "contradictory"],
  ["sustainable", "viable", "tenable"],
  ["prominent", "eminent", "distinguished"],
  ["persistent", "consistent", "relentless"],
  ["widespread", "prevalent", "extensive"],
  ["extensive", "comprehensive", "wide-ranging"],
  ["intensive", "concentrated", "focused"],
  ["selective", "targeted", "focused"],
  ["comprehensive", "exhaustive", "inclusive"],
  ["systematic", "methodical", "organized"],
  ["organic", "natural", "integrated"],
  ["mechanical", "automated", "procedural"],
  ["dynamic", "vigorous", "fluctuating"],
  ["static", "stationary", "fixed"],
  ["volatile", "unstable", "erratic"],
  ["stable", "steady", "consistent"],
  ["robust", "strong", "resilient"],
  ["fragile", "delicate", "brittle"],
  ["severe", "grave", "critical"],
  ["moderate", "average", "intermediate"],
  ["extreme", "drastic", "radical"],
  ["modest", "limited", "minimal"],
  ["considerable", "substantial", "significant"],
  ["remarkable", "notable", "striking"],
  ["ordinary", "commonplace", "routine"],
  ["extraordinary", "exceptional", "remarkable"],
  ["typical", "standard", "conventional"],
  ["unique", "distinctive", "one-of-a-kind"],
  ["consistent", "coherent", "consonant"],
  ["coherent", "consistent", "logical"],
  ["logical", "rational", "reasonable"],
  ["rational", "logical", "sensible"],
  ["reasonable", "sensible", "fair"],
  ["valid", "sound", "legitimate"],
  ["sound", "valid", "reliable"],
  ["secure", "safe", "protected"],
  ["safe", "secure", "harmless"],
  ["dangerous", "hazardous", "risky"],
  ["risky", "hazardous", "perilous"],
  ["uncertain", "doubtful", "questionable"],
  ["confident", "certain", "assured"],
  ["reluctant", "hesitant", "unwilling"],
  ["willing", "eager", "prepared"],
  ["deliberate", "intentional", "calculated"],
  ["accidental", "unintentional", "inadvertent"],
  ["voluntary", "optional", "discretionary"],
  ["compulsory", "mandatory", "obligatory"],
  ["mandatory", "compulsory", "required"],
  ["optional", "voluntary", "discretionary"],
  ["desirable", "preferable", "advantageous"],
  ["undesirable", "unwanted", "disadvantageous"],
  ["acceptable", "tolerable", "satisfactory"],
  ["unacceptable", "intolerable", "objectionable"],
  ["feasible", "viable", "practical"],
  ["infeasible", "impractical", "unviable"],
  // Adverbs with alternates — degree/frequency/manner.
  // NOTE: function words (very, just, simply, also, then, etc.) are handled in
  // the clause restructure pass or are intentionally preserved to keep syntax.
  ["really", "genuinely", "truly"],
  ["quite", "fairly", "rather"],
  ["extremely", "exceptionally", "remarkably"],
  ["highly", "considerably", "significantly"],
  ["significantly", "substantially", "noticeably"],
  ["substantially", "considerably", "markedly"],
  ["markedly", "noticeably", "distinctly"],
  ["noticeably", "markedly", "significantly"],
  ["additionally", "furthermore", "moreover"],
  ["consequently", "therefore", "thus"],
  ["however", "nevertheless", "nonetheless"],
  // NOTE: "because/although/but/so/then/and/or/while/whereas/unless/until/since"
  // are clause subordinators — handled in `restructureSentences` so their
  // argument structure is preserved. No token-level synonym swap.
  ["now", "currently", "presently"],
  ["often", "frequently", "regularly"],
  ["always", "consistently", "invariably"],
  ["never", "rarely", "seldom"],
  ["usually", "typically", "ordinarily"],
  ["sometimes", "occasionally", "at times"],
  ["quickly", "rapidly", "swiftly"],
  ["slowly", "gradually", "steadily"],
  ["easily", "readily", "effortlessly"],
  ["hardly", "barely", "scarcely"],
  ["clearly", "obviously", "evidently"],
  ["apparently", "seemingly", "ostensibly"],
  ["approximately", "roughly", "around"],
  ["precisely", "exactly", "strictly"],
  ["definitely", "certainly", "absolutely"],
  ["probably", "likely", "presumably"],
  ["possibly", "potentially", "conceivably"],
  ["obviously", "clearly", "evidently"],
  ["evidently", "obviously", "apparently"],
  ["particularly", "especially", "specifically"],
  ["generally", "usually", "commonly"],
  ["seriously", "genuinely", "sincerely"],
  ["increasingly", "progressively", "steadily"],
  ["decreasingly", "decliningly", "diminishingly"],
  // NOTE: "nor/for/whether" are also function words — no token swap.
  // Nouns with alternates
  ["problem", "issue", "challenge"],
  ["problems", "issues", "challenges"],
  ["solution", "resolution", "answer"],
  ["solutions", "resolutions", "answers"],
  ["way", "method", "approach"],
  ["ways", "methods", "approaches"],
  ["idea", "concept", "notion"],
  ["ideas", "concepts", "notions"],
  ["reason", "cause", "factor"],
  ["reasons", "causes", "factors"],
  ["result", "outcome", "consequence"],
  ["results", "outcomes", "consequences"],
  ["people", "individuals", "persons"],
  ["person", "individual", "human"],
  ["thing", "element", "aspect"],
  ["things", "elements", "aspects"],
  ["part", "component", "piece"],
  ["parts", "components", "pieces"],
  ["area", "domain", "field"],
  ["areas", "domains", "fields"],
  ["world", "globe", "planet"],
  ["day", "period", "span"],
  ["year", "annum", "period"],
  ["years", "annums", "periods"],
  ["work", "effort", "endeavor"],
  ["works", "efforts", "endeavors"],
  ["job", "task", "assignment"],
  ["goal", "objective", "aim"],
  ["goals", "objectives", "aims"],
  ["plan", "strategy", "approach"],
  ["plans", "strategies", "approaches"],
  ["question", "inquiry", "query"],
  ["questions", "inquiries", "queries"],
  ["answer", "response", "reply"],
  ["answers", "responses", "replies"],
  ["story", "narrative", "account"],
  ["stories", "narratives", "accounts"],
  ["example", "instance", "case"],
  ["examples", "instances", "cases"],
  ["data", "information", "figures"],
  ["fact", "detail", "point"],
  ["facts", "details", "points"],
  ["system", "structure", "framework"],
  ["systems", "structures", "frameworks"],
  ["process", "procedure", "method"],
  ["processes", "procedures", "methods"],
  ["structure", "framework", "architecture"],
  ["structures", "frameworks", "architectures"],
  ["development", "evolution", "progress"],
  ["environment", "setting", "context"],
  ["circumstance", "condition", "situation"],
  ["circumstances", "conditions", "situations"],
  ["approach", "method", "strategy"],
  ["approaches", "methods", "strategies"],
  ["method", "approach", "technique"],
  ["methods", "approaches", "techniques"],
  ["technique", "method", "procedure"],
  ["techniques", "methods", "procedures"],
  ["performance", "execution", "operation"],
  ["function", "purpose", "role"],
  ["functions", "purposes", "roles"],
  ["role", "function", "part"],
  ["roles", "functions", "parts"],
  ["factor", "element", "variable"],
  ["factors", "elements", "variables"],
  ["element", "factor", "component"],
  ["elements", "factors", "components"],
  ["component", "element", "part"],
  ["components", "elements", "parts"],
  ["aspect", "element", "feature"],
  ["aspects", "elements", "features"],
  ["feature", "characteristic", "attribute"],
  ["features", "characteristics", "attributes"],
  ["characteristic", "feature", "trait"],
  ["characteristics", "features", "traits"],
  ["attribute", "characteristic", "property"],
  ["attributes", "characteristics", "properties"],
  ["property", "attribute", "characteristic"],
  ["properties", "attributes", "characteristics"],
  ["strategy", "approach", "plan"],
  ["strategies", "approaches", "plans"],
  ["policy", "guideline", "regulation"],
  ["policies", "guidelines", "regulations"],
  ["regulation", "rule", "policy"],
  ["regulations", "rules", "policies"],
  ["rule", "regulation", "policy"],
  ["rules", "regulations", "policies"],
  ["principle", "rule", "doctrine"],
  ["principles", "rules", "doctrines"],
  ["concept", "idea", "notion"],
  ["concepts", "ideas", "notions"],
  ["notion", "concept", "idea"],
  ["notions", "concepts", "ideas"],
  ["theory", "model", "framework"],
  ["theories", "models", "frameworks"],
  ["model", "theory", "framework"],
  ["models", "theories", "frameworks"],
  ["framework", "structure", "model"],
  ["frameworks", "structures", "models"],
  ["pattern", "model"],
  ["patterns", "models"],
  ["template", "pattern", "model"],
  ["templates", "patterns", "models"],
  ["stage", "phase", "step"],
  ["stages", "phases", "steps"],
  ["phase", "stage", "step"],
  ["phases", "stages", "steps"],
  ["step", "phase", "stage"],
  ["steps", "phases", "stages"],
  ["level", "degree", "grade"],
  ["levels", "degrees", "grades"],
  ["degree", "level", "extent"],
  ["degrees", "levels", "extents"],
  ["extent", "degree", "scope"],
  ["scope", "extent", "range"],
  ["range", "scope", "extent"],
  ["scale", "scope", "magnitude"],
  ["magnitude", "scale", "size"],
  ["size", "dimensions", "magnitude"],
  ["dimensions", "sizes", "proportions"],
  ["proportion", "ratio", "percentage"],
  ["proportions", "ratios", "percentages"],
  ["percentage", "proportion", "ratio"],
  ["percentages", "proportions", "ratios"],
  ["quantity", "amount", "volume"],
  ["quantities", "amounts", "volumes"],
  ["amount", "quantity", "volume"],
  ["amounts", "quantities", "volumes"],
  ["volume", "amount", "quantity"],
  ["volumes", "amounts", "quantities"],
  ["quality", "excellence", "superiority"],
  ["grade", "quality", "level"],
  ["grades", "qualities", "levels"],
  ["excellence", "superiority", "quality"],
  ["superiority", "excellence", "quality"],
  ["inferiority", "subpar", "poor quality"],
  ["performance", "achievement", "result"],
  ["achievement", "accomplishment", "success"],
  ["achievements", "accomplishments", "successes"],
  ["success", "achievement", "triumph"],
  ["successes", "achievements", "triumphs"],
  ["failure", "defeat", "breakdown"],
  ["failures", "defeats", "breakdowns"],
  ["effort", "attempt", "endeavor"],
  ["efforts", "attempts", "endeavors"],
  ["attempt", "effort", "try"],
  ["attempts", "efforts", "tries"],
  ["challenge", "difficulty", "obstacle"],
  ["challenges", "difficulties", "obstacles"],
  ["difficulty", "challenge", "hardship"],
  ["difficulties", "challenges", "hardships"],
  ["obstacle", "barrier", "hurdle"],
  ["obstacles", "barriers", "hurdles"],
  ["barrier", "obstacle", "hindrance"],
  ["barriers", "obstacles", "hindrances"],
  ["breakthrough", "discovery", "innovation"],
  ["breakthroughs", "discoveries", "innovations"],
  ["discovery", "finding", "breakthrough"],
  ["discoveries", "findings", "breakthroughs"],
  ["innovation", "breakthrough", "advancement"],
  ["innovations", "breakthroughs", "advancements"],
  ["advancement", "progress", "improvement"],
  ["advancements", "progresses", "improvements"],
  ["progress", "advancement", "improvement"],
  ["progresses", "advancements", "improvements"],
  ["improvement", "enhancement", "refinement"],
  ["improvements", "enhancements", "refinements"],
  ["enhancement", "improvement", "augmentation"],
  ["enhancements", "improvements", "augmentations"],
  ["refinement", "improvement", "polish"],
  ["refinements", "improvements", "polishes"],
  ["development", "growth", "evolution"],
  ["growth", "development", "expansion"],
  ["expansion", "growth", "extension"],
  ["extension", "expansion", "continuation"],
  ["evolution", "development", "progression"],
  ["progression", "evolution", "advancement"],
  ["transformation", "change", "conversion"],
  ["transformations", "changes", "conversions"],
  ["conversion", "transformation", "adaptation"],
  ["conversions", "transformations", "adaptations"],
  ["adaptation", "adjustment", "modification"],
  ["adaptations", "adjustments", "modifications"],
  ["adjustment", "adaptation", "modification"],
  ["adjustments", "adaptations", "modifications"],
  ["modification", "change", "alteration"],
  ["modifications", "changes", "alterations"],
  ["alteration", "modification", "change"],
  ["alterations", "modifications", "changes"],
  ["revolution", "transformation", "radical change"],
  ["revolutions", "transformations", "radical changes"],
  ["revolutionary", "radical", "groundbreaking"],
  ["groundbreaking", "innovative", "revolutionary"],
  ["radical", "revolutionary", "fundamental"],
  ["fundamental", "basic", "essential"],
  ["essential", "necessary", "crucial"],
  ["crucial", "essential", "critical"],
  ["critical", "crucial", "vital"],
  ["vital", "critical", "essential"],
  ["significant", "important", "substantial"],
  ["substantial", "significant", "considerable"],
  ["considerable", "substantial", "significant"],
  ["material", "substantial", "tangible"],
  ["tangible", "material", "concrete"],
  ["concrete", "tangible", "specific"],
  ["specific", "particular", "precise"],
  ["precise", "exact", "accurate"],
  ["exact", "precise", "accurate"],
  ["accurate", "precise", "exact"],
  ["inaccurate", "imprecise", "wrong"],
  ["wrong", "incorrect", "erroneous"],
  ["correct", "right", "accurate"],
  ["incorrect", "wrong", "inaccurate"],
  ["erroneous", "incorrect", "mistaken"],
  ["mistaken", "wrong", "incorrect"],
  ["prevalent", "widespread", "common"],
  ["widespread", "prevalent", "extensive"],
  ["extensive", "widespread", "comprehensive"],
  ["comprehensive", "extensive", "thorough"],
  ["thorough", "comprehensive", "detailed"],
  ["detailed", "thorough", "specific"],
  ["specific", "detailed", "particular"],
  ["particular", "specific", "special"],
  ["special", "particular", "unique"],
  ["unique", "special", "distinctive"],
  ["distinctive", "unique", "characteristic"],
  ["characteristic", "distinctive", "typical"],
  ["typical", "characteristic", "usual"],
  ["usual", "typical", "customary"],
  ["customary", "usual", "conventional"],
  ["conventional", "customary", "traditional"],
  ["traditional", "conventional", "classic"],
  ["classic", "traditional", "timeless"],
  ["contemporary", "modern", "current"],
  ["modern", "contemporary", "current"],
  ["current", "present", "contemporary"],
  ["present", "current", "today's"],
  ["ancient", "old", "archaic"],
  ["archaic", "ancient", "obsolete"],
  ["obsolete", "outdated", "antiquated"],
  ["outdated", "obsolete", "antiquated"],
  ["antiquated", "outdated", "archaic"],
  ["dominant", "prevailing", "predominant"],
  ["prevailing", "dominant", "current"],
  ["predominant", "dominant", "chief"],
  ["chief", "principal", "main"],
  ["principal", "main", "primary"],
  ["primary", "secondary", "main"],
  ["secondary", "primary", "subsidiary"],
  ["subsidiary", "secondary", "auxiliary"],
  ["auxiliary", "subsidiary", "supplementary"],
  ["supplementary", "auxiliary", "additional"],
  ["additional", "supplementary", "extra"],
  ["extra", "additional", "supplementary"],
  ["alternative", "option", "choice"],
  ["alternatives", "options", "choices"],
  ["option", "alternative", "choice"],
  ["options", "alternatives", "choices"],
  ["choice", "option", "alternative"],
  ["choices", "options", "alternatives"],
  ["decision", "choice", "determination"],
  ["decisions", "choices", "determinations"],
  ["determination", "decision", "resolve"],
  ["determinations", "decisions", "resolves"],
  ["resolution", "determination", "decision"],
  ["resolutions", "determinations", "decisions"],
  ["commitment", "dedication", "engagement"],
  ["commitments", "dedications", "engagements"],
  ["dedication", "commitment", "devotion"],
  ["devotion", "dedication", "commitment"],
  ["engagement", "involvement", "commitment"],
  ["involvement", "engagement", "participation"],
  ["participation", "involvement", "engagement"],
  ["contribution", "donation", "input"],
  ["contributions", "donations", "inputs"],
  ["input", "contribution", "feedback"],
  ["output", "result", "product"],
  ["product", "output", "result"],
  ["products", "outputs", "results"],
  ["service", "offering", "assistance"],
  ["services", "offerings", "assistance"],
  ["offering", "service", "provision"],
  ["offerings", "services", "provisions"],
  ["provision", "supply", "offering"],
  ["provisions", "supplies", "offerings"],
  ["supply", "provision", "stock"],
  ["supplies", "provisions", "stocks"],
  ["demand", "request", "requirement"],
  ["demands", "requests", "requirements"],
  ["request", "demand", "appeal"],
  ["requests", "demands", "appeals"],
  ["requirement", "demand", "necessity"],
  ["requirements", "demands", "necessities"],
  ["necessity", "requirement", "essential"],
  ["necessities", "requirements", "essentials"],
  ["essential", "necessary", "crucial"],
  ["necessities", "needs", "essentials"],
  ["need", "requirement", "necessity"],
  ["needs", "requirements", "necessities"],
  // NOTE: "have/has/had/having" as auxiliaries are in SWAP_BLACKLIST.
  // The full-verb senses are handled by restructure patterns "have" → "possess" when safe.
  ["produce", "generate", "manufacture"],
  ["produces", "generates", "manufactures"],
  ["produced", "generated", "manufactured"],
  ["consume", "use", "utilize"],
  ["consumes", "uses", "utilizes"],
  ["consumed", "used", "utilized"],
  ["process", "handle", "manage"],
  ["processes", "handles", "manages"],
  ["processed", "handled", "managed"],
  ["handle", "manage", "process"],
  ["handles", "manages", "processes"],
  ["handled", "managed", "processed"],
  ["manage", "administer", "oversee"],
  ["manages", "administers", "oversees"],
  ["managed", "administered", "oversaw"],
  ["oversee", "supervise", "manage"],
  ["oversees", "supervises", "manages"],
  ["oversaw", "supervised", "managed"],
  ["administer", "manage", "oversee"],
  ["administers", "manages", "oversees"],
  ["administered", "managed", "oversaw"],
  ["supervise", "oversee", "superintend"],
  ["supervises", "oversees", "superintends"],
  ["supervised", "oversaw", "superintended"],
  ["conduct", "carry out", "perform"],
  ["conducts", "carries out", "performs"],
  ["conducted", "carried out", "performed"],
  ["perform", "execute", "carry out"],
  ["performs", "executes", "carries out"],
  ["performed", "executed", "carried out"],
  ["execute", "perform", "implement"],
  ["executes", "performs", "implements"],
  ["executed", "performed", "implemented"],
  ["implement", "execute", "apply"],
  ["implements", "executes", "applies"],
  ["implemented", "executed", "applied"],
  ["apply", "implement", "execute"],
  ["applies", "implements", "executes"],
  ["applied", "implemented", "executed"],
  ["deploy", "launch", "roll out"],
  ["deploys", "launches", "rolls out"],
  ["deployed", "launched", "rolled out"],
  ["launch", "deploy", "introduce"],
  ["launches", "deploys", "introduces"],
  ["launched", "deployed", "introduced"],
  ["introduce", "launch", "present"],
  ["introduces", "launches", "presents"],
  ["introduced", "launched", "presented"],
  ["present", "introduce", "show"],
  ["presents", "introduces", "shows"],
  ["presented", "introduced", "showed"],
  ["show", "present", "demonstrate"],
  ["shows", "presents", "demonstrates"],
  ["showed", "presented", "demonstrated"],
  ["demonstrate", "show", "prove"],
  ["demonstrates", "shows", "proves"],
  ["demonstrated", "showed", "proved"],
  ["prove", "demonstrate", "verify"],
  ["proves", "demonstrates", "verifies"],
  ["proved", "demonstrated", "verified"],
  ["verify", "confirm", "validate"],
  ["verifies", "confirms", "validates"],
  ["verified", "confirmed", "validated"],
  ["confirm", "verify", "validate"],
  ["confirms", "verifies", "validates"],
  ["confirmed", "verified", "validated"],
  ["validate", "confirm", "verify"],
  ["validates", "confirms", "verifies"],
  ["validated", "confirmed", "verified"],
  ["indicate", "show", "suggest"],
  ["indicates", "shows", "suggests"],
  ["indicated", "showed", "suggested"],
  ["suggest", "indicate", "recommend"],
  ["suggests", "indicates", "recommends"],
  ["suggested", "indicated", "recommended"],
  ["recommend", "suggest", "advise"],
  ["recommends", "suggests", "advises"],
  ["recommended", "suggested", "advised"],
  ["advise", "recommend", "suggest"],
  ["advises", "recommends", "suggests"],
  ["advised", "recommended", "suggested"],
  ["warn", "caution", "alert"],
  ["warns", "cautions", "alerts"],
  ["warned", "cautioned", "alerted"],
  ["alert", "warn", "caution"],
  ["alerts", "warns", "cautions"],
  ["alerted", "warned", "cautioned"],
  ["require", "need", "necessitate"],
  ["requires", "needs", "necessitates"],
  ["required", "needed", "necessitated"],
  ["involve", "entail", "comprise"],
  ["involves", "entails", "comprises"],
  ["involved", "entailed", "comprised"],
  ["comprise", "include", "contain"],
  ["comprises", "includes", "contains"],
  ["comprised", "included", "contained"],
  ["include", "comprise", "incorporate"],
  ["includes", "comprises", "incorporates"],
  ["included", "comprised", "incorporated"],
  ["contain", "include", "comprise"],
  ["contains", "includes", "comprises"],
  ["contained", "included", "comprised"],
  ["incorporate", "include", "integrate"],
  ["incorporates", "includes", "integrates"],
  ["incorporated", "included", "integrated"],
  ["integrate", "incorporate", "merge"],
  ["integrates", "incorporates", "merges"],
  ["integrated", "incorporated", "merged"],
  ["merge", "integrate", "combine"],
  ["merges", "integrates", "combines"],
  ["merged", "integrated", "combined"],
  ["combine", "merge", "integrate"],
  ["combines", "merges", "integrates"],
  ["combined", "merged", "integrated"],
  ["mix", "blend", "mingle"],
  ["mixes", "blends", "mingles"],
  ["mixed", "blended", "mingled"],
  ["blend", "mix", "merge"],
  ["blends", "mixes", "merges"],
  ["blended", "mixed", "merged"],
  ["separate", "divide", "isolate"],
  ["separates", "divides", "isolates"],
  ["separated", "divided", "isolated"],
  ["divide", "separate", "split"],
  ["divides", "separates", "splits"],
  ["divided", "separated", "split"],
  ["split", "divide", "separate"],
  ["splits", "divides", "separates"],
  ["split", "divided", "separated"],
  ["distribute", "allocate", "dispense"],
  ["distributes", "allocates", "dispenses"],
  ["distributed", "allocated", "dispensed"],
  ["allocate", "distribute", "assign"],
  ["allocates", "distributes", "assigns"],
  ["allocated", "distributed", "assigned"],
  ["assign", "allocate", "designate"],
  ["assigns", "allocates", "designates"],
  ["assigned", "allocated", "designated"],
  ["designate", "assign", "appoint"],
  ["designates", "assigns", "appoints"],
  ["designated", "assigned", "appointed"],
  ["appoint", "designate", "nominate"],
  ["appoints", "designates", "nominates"],
  ["appointed", "designated", "nominated"],
  ["nominate", "appoint", "propose"],
  ["nominates", "appoints", "proposes"],
  ["nominated", "appointed", "proposed"],
  ["select", "choose", "pick"],
  ["selects", "chooses", "picks"],
  ["selected", "chose", "picked"],
  ["choose", "select", "opt for"],
  ["chooses", "selects", "opts for"],
  ["chose", "selected", "opted for"],
  ["chosen", "selected", "picked"],
  ["pick", "select", "choose"],
  ["picks", "selects", "chooses"],
  ["picked", "selected", "chose"],
  ["prefer", "favor", "opt for"],
  ["prefers", "favors", "opts for"],
  ["preferred", "favored", "opted for"],
  ["favor", "prefer", "support"],
  ["favors", "prefers", "supports"],
  ["favored", "preferred", "supported"],
  ["support", "back", "endorse"],
  ["supports", "backs", "endorses"],
  ["supported", "backed", "endorsed"],
  ["endorse", "support", "approve"],
  ["endorses", "supports", "approves"],
  ["endorsed", "supported", "approved"],
  ["approve", "endorse", "ratify"],
  ["approves", "endorses", "ratifies"],
  ["approved", "endorsed", "ratified"],
  ["oppose", "resist", "challenge"],
  ["opposes", "resists", "challenges"],
  ["opposed", "resisted", "challenged"],
  ["support", "oppose", "advocate"],
  ["advocate", "support", "promote"],
  ["advocates", "supports", "promotes"],
  ["advocated", "supported", "promoted"],
  ["promote", "advance", "foster"],
  ["promotes", "advances", "fosters"],
  ["promoted", "advanced", "fostered"],
  ["foster", "promote", "cultivate"],
  ["fosters", "promotes", "cultivates"],
  ["fostered", "promoted", "cultivated"],
  ["cultivate", "foster", "develop"],
  ["cultivates", "fosters", "develops"],
  ["cultivated", "fostered", "developed"],
  ["nurture", "cultivate", "foster"],
  ["nurtures", "cultivates", "fosters"],
  ["nurtured", "cultivated", "fostered"],
  ["sustain", "maintain", "support"],
  ["sustains", "maintains", "supports"],
  ["sustained", "maintained", "supported"],
  ["maintain", "sustain", "preserve"],
  ["maintains", "sustains", "preserves"],
  ["maintained", "sustained", "preserved"],
  ["preserve", "maintain", "conserve"],
  ["preserves", "maintains", "conserves"],
  ["preserved", "maintained", "conserved"],
  ["conserve", "preserve", "save"],
  ["conserves", "preserves", "saves"],
  ["conserved", "preserved", "saved"],
  ["save", "conserve", "preserve"],
  ["saves", "conserves", "preserves"],
  ["saved", "conserved", "preserved"],
  ["protect", "shield", "safeguard"],
  ["protects", "shields", "safeguards"],
  ["protected", "shielded", "safeguarded"],
  ["defend", "protect", "guard"],
  ["defends", "protects", "guards"],
  ["defended", "protected", "guarded"],
  ["guard", "protect", "defend"],
  ["guards", "protects", "defends"],
  ["guarded", "protected", "defended"],
  ["secure", "protect", "fortify"],
  ["secures", "protects", "fortifies"],
  ["secured", "protected", "fortified"],
  ["fortify", "strengthen", "reinforce"],
  ["fortifies", "strengthens", "reinforces"],
  ["fortified", "strengthened", "reinforced"],
  ["strengthen", "fortify", "reinforce"],
  ["strengthens", "fortifies", "reinforces"],
  ["strengthened", "fortified", "reinforced"],
  ["reinforce", "strengthen", "bolster"],
  ["reinforces", "strengthens", "bolsters"],
  ["reinforced", "strengthened", "bolstered"],
  ["bolster", "reinforce", "support"],
  ["bolsters", "reinforces", "supports"],
  ["bolstered", "reinforced", "supported"],
  ["enhance", "improve", "boost"],
  ["enhances", "improves", "boosts"],
  ["enhanced", "improved", "boosted"],
  ["boost", "enhance", "improve"],
  ["boosts", "enhances", "improves"],
  ["boosted", "enhanced", "improved"],
  ["elevate", "raise", "lift"],
  ["elevates", "raises", "lifts"],
  ["elevated", "raised", "lifted"],
  ["raise", "elevate", "lift"],
  ["raises", "elevates", "lifts"],
  ["raised", "elevated", "lifted"],
  ["lower", "reduce", "decrease"],
  ["lowers", "reduces", "decreases"],
  ["lowered", "reduced", "decreased"],
  ["decrease", "reduce", "diminish"],
  ["decreases", "reduces", "diminishes"],
  ["diminish", "decrease", "reduce"],
  ["diminishes", "decreases", "reduces"],
  ["diminished", "decreased", "reduced"],
  // ── Additional common everyday verbs ──────────────────────────────────
  ["go", "proceed", "move forward"],
  ["goes", "proceeds", "moves forward"],
  ["went", "proceeded", "moved forward"],
  ["going", "proceeding", "moving forward"],
  ["come", "arrive", "reach"],
  ["comes", "arrives", "reaches"],
  ["came", "arrived", "reached"],
  ["coming", "arriving", "reaching"],
  ["move", "shift", "relocate"],
  ["moves", "shifts", "relocates"],
  ["moved", "shifted", "relocated"],
  ["run", "operate", "function"],
  ["runs", "operates", "functions"],
  ["ran", "operated", "functioned"],
  ["running", "operating", "functioning"],
  ["walk", "stroll", "proceed on foot"],
  ["walks", "strolls", "proceeds on foot"],
  ["walked", "strolled", "proceeded on foot"],
  ["jump", "leap", "spring"],
  ["jumps", "leaps", "springs"],
  ["jumped", "leaped", "sprang"],
  ["jumping", "leaping", "springing"],
  ["take", "seize", "grab"],
  ["takes", "seizes", "grabs"],
  ["took", "seized", "grabbed"],
  ["taking", "seizing", "grabbing"],
  ["bring", "fetch", "convey"],
  ["brings", "fetches", "conveys"],
  ["brought", "fetched", "conveyed"],
  ["eat", "consume", "ingest"],
  ["eats", "consumes", "ingests"],
  ["ate", "consumed", "ingested"],
  ["drink", "consume", "imbibe"],
  ["drinks", "consumes", "imbibes"],
  ["drank", "consumed", "imbibed"],
  ["sleep", "rest", "slumber"],
  ["sleeps", "rests", "slumbers"],
  ["slept", "rested", "slumbered"],
  ["speak", "talk", "communicate"],
  ["speaks", "talks", "communicates"],
  ["spoke", "talked", "communicated"],
  ["read", "peruse", "study"],
  ["reads", "peruses", "studies"],
  ["reading", "perusing", "studying"],
  ["write", "compose", "draft"],
  ["writes", "composes", "drafts"],
  ["wrote", "composed", "drafted"],
  ["written", "composed", "drafted"],
  ["feel", "experience", "sense"],
  ["feels", "experiences", "senses"],
  ["felt", "experienced", "sensed"],
  ["touch", "contact", "tap"],
  ["touches", "contacts", "taps"],
  ["touched", "contacted", "tapped"],
  ["smell", "detect", "sniff"],
  ["smells", "detects", "sniffs"],
  ["smelled", "detected", "sniffed"],
  ["taste", "perceive", "sample"],
  ["tastes", "perceives", "samples"],
  ["tasted", "perceived", "sampled"],
  ["hear", "detect", "perceive"],
  ["hears", "detects", "perceives"],
  ["heard", "detected", "perceived"],
  ["listen", "heed", "pay attention"],
  ["listens", "heeds", "pays attention"],
  ["listened", "heeded", "paid attention"],
  ["watch", "observe", "monitor"],
  ["watches", "observes", "monitors"],
  ["watched", "observed", "monitored"],
  ["look", "gaze", "examine"],
  ["looks", "gazes", "examines"],
  ["looked", "gazed", "examined"],
  ["meet", "encounter", "greet"],
  ["meets", "encounters", "greets"],
  ["met", "encountered", "greeted"],
  ["send", "transmit", "dispatch"],
  ["sends", "transmits", "dispatches"],
  ["sent", "transmitted", "dispatched"],
  ["receive", "collect", "accept"],
  ["receives", "collects", "accepts"],
  ["received", "collected", "accepted"],
  ["buy", "purchase", "acquire"],
  ["buys", "purchases", "acquires"],
  ["bought", "purchased", "acquired"],
  ["sell", "trade", "market"],
  ["sells", "trades", "markets"],
  ["sold", "traded", "marketed"],
  ["pay", "compensate", "remunerate"],
  ["pays", "compensates", "remunerates"],
  ["paid", "compensated", "remunerated"],
  ["cost", "price", "expense"],
  ["costs", "prices", "expenses"],
  ["costed", "priced", "expensed"],
  ["spend", "expend", "disburse"],
  ["spends", "expends", "disburses"],
  ["spent", "expended", "disbursed"],
  ["win", "prevail", "triumph"],
  ["wins", "prevails", "triumphs"],
  ["won", "prevailed", "triumphed"],
  ["lose", "forfeit", "surrender"],
  ["loses", "forfeits", "surrenders"],
  ["lost", "forfeited", "surrendered"],
  ["play", "participate", "perform"],
  ["plays", "participates", "performs"],
  ["played", "participated", "performed"],
  ["sing", "chant", "vocalize"],
  ["sings", "chants", "vocalizes"],
  ["sang", "chanted", "vocalized"],
  ["dance", "twirl", "sway"],
  ["dances", "twirls", "sways"],
  ["danced", "twirled", "swayed"],
  ["draw", "sketch", "illustrate"],
  ["draws", "sketches", "illustrates"],
  ["drew", "sketched", "illustrated"],
  ["drawn", "sketched", "illustrated"],
  ["paint", "depict", "render"],
  ["paints", "depicts", "renders"],
  ["painted", "depicted", "rendered"],
  ["cook", "prepare", "make"],
  ["cooks", "prepares", "makes"],
  ["cooked", "prepared", "made"],
  ["clean", "tidy", "sanitize"],
  ["cleans", "tidies", "sanitizes"],
  ["cleaned", "tidied", "sanitized"],
  ["fix", "repair", "mend"],
  ["fixes", "repairs", "mends"],
  ["fixed", "repaired", "mended"],
  ["break", "shatter", "crack"],
  ["breaks", "shatters", "cracks"],
  ["broke", "shattered", "cracked"],
  ["broken", "shattered", "cracked"],
  ["fall", "drop", "descend"],
  ["falls", "drops", "descends"],
  ["fell", "dropped", "descended"],
  ["fallen", "dropped", "descended"],
  ["rise", "increase", "ascend"],
  ["rises", "increases", "ascends"],
  ["rose", "increased", "ascended"],
  ["risen", "increased", "ascended"],
  ["fly", "soar", "glide"],
  ["flies", "soars", "glides"],
  ["flew", "soared", "glided"],
  ["swim", "float", "paddle"],
  ["swims", "floats", "paddles"],
  ["swam", "floated", "paddled"],
  ["sit", "settle", "rest"],
  ["sits", "settles", "rests"],
  ["sat", "settled", "rested"],
  ["stand", "rise"],
  ["stands", "rises"],
  ["stood", "rose"],
  ["lie", "rest", "recline"],
  ["lies", "rests", "reclines"],
  ["lay", "rested", "reclined"],
  ["open", "unlock", "unwrap"],
  ["opens", "unlocks", "unwraps"],
  ["opened", "unlocked", "unwrapped"],
  ["close", "shut", "seal"],
  ["closes", "shuts", "seals"],
  ["closed", "shut", "sealed"],
  ["turn", "rotate", "spin"],
  ["turns", "rotates", "spins"],
  ["turned", "rotated", "spun"],
  ["grow", "develop", "mature"],
  ["grows", "develops", "matures"],
  ["grew", "developed", "matured"],
  ["grown", "developed", "matured"],
  ["die", "perish", "expire"],
  ["dies", "perishes", "expires"],
  ["died", "perished", "expired"],
  ["live", "reside", "exist"],
  ["lives", "resides", "exists"],
  ["lived", "resided", "existed"],
  // ── Additional common everyday adjectives ─────────────────────────────
  ["quick", "swift", "speedy"],
  ["quicker", "swifter", "speedier"],
  ["quickest", "swiftest", "speediest"],
  ["fast", "rapid", "brisk"],
  ["faster", "more rapid", "brisker"],
  ["fastest", "most rapid", "briskest"],
  ["slow", "sluggish", "leisurely"],
  ["slower", "more sluggish", "more leisurely"],
  ["slowest", "most sluggish", "most leisurely"],
  ["lazy", "idle", "slothful"],
  ["lazier", "more idle", "more slothful"],
  ["laziest", "most idle", "most slothful"],
  ["busy", "occupied", "engaged"],
  ["busier", "more occupied", "more engaged"],
  ["busiest", "most occupied", "most engaged"],
  ["happy", "joyful", "cheerful"],
  ["happier", "more joyful", "more cheerful"],
  ["happiest", "most joyful", "most cheerful"],
  ["sad", "sorrowful", "gloomy"],
  ["sadder", "more sorrowful", "more gloomy"],
  ["saddest", "most sorrowful", "most gloomy"],
  ["angry", "irritated", "furious"],
  ["angrier", "more irritated", "more furious"],
  ["angriest", "most irritated", "most furious"],
  ["tired", "fatigued", "weary"],
  ["more tired", "more fatigued", "weaker"],
  ["most tired", "most fatigued", "weariest"],
  ["hungry", "starving", "ravenous"],
  ["thirsty", "parched", "dehydrated"],
  ["hot", "warm", "scorching"],
  ["cold", "chilly", "freezing"],
  ["cool", "chilly", "refreshing"],
  ["warm", "toasty", "heated"],
  ["new", "fresh", "recent"],
  ["older", "more aged", "more senior"],
  ["oldest", "most aged", "most senior"],
  ["young", "youthful", "juvenile"],
  ["younger", "more youthful", "more juvenile"],
  ["youngest", "most youthful", "most juvenile"],
  ["rich", "wealthy", "affluent"],
  ["poor", "impoverished", "needy"],
  ["smart", "intelligent", "brilliant"],
  ["stupid", "foolish", "dense"],
  ["clever", "shrewd", "ingenious"],
  ["dumb", "unintelligent", "dim"],
  ["kind", "compassionate", "generous"],
  ["mean", "cruel", "unkind"],
  ["nice", "pleasant", "agreeable"],
  ["nasty", "unpleasant", "vile"],
  ["beautiful", "gorgeous", "stunning"],
  ["ugly", "hideous", "unsightly"],
  ["pretty", "lovely", "attractive"],
  ["handsome", "good-looking", "appealing"],
  ["short", "compact", "brief"],
  ["tall", "lofty", "elevated"],
  ["fat", "heavy", "overweight"],
  ["thin", "slender", "slim"],
  ["wide", "broad", "spacious"],
  ["narrow", "slim", "confined"],
  ["long", "lengthy", "protracted"],
  ["dirty", "filthy", "soiled"],
  ["wet", "moist", "damp"],
  ["dry", "arid", "parched"],
  ["dark", "dim", "shadowy"],
  ["bright", "luminous", "radiant"],
  ["heavy", "weighty", "bulky"],
  ["light", "airy", "weightless"],
  ["hard", "firm", "solid"],
  ["soft", "gentle", "mild"],
  ["rough", "coarse", "uneven"],
  ["smooth", "sleek", "polished"],
  ["sharp", "keen", "acute"],
  ["dull", "blunt", "flat"],
  ["strong", "sturdy", "muscular"],
  ["weak", "fragile", "feeble"],
  ["loud", "noisy", "boisterous"],
  ["quiet", "silent", "calm"],
  ["noisy", "clamorous", "raucous"],
  ["silent", "quiet", "still"],
  ["wild", "untamed", "feral"],
  ["calm", "peaceful", "serene"],
  ["crazy", "insane", "erratic"],
  ["sane", "rational", "sensible"],
  ["sick", "ill", "unwell"],
  ["healthy", "well", "fit"],
  ["alive", "living", "breathing"],
  ["dead", "deceased", "lifeless"],
  // NOTE: Basic color words are intentionally NOT synonym-swapped at the
  // token level — precise color semantics matter (crimson ≠ red). Prefer
  // clause-level transformations for rewriting distance instead.
  ["fox", "vixen", "coyote"],
  ["dog", "canine", "hound"],
  ["cat", "feline", "kitten"],
  ["bird", "avian", "fowl"],
  ["fish", "aquatic creature", "seafood"],
  ["horse", "equine", "steed"],
  ["cow", "bovine", "cattle"],
  ["pig", "swine", "hog"],
  ["sheep", "ovine", "lamb"],
  ["chicken", "poultry", "hen"],
  ["tree", "shrub", "sapling"],
  ["flower", "blossom", "bloom"],
  ["grass", "turf", "herbage"],
  ["water", "liquid", "fluid"],
  ["fire", "flame", "blaze"],
  ["earth", "soil", "ground"],
  ["air", "wind", "breeze"],
  ["sun", "star", "solar body"],
  ["moon", "lunar body", "satellite"],
  ["sky", "heavens", "expanse"],
  ["mountain", "peak", "summit"],
  ["river", "stream", "waterway"],
  ["ocean", "sea", "marine waters"],
  ["lake", "pond", "inland sea"],
  ["forest", "woods", "woodland"],
  ["city", "town", "metropolis"],
  ["house", "dwelling", "residence"],
  ["car", "automobile", "vehicle"],
  ["road", "path", "highway"],
  ["book", "volume", "publication"],
  ["food", "nourishment", "sustenance"],
  ["money", "currency", "funds"],
  ["place", "location", "spot"],
  ["way", "path", "route"],
  ["day", "twenty-four hours", "date"],
  ["week", "seven days", "workweek"],
  ["month", "four weeks", "calendar period"],
  // ── More adverbs ─────────────────────────────────────────────────────
  ["quickly", "swiftly", "promptly"],
  ["slowly", "gradually", "sluggishly"],
  ["happily", "joyfully", "cheerfully"],
  ["sadly", "sorrowfully", "gloomily"],
  ["angrily", "fiercely", "furiously"],
  ["busily", "actively", "diligently"],
  ["easily", "effortlessly", "smoothly"],
  ["carefully", "cautiously", "prudently"],
  ["dangerously", "riskily", "hazardously"],
  ["finally", "ultimately", "eventually"],
  ["suddenly", "abruptly", "unexpectedly"],
  ["immediately", "instantly", "promptly"],
  ["recently", "lately", "newly"],
  ["normally", "typically", "usually"],
  ["actually", "really", "truly"],
  ["certainly", "definitely", "surely"],
  ["naturally", "inherently", "instinctively"],
  ["effectively", "efficiently", "productively"],
  ["basically", "fundamentally", "essentially"],
  ["literally", "exactly", "precisely"],
  ["absolutely", "completely", "totally"],
  ["completely", "fully", "thoroughly"],
  ["totally", "entirely", "wholly"],
  ["fully", "completely", "entirely"],
  ["mostly", "mainly", "primarily"],
  ["nearly", "almost", "practically"],
  ["exactly", "precisely", "accurately"],
  ["likely", "probably", "presumably"],
  ["surely", "certainly", "undoubtedly"],
  ["truly", "genuinely", "sincerely"],
  ["really", "actually", "genuinely"],
  ["again", "once more", "another time"],
  ["already", "previously", "by now"],
  // NOTE: "just/also" are clause-level function words — preserved in token swap.
  // Clause reordering (restructureSentences) handles appropriate replacements.
  ["always", "consistently", "perpetually"],
  ["never", "at no time", "not ever"],
  ["often", "frequently", "regularly"],
  ["sometimes", "occasionally", "from time to time"],
  ["usually", "commonly", "normally"],
  ["today", "this day", "at present"],
  ["tomorrow", "next day", "coming day"],
  ["yesterday", "previous day", "day before"],
  ["here", "at this point", "in this place"],
  ["there", "at that point", "in that place"],
  ["why", "for what reason", "on what grounds"],
  ["how", "in what manner", "by what method"],
  // NOTE: function / subordinator words like when/where/while/even/if are NOT in
  // the synonym list because swapping them (e.g. "even"→"including",
  // "when"→"at which time") destroys grammatical structure of surrounding
  // clauses. They are handled exclusively by the clause-level restructure pass.
];

/* ───────────────────────────────────────────────────────────────
 *  PHRASE SWAPS — multi-word pattern-level transformations
 * ─────────────────────────────────────────────────────────────── */
const PHRASE_SWAPS: Array<[RegExp, string]> = [
  [/\bdue to the fact that\b/gi, "because"],
  [/\bin order to\b/gi, "to"],
  [/\bat this point in time\b/gi, "currently"],
  [/\ba large number of\b/gi, "numerous"],
  [/\ba lot of\b/gi, "many"],
  [/\bfor example\b/gi, "for instance"],
  [/\bin spite of\b/gi, "despite"],
  [/\bin the event that\b/gi, "if"],
  [/\bon a daily basis\b/gi, "daily"],
  [/\bon a regular basis\b/gi, "regularly"],
  [/\bin the near future\b/gi, "soon"],
  [/\bit is important to note that\b/gi, "notably,"],
  [/\bthere is no doubt that\b/gi, "undoubtedly,"],
  [/\bwhen it comes to\b/gi, "regarding"],
  [/\bthe majority of\b/gi, "most"],
  [/\ba variety of\b/gi, "various"],
  [/\bin terms of\b/gi, "regarding"],
  [/\bas a matter of fact\b/gi, "in fact"],
  [/\bin conclusion\b/gi, "ultimately"],
  [/\bfirst of all\b/gi, "firstly"],
  [/\blast but not least\b/gi, "finally"],
  [/\bneedless to say\b/gi, "obviously"],
  [/\beach and every\b/gi, "all"],
  [/\bin the process of\b/gi, "while"],
  [/\bat the present time\b/gi, "presently"],
  [/\bfor the purpose of\b/gi, "to"],
  [/\bwith regard to\b/gi, "concerning"],
  [/\bit is worth noting that\b/gi, "notably,"],
];

/* ───────────────────────────────────────────────────────────────
 *  REWRITER ENGINE — aggressive token-by-token with
 *  per-occurrence hashing + clause-level restructuring
 * ─────────────────────────────────────────────────────────────── */

/** Simple string hash — 32-bit FNV-1a, uniform for any input length. */
function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Suffix stripping table for root-based synonym lookup.
 *  If the original word carries one of these suffixes, the root synonym we
 *  return will be re-inflected with the matching suffix from SUFFIX_MAP.
 */
const SUFFIX_STRIPS: Array<[RegExp, string]> = [
  [/ly$/, "ly"],
  [/ness$/, "ness"],
  [/ment$/, "ment"],
  [/tion$/, "tion"],
  [/sion$/, "sion"],
  [/able$/, "able"],
  [/ible$/, "ible"],
  [/ful$/, "ful"],
  [/less$/, "less"],
  [/ous$/, "ous"],
  [/ive$/, "ive"],
  [/al$/, "al"],
  [/ic$/, "ic"],
  [/ity$/, "ity"],
  [/er$/, "er"],
  [/est$/, "est"],
  [/ing$/, "ing"],
  [/ed$/, "ed"],
  [/ies$/, "y"],
  [/es$/, "es"],
  [/s$/, "s"],
];

/** Re-inflection table: given a suffix on the original word, how to attach
 *  it to the root synonym. Multi-word synonyms skip re-inflection entirely.
 */
function applySuffix(rootSyn: string, suffix: string): string {
  if (!suffix || rootSyn.includes(" ")) return rootSyn;
  const r = rootSyn;
  switch (suffix) {
    case "ly":
      return /y$/.test(r) ? r.slice(0, -1) + "ily" : r + "ly";
    case "ness":
      return /y$/.test(r) ? r.slice(0, -1) + "iness" : r + "ness";
    case "er":
      return /e$/.test(r) ? r + "r" : /y$/.test(r) ? r.slice(0, -1) + "ier" : r + "er";
    case "est":
      return /e$/.test(r) ? r + "st" : /y$/.test(r) ? r.slice(0, -1) + "iest" : r + "est";
    case "ing":
      return /e$/.test(r) && !/ee$/.test(r) ? r.slice(0, -1) + "ing" : r + "ing";
    case "ed":
      return /e$/.test(r) ? r + "d" : /y$/.test(r) ? r.slice(0, -1) + "ied" : r + "ed";
    case "s":
      return /[sxz]$/.test(r) || /[cs]h$/.test(r) ? r + "es" : r + "s";
    case "es":
      return r + "es";
    case "y":
      return r + "y";
    case "tion":
      return /e$/.test(r) ? r.slice(0, -1) + "ation" : r + "ation";
    case "sion":
      return r + "sion";
    case "ment":
      return r + "ment";
    case "able":
      return /e$/.test(r) ? r.slice(0, -1) + "able" : r + "able";
    case "ible":
      return r + "ible";
    case "ful":
      return r + "ful";
    case "less":
      return r + "less";
    case "ous":
      return r + "ous";
    case "ive":
      return r + "ive";
    case "al":
      return r + "al";
    case "ic":
      return r + "ic";
    case "ity":
      return /e$/.test(r) ? r.slice(0, -1) + "ity" : r + "ity";
    default:
      return r + suffix;
  }
}

/** Look up a word in SYNONYMS with suffix-stripping fallback.
 *  Returns the (possibly re-inflected) alternatives, or null.
 */
function findSynonym(word: string): [string, string?] | null {
  const lower = word.toLowerCase();

  // 1) Exact match first.
  for (const [src, ...alts] of SYNONYMS) {
    if (src === lower) return [alts[0], alts[1]];
  }

  // 2) Suffix-stripped lookup: try each suffix rule.
  for (const [re, suffix] of SUFFIX_STRIPS) {
    if (re.test(lower)) {
      const stripped = lower.replace(re, "");
      if (stripped.length < 3) continue;
      for (const [src, ...alts] of SYNONYMS) {
        if (src === stripped && alts[0]) {
          return [applySuffix(alts[0], suffix), alts[1] ? applySuffix(alts[1], suffix) : undefined];
        }
      }
    }
  }

  return null;
}

/** Preserve the original casing on a replacement word. */
function matchCase(original: string, replacement: string): string {
  if (!original) return replacement;
  if (original[0] === original[0].toUpperCase() && original[0] !== original[0].toLowerCase()) {
    return replacement[0].toUpperCase() + replacement.slice(1);
  }
  if (original === original.toUpperCase() && original.length > 1) {
    return replacement.toUpperCase();
  }
  return replacement;
}

/** Words that should NEVER be synonym-swapped at the token level — they glue
 *  sentences together and changing them breaks grammar.
 *  Covers subordinators, coordinators, complementizers, bare infinitives,
 *  prepositions that double as complementizers, and auxiliary fragments.
 */
const SWAP_BLACKLIST = new Set([
  // Subordinators / clause introducers
  "because", "when", "while", "whereas", "though", "although", "if", "unless",
  "until", "since", "as", "whether", "provided", "supposing",
  // Coordinators
  "and", "but", "or", "nor", "for", "yet", "so",
  // Function-adverbials that introduce clauses
  "even", "only", "still", "just", "also", "then", "once",
  // Prepositions (high-syntactic)
  "of", "in", "on", "at", "to", "from", "by", "with", "without", "through",
  "during", "before", "after", "above", "below", "between", "among",
  "about", "around", "against", "toward", "towards", "into", "onto", "upon",
  "via", "per",
  // Articles / determiners that don't swap badly
  "a", "an", "the", "this", "that", "these", "those", "such", "same", "own",
  // Wh-words functioning as complementizers
  "who", "whom", "whose", "which", "where", "why", "how",
  // Modals / auxiliaries
  "can", "could", "should", "would", "may", "might", "must", "shall", "will",
  "do", "does", "did", "have", "has", "had", "be", "is", "are", "was",
  "were", "been", "being",
  // Pronouns (swapping pronouns changes meaning)
  "i", "you", "he", "she", "it", "we", "they", "me", "him", "her", "us",
  "them", "my", "your", "his", "its", "our", "their", "mine", "yours",
  "hers", "ours", "theirs", "myself", "yourself", "himself", "herself",
  "itself", "ourselves", "yourselves", "themselves",
  "this", "that", "these", "those", // demonstrative), there,
  "each", "every", "all", "both", "either", "neither",
  "some", "any", "no", "none", "nothing", "something", "anything",
  // Conjuncts/quantifiers whose synonyms make no sense
  "not", "no", "yes", "very", "too",
  // "it's"/contracted auxiliaries
]);

/** Main aggressive synonym engine.
 *  Tokenizes into word/non-word segments, then for each word token
 *  independently decides whether to swap and which alternative to use.
 *
 *  Intensity controls swap rate:
 *    Light   → 65% of eligible words swapped
 *    Balanced → 94% of eligible words swapped (most, but leaves some for naturalness)
 *    Deep    → 100% of eligible words swapped + aggressive alternatives
 *
 *  Variety comes from: (a) FNV-1a per-occurrence hash for the swap decision,
 *  and (b) selection among 2-3 alternatives for each word, plus
 *  (c) suffix-aware re-inflection.
 */
function applyTokenSynonyms(text: string, intensity: "light" | "balanced" | "deep"): string {
  const swapRate = intensity === "light" ? 65 : intensity === "balanced" ? 94 : 100;

  const segments = text.split(/(\s+|[.!?,;:])/);
  let wordIdx = 0;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (!seg || !/^\w/.test(seg)) continue;
    // Skip blacklisted function words — preserve glue words.
    if (SWAP_BLACKLIST.has(seg.toLowerCase())) { wordIdx++; continue; }
    const syn = findSynonym(seg);
    if (!syn) { wordIdx++; continue; }

    // Per-occurrence FNV-1a hash: mixes word chars + index + surrounding context
    // for uniform 0-99 distribution regardless of word length.
    const prev = segments[i - 2] ?? "";
    const hSeed = prev + "|" + seg + "|idx:" + wordIdx;
    const h = fnv1a(hSeed) % 100;

    if (h < swapRate) {
      // Pick which alternative to use based on hash — ensures variety
      const altCount = 1 + (syn[1] ? 1 : 0);
      const pickIdx = (fnv1a(hSeed + ":alt") >>> 0) % (altCount + 1);
      const chosen = pickIdx === 0 ? syn[0] : (syn[1] ?? syn[0]);
      segments[i] = matchCase(seg, chosen);
    }
    wordIdx++;
  }
  return segments.join("");
}

/** Framing / introductory phrases inserted at sentence starts.
 *  These add "rewriting distance" without changing the core meaning.
 */
// Introductory phrases used sparingly (≤10% of sentences) to add rewriting
// distance without creating AI-babble. Phrases that produce sentence fragments
// when appended to arbitrary clauses are intentionally excluded.
const INTRO_PHRASES = [
  "In essence, ",
  "At its core, ",
  "Notably, ",
  "Importantly, ",
  "In other words, ",
  "More specifically, ",
  "Broadly speaking, ",
  "On balance, ",
];

const DEEP_INTRO_PHRASES = [
  "From a broader perspective, ",
  "Taking a closer look, ",
  "Considered as a whole, ",
  "In the larger context, ",
];

/** Sentence restructuring — conservative clause-level transformations.
 *  Goal: change wording/sentence shape WITHOUT producing grammar errors.
 *  All high-risk transforms (X-is-Y flip, modal expansions, clause swaps,
 *  sentence rotation, gerund-framing of people/many/some) are removed.
 */
function restructureSentences(text: string, intensity: "light" | "balanced" | "deep"): string {
  if (intensity === "light") return text;

  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  const out: string[] = [];
  let lastHadIntro = false;

  for (let idx = 0; idx < sentences.length; idx++) {
    let s = sentences[idx];

    // ── 1. Reason-clause fronting (preserves causal direction) ─────────
    // "X because Y." → "Since Y, X."
    s = s.replace(
      /^(.+?)\s+because\s+([A-Za-z][^,.!?;]{3,100})([.!?])$/i,
      (_m: string, x: string, y: string, p: string) => {
        // Skip if Y already contains connectors (nested structure)
        if (/\b(?:because|since|when|while|whereas|though|although|if|unless|and|but|so|for)\b/i.test(y)) return _m;
        const yTrim = y.trim();
        const xTrim = x.trim();
        const h = fnv1a(idx + ":xybc:" + xTrim.slice(0, 8)) % 100;
        const connector = h < 33 ? "Since" : h < 66 ? "Given that" : h < 85 ? "Considering that" : "As";
        // Reason clause is mid-sentence → lowercase first word
        const yLower = yTrim.charAt(0).toLowerCase() + yTrim.slice(1);
        const xLower = xTrim.charAt(0).toLowerCase() + xTrim.slice(1);
        return `${connector} ${yLower}, ${xLower}${p}`;
      }
    );
    // Mid-sentence "because" → "since/given that/as" (preserves order)
    s = s.replace(
      /\bbecause\s+(\w[^,.!?;]{3,80})(?=[,.;!?]|$)/gi,
      (_m: string, y: string) => {
        const h = fnv1a(idx + ":bc2:" + y.slice(0, 6)) % 100;
        const conn = h < 40 ? "since" : h < 70 ? "given that" : "as";
        return `, ${conn} ${y.trim().toLowerCase()}`;
      }
    );

    // ── 2. Subordinator word swaps (do NOT change clause order) ────────
    // "Although X, Y" → "While X, Y" (safer than "Whereas")
    s = s.replace(/\bAlthough\s+([^,]{3,80}),\s*/gi, (_m: string, x: string) => `While ${x.trim()}, `);
    // "Though X, Y" → "Even though X, Y"
    s = s.replace(/\bthough\s+([^,]{3,80}),\s*/gi, (_m: string, x: string) => `Even though ${x.trim()}, `);
    // NOTE: "If X → Should X" (inverted conditional) and "When X → Upon X-ing"
    // transforms removed — they produced ungrammatical output ("Upon we studying")
    // and overly formal inverted conditionals. "If"/"When" are left intact.

    // ── 3. Safe connector replacements (low probability) ───────────────
    // "but" → "yet/however" (skip sentence-initial "But")
    s = s.replace(/\bbut\b/gi, (_m: string, pos: number) => {
      if (pos === 0 || /^\s*$/i.test(s.slice(0, pos))) return _m; // sentence-initial
      const h = fnv1a(idx + ":but:" + s.slice(0, 20)) % 100;
      return h < 25 ? "yet" : h < 45 ? "however" : "but";
    });

    // "so" → "thus/therefore/consequently" only when followed by clause
    s = s.replace(/\bso\s+(\w)/gi, (_m: string, next: string) => {
      const h = fnv1a(idx + ":so:" + s.slice(0, 15)) % 100;
      const conn = h < 30 ? "thus" : h < 55 ? "therefore" : h < 70 ? "consequently" : "so";
      return conn === "so" ? _m : `${conn} ${next}`;
    });

    // "and" → "as well as/together with" only between simple NPs
    s = s.replace(/\band\b/gi, (_m: string, pos: number) => {
      if (pos < 5) return _m;
      const h = fnv1a(idx + ":and:" + pos) % 100;
      return h < 12 ? "as well as" : h < 20 ? "together with" : "and";
    });

    // "also" → "furthermore/additionally/moreover" only at sentence start
    s = s.replace(/^Also\b/gi, (_m: string) => {
      const h = fnv1a(idx + ":also:" + s.slice(0, 10)) % 100;
      return h < 40 ? "Furthermore," : h < 70 ? "Additionally," : "Moreover,";
    });

    // "then" → "subsequently/afterward/thereafter" only at sentence start
    s = s.replace(/^Then\b/gi, (_m: string) => {
      const h = fnv1a(idx + ":then:" + s.slice(0, 10)) % 100;
      return h < 40 ? "Subsequently," : h < 70 ? "Afterward," : "Thereafter,";
    });

    // ── 4. Sparse intro-phrase injection (deep only, ≤10%, no consecutive) ─
    if (intensity === "deep" && !lastHadIntro) {
      const roll = fnv1a(idx + ":intro:" + s.slice(0, 20)) % 100;
      if (roll < 10) {
        const useDeep = roll < 3;
        const pool = useDeep ? DEEP_INTRO_PHRASES : INTRO_PHRASES;
        const pick = pool[fnv1a(idx + ":which:" + s) % pool.length];
        const firstLower = s.charAt(0).toLowerCase() + s.slice(1);
        s = pick + firstLower;
        lastHadIntro = true;
      } else {
        lastHadIntro = false;
      }
    } else {
      lastHadIntro = false;
    }

    out.push(s);
  }

  return out.join(" ");
}

/** Per-sentence repair: capitalization, dangling-subordinator cleanup,
 *  fragment dropping, comma housekeeping. */
const DANGLING_SUFFIXES = /\s*(?:,?\s+)?\b(?:while|because|since|when|whereas|though|although|unless|until|including|if|and|but|or|so|as|upon|after|before|during|via|through|of|for|with|that|this|which|who|whom|whose|at|on|in|to|from|by)\s*[.!?]\s*$/i;
const CONTENT_VERBS = /\b(?:is|are|was|were|be|been|being|have|has|had|do|does|did|can|could|should|would|may|might|must|will|shall|make|makes|made|create|creates|go|goes|went|come|comes|came|take|takes|took|give|gives|gave|see|sees|saw|know|knows|knew|think|thinks|thought|find|finds|found|say|says|said|tell|tells|told|ask|asks|asked|help|helps|helped|use|uses|used|get|gets|got|need|needs|needed|want|wants|wanted|start|starts|started|stop|stops|stopped|show|shows|showed|run|runs|ran|jump|jumps|jumped|write|writes|wrote|read|reads|reading|speak|speaks|spoke|feel|feels|felt|try|tries|tried|work|works|worked|call|calls|called|keep|keeps|kept|let|lets|leave|leaves|left|move|moves|moved|play|plays|played|put|puts|continue|continues|continued|set|sets|learn|learns|learned|improve|improves|improved|increase|increases|increased|decrease|decreases|decreased|develop|develops|developed|form|forms|formed|exist|exists|existed|represent|represents|represented|characterize|characterizes|characterized|constitute|constitutes|constituted|subscribe|subscribes|subscribed|seek|seeks|sought|enhance|enhances|enhanced|provide|provides|provided|allow|allows|allowed|involve|involves|involved|focus|focuses|focused|utilize|utilizes|utilized|operate|operates|operated|establish|establishes|established|require|requires|required|suggest|suggests|suggested|examine|examines|examined|discuss|discusses|discussed|achieve|achieves|achieved|support|supports|supported|consider|considers|considered)\b/i;

/** Fix common subject-verb agreement errors introduced by synonym swaps
 *  and clause transforms (e.g. "we is able", "rarely have nature ceased").
 */
function fixSubjectVerbAgreement(text: string): string {
  let s = text;

  // ── Pronoun + "is/are/was/were" ──
  s = s.replace(/\b(we|you|they)\s+is\b/gi, "$1 are");
  s = s.replace(/\b(we|you|they)\s+was\b/gi, "$1 were");
  s = s.replace(/\b(he|she|it)\s+are\b/gi, "$1 is");
  s = s.replace(/\b(he|she|it)\s+were\b/gi, "$1 was");
  s = s.replace(/\bI\s+is\b/gi, "I am");
  s = s.replace(/\bI\s+are\b/gi, "I am");
  s = s.replace(/\bI\s+were\b/gi, "I was");

  // ── Pronoun + "has/have" ──
  s = s.replace(/\b(we|you|they)\s+has\b/gi, "$1 have");
  s = s.replace(/\bI\s+has\b/gi, "I have");
  s = s.replace(/\b(he|she|it)\s+have\b/gi, "$1 has");

  // ── Pronoun + "don't/doesn't" ──
  s = s.replace(/\b(he|she|it)\s+don't\b/gi, "$1 doesn't");
  s = s.replace(/\b(I|we|you|they)\s+doesn't\b/gi, "$1 don't");

  // ── Adverb-inversion: "rarely have nature ceased" → "rarely has nature ceased" ──
  const sn = "nature|life|time|water|air|earth|world|society|culture|technology|knowledge|wisdom|experience|evidence|information|research|energy|money|space|change|growth|development|movement|process|system|structure|environment|government|economy|industry|education|health|science|history|language|literature|philosophy|psychology|biology|physics|chemistry|mathematics|geography|economics|politics|music|art";
  s = s.replace(
    new RegExp("\\b(have)\\s+(" + sn + ")\\s+(\\w+ed|\\w+en|ceased|started|stopped|changed|developed|increased|decreased|improved|declined|grown|fallen|risen|begun|become|been|gone|come|taken|seen|known|shown|found|made|done|said|put|set|left|kept|built|held|brought|bought|caught|taught|thought|sought|fought|wrought|begun|run|spun|stung|hung|sung|drunk|shrunk|sunk)\\b", "gi"),
    "has $2 $3"
  );
  s = s.replace(
    new RegExp("\\b(have)\\s+(" + sn + ")\\s+(\\w+s)\\b", "gi"),
    (_m, _have, noun, verb) => {
      if (/^(is|has|was|does|goes|comes|takes|makes|says|gets|sees|knows|thinks|finds|helps|uses|needs|wants|starts|stops|shows|runs|jumps|writes|reads|speaks|feels|tries|works|calls|keeps|lets|leaves|moves|plays|puts|continues|sets|learns|improves|increases|decreases|develops|forms|exists|represents|characterizes|constitutes|subscribes|seeks|enhances|provides|allows|involves|focuses|operates|establishes|requires|suggests|examines|discusses|achieves|supports|considers)$/i.test(verb)) {
        return `has ${noun} ${verb}`;
      }
      return _m;
    }
  );

  return s;
}

/** Final post-repair polish: catch agreement errors that only appear after
 *  sentence repair/merging, and clean up article / spacing artifacts.
 */
function finalGrammarPolish(text: string): string {
  let s = text;

  // Re-run core agreement fixes after repairSentences may have merged fragments
  s = fixSubjectVerbAgreement(s);

  // Doubled articles / small words (can be introduced by merges)
  const doublers = ["the", "a", "an", "is", "are", "was", "were", "of", "and", "to", "in", "it", "its", "on", "for", "with", "that", "this", "these", "those"];
  for (const w of doublers) {
    const re = new RegExp("\\b" + w + "\\s+" + w + "\\b", "gi");
    s = s.replace(re, w);
  }
  for (const w of doublers) {
    const cap = w.charAt(0).toUpperCase() + w.slice(1);
    const re = new RegExp("\\b" + cap + "\\s+" + w + "\\b", "g");
    s = s.replace(re, cap);
  }

  // "a" before vowel sound → "an"; "an" before consonant sound → "a"
  s = s.replace(/\b([aA])\s+([aeiouAEIOU]|honest|honesty|honestly|hour|hours|heir|heirs|honor|honors|honour|honours|honorary|herb|herbs)\b/g, (_m, a, next) => {
    const needsAn = /^[aeiouAEIOU]/.test(next) || /^(hon|hour|heir|herb)/i.test(next);
    return (a === "A" ? (needsAn ? "An " : "A ") : (needsAn ? "an " : "a ")) + next;
  });
  s = s.replace(/\b([aA])n\s+([bcdfghjklmnpqrstvwxyzBCDFGHJKLMNPQRSTVWXYZ]|uni|use|used|useful|user|usual|university|unicorn|European|one|once|ubiquitous|utensil|utility|eulogy|euphemism|euphoria|european)\b/g, (_m, a, next) => {
    const consonantSound = /^[bcdfghjklmnpqrstvwxyzBCDFGHJKLMNPQRSTVWXYZ]/.test(next) && !/^(hon|hour|heir|herb)/i.test(next);
    const uConsonant = /^(uni|use|used|useful|user|usual|university|unicorn|ubiquitous|utensil|utility)/i.test(next);
    const euConsonant = /^(European|eulogy|euphemism|euphoria|european)/i.test(next);
    const oConsonant = /^(one|once)/i.test(next);
    const needsA = consonantSound || uConsonant || euConsonant || oConsonant;
    return (a === "A" ? (needsA ? "A " : "An ") : (needsA ? "a " : "an ")) + next;
  });

  // Tighten spacing around punctuation
  s = s.replace(/\s+([.!?,;:])/g, "$1").replace(/([.!?,;:])(?=[A-Z])/g, "$1 ");
  s = s.replace(/\s{2,}/g, " ").trim();

  return s;
}

function repairSentences(text: string): string {
  const sents = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  const repaired: string[] = [];

  for (const orig of sents) {
    let s = orig.trim();
    if (!s) continue;

    // 1) Ensure final punctuation exists
    if (!/[.!?]$/.test(s)) s = s + ".";

    // 2) Remove orphan leading punctuation / connectors
    s = s.replace(/^[,;:]\s+/, "");
    s = s.replace(/^\s*(?:however|though|although|whereas|while|since|because|if|unless|until|including|also|additionally|furthermore|moreover|therefore|thus|hence|consequently|nevertheless|nonetheless|yet)\s*,?\s+/i,
      (m) => m.charAt(0).toUpperCase() + m.slice(1)
    );

    // 3) Trim dangling subordinators / connectors at end BEFORE punctuation
    const before = s;
    s = s.replace(DANGLING_SUFFIXES, (m0) => {
      // Just keep the period/question/exclamation
      const punct = m0.slice(-1);
      return punct;
    });
    // If it still ends with weird connector + punctuation, strip the connector
    s = s.replace(/\s+(?:while|because|since|when|whereas|though|although|unless|until|including|if|and|but|or|so|as|upon|after|before|during|via|through|of|for|with|that|this|which|who|whom|whose|at|on|in|to|from|by)\s*([.!?])$/i, "$1");
    if (s === "." || s === "?" || s === "!") s = before; // revert if damage

    // 4) Fix "a an " or "an a " ordering
    s = s.replace(/\ba an\b/gi, "an").replace(/\ban a\b/gi, "a");

    // 5) Capitalize first letter
    s = s.charAt(0).toUpperCase() + s.slice(1);

    // 6) Fragment guard: skip very short (<3 chars) or no-content sentences.
    const words = s.replace(/[^a-zA-Z0-9\u00C0-\u024F\s]/g, "").split(/\s+/).filter(Boolean);
    if (words.length < 3) {
      // Merge into previous sentence instead of dropping (better coherency)
      if (repaired.length > 0) {
        const prev = repaired[repaired.length - 1].replace(/[.!?]$/, "");
        const rest = s.charAt(0).toLowerCase() + s.slice(1).replace(/[.!?]$/, "");
        repaired[repaired.length - 1] = `${prev}, ${rest}.`;
        continue;
      }
      continue; // drop fragment at start
    }
    // Also drop sentences with no discernible verb (after all transformations)
    if (!CONTENT_VERBS.test(s) && words.length < 5) {
      if (repaired.length > 0) {
        const prev = repaired[repaired.length - 1].replace(/[.!?]$/, "");
        const rest = s.charAt(0).toLowerCase() + s.slice(1).replace(/[.!?]$/, "");
        repaired[repaired.length - 1] = `${prev}, ${rest}.`;
        continue;
      }
      continue;
    }

    repaired.push(s);
  }

  return repaired.join(" ");
}

/** Tone-specific register shift. */
function applyTone(text: string, tone: string): string {
  if (tone === "Formal") {
    return text
      .replace(/\bdon't\b/gi, "do not").replace(/\bcan't\b/gi, "cannot")
      .replace(/\bwon't\b/gi, "will not").replace(/\bisn't\b/gi, "is not")
      .replace(/\baren't\b/gi, "are not").replace(/\bwasn't\b/gi, "was not")
      .replace(/\bdoesn't\b/gi, "does not").replace(/\bdidn't\b/gi, "did not")
      .replace(/\bhasn't\b/gi, "has not").replace(/\bhave not\b/gi, "have not")
      .replace(/\bshouldn't\b/gi, "should not").replace(/\bwouldn't\b/gi, "would not")
      .replace(/\bcouldn't\b/gi, "could not")
      .replace(/\bi'm\b/gi, "I am").replace(/\byou're\b/gi, "you are")
      .replace(/\bwe're\b/gi, "we are").replace(/\bthey're\b/gi, "they are")
      .replace(/\bit's\b/gi, "it is").replace(/\bthat's\b/gi, "that is")
      .replace(/\bthere's\b/gi, "there is").replace(/\blet's\b/gi, "let us");
  }
  if (tone === "Casual") {
    return text
      .replace(/\bdo not\b/gi, "don't").replace(/\bcannot\b/gi, "can't")
      .replace(/\bwill not\b/gi, "won't").replace(/\bis not\b/gi, "isn't")
      .replace(/\bare not\b/gi, "aren't").replace(/\bdoes not\b/gi, "doesn't")
      .replace(/\bdid not\b/gi, "didn't").replace(/\bI am\b/g, "I'm")
      .replace(/\byou are\b/gi, "you're").replace(/\bit is\b/gi, "it's")
      .replace(/\bthat is\b/gi, "that's");
  }
  if (tone === "Academic") {
    return text
      .replace(/\bshows\b/gi, "demonstrates").replace(/\buses\b/gi, "employs")
      .replace(/\bdoes\b/gi, "performs").replace(/\bthinks\b/gi, "posits")
      .replace(/\bbut\b/gi, "however").replace(/\bso\b/gi, "therefore")
      .replace(/\balso\b/gi, "furthermore").replace(/\babout\b/gi, "regarding")
      .replace(/\bget\b/gi, "obtain").replace(/\bshows\b/gi, "demonstrates");
  }
  return text;
}

/** Main rewrite pipeline.
 *  1. Phrase swaps     → multi-word pattern substitution
 *  2. Token synonyms   → per-occurrence aggressive swap (FNV-1a, suffix-aware)
 *  3. Restructure      → clause-level reordering + framing + voice
 *  4. Tone polish      → register shift (Formal / Casual / Academic)
 *  5. Grammar cleanup  → fix "a/an", subject-verb consistency, spacing
 */
function localRewrite(
  input: string,
  intensity: "light" | "balanced" | "deep",
  tone: string
): string {
  if (!input.trim()) return input;
  let out = input;

  // 1. Phrase-level swaps
  for (const [rx, rep] of PHRASE_SWAPS) {
    out = out.replace(rx, rep);
  }

  // 2. Token-by-token synonym replacement (per-occurrence FNV-1a hash, suffix-aware)
  out = applyTokenSynonyms(out, intensity);

  // 3. Sentence restructuring + framing + voice
  out = restructureSentences(out, intensity);

  // 4. Tone adjustment
  out = applyTone(out, tone);

  // 4b. Subject-verb agreement fixes (must run after synonym/clause transforms)
  out = fixSubjectVerbAgreement(out);

  // 5. Grammar / spacing cleanup
  out = out
    .replace(/  +/g, " ")
    .replace(/\s+([.!?,;:])/g, "$1")
    .replace(/([!?.,;:])(?=[A-Z])/g, "$1 ")
    .replace(/\s{2,}/g, " ")
    .trim();

  // 5b. Fix "a/an" usage: "a " before vowel sound → "an "; "an " before consonant → "a "
  out = out.replace(/\b[aA] ([aeiouAEIOU])/g, (_m, v) => (/[A-Z]/.test(v) ? "An " : "an ") + v);
  out = out.replace(/\b[Aa]n ([bcdfghjklmnpqrstvwxyzBCDFGHJKLMNPQRSTVWXYZ])/g,
    (_m, c) => (/[A-Z]/.test(c) ? "A " : "a ") + c);

  // 5c. Fix doubled small words: "the the", "is is", "of of", "and and"
  const doublers = ["the", "is", "of", "and", "a", "an", "to", "in", "it", "its", "on", "for", "with", "that"];
  for (const w of doublers) {
    const re = new RegExp("\\b" + w + "\\s+" + w + "\\b", "gi");
    out = out.replace(re, w);
  }
  // Also handle capitalized at sentence start: "The the" → "The"
  for (const w of doublers) {
    const cap = w.charAt(0).toUpperCase() + w.slice(1);
    const re = new RegExp("\\b" + cap + "\\s+" + w + "\\b", "g");
    out = out.replace(re, cap);
  }

  // 6. Sentence repair: capitalization, dangling subordinators, fragment merging
  out = repairSentences(out);

  // 7. Final grammar polish: re-check agreement after merges, fix articles, spacing
  out = finalGrammarPolish(out);

  return out;
}

/** Very small character-level diff spaner (used for Pro side-by-side UI). */
function diffSpans(a: string, b: string): RewriterDiffSpan[] {
  // Linearly tokenize to sentences. Same = same; otherwise alternate del/add for mismatches.
  const sa = a.match(/[^.!?]+[.!?]?\s*/g) ?? [a];
  const sb = b.match(/[^.!?]+[.!?]?\s*/g) ?? [b];
  const out: RewriterDiffSpan[] = [];
  const n = Math.max(sa.length, sb.length);
  for (let i = 0; i < n; i++) {
    if (i < sa.length && i < sb.length && sa[i].trim() === sb[i].trim()) {
      out.push({ kind: "same", text: sa[i] });
    } else {
      if (i < sa.length) out.push({ kind: "del", text: sa[i] });
      if (i < sb.length) out.push({ kind: "add", text: sb[i] });
    }
  }
  return out;
}

/** Encode page-range text → array of [start,end] 1-indexed inclusive pairs, resolving 'end'.
 *  Never produces start > end; invalid ranges (e.g. "6-10" when total=5) are filtered out. */
function parsePageRanges(text: string, totalPages: number): [number, number][] {
  const norm = (text ?? "").trim();
  if (!norm) return [];
  const out: [number, number][] = [];
  for (const chunk of norm.split(",").map((c) => c.trim()).filter(Boolean)) {
    if (chunk.includes("-")) {
      const [a, b] = chunk.split("-").map((s) => s.trim().toLowerCase());
      const start = Math.max(1, Math.min(totalPages, parseInt(a || "1", 10) || 1));
      const endRaw = b === "end" || b === "" ? totalPages : parseInt(b, 10);
      const end = isNaN(endRaw) ? totalPages : Math.min(totalPages, endRaw);
      // Ensure valid range; skip chunks that are entirely out of bounds
      if (start <= end && start >= 1) out.push([start, end]);
    } else {
      const n = parseInt(chunk, 10);
      if (isNaN(n)) continue;
      const p = Math.max(1, Math.min(totalPages, n));
      out.push([p, p]);
    }
  }
  // Deduplicate: remove exact duplicates and merge only truly overlapping ranges
  // (adjacent ranges like [1,2] and [3,4] are kept separate — user intended chunks).
  if (out.length === 0) return out;
  out.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const merged: [number, number][] = [];
  for (const r of out) {
    const last = merged[merged.length - 1];
    // Overlap: r[0] <= last[1] (they share at least one page)
    if (last && r[0] <= last[1]) {
      last[1] = Math.max(last[1], r[1]);
    } else {
      merged.push([r[0], r[1]]);
    }
  }
  return merged;
}

/** Compute every-N pages ranges. */
function rangesEveryN(everyN: number, totalPages: number): [number, number][] {
  const n = Math.max(1, Math.min(500, everyN | 0));
  const out: [number, number][] = [];
  for (let i = 1; i <= totalPages; i += n) {
    out.push([i, Math.min(totalPages, i + n - 1)]);
  }
  return out;
}

export const PROCESSORS: Record<
  string,
  // Expansion: implement each processor with its real payload/response types.
  (input: unknown, options: Record<string, unknown>) => Promise<unknown>
> = {
  "ai/summarize": async () => ({ output: "⚠️ Processor not wired yet." }),
  "ai/paraphrase": async () => ({ output: "⚠️ Processor not wired yet." }),
  "ai/grammar": async () => ({ output: "⚠️ Processor not wired yet." }),
  "pdf/compress": async () => ({ downloadUrl: "", newSizeBytes: 0 }),
  "pdf/merge": async () => ({ downloadUrl: "", newSizeBytes: 0 }),
  "pdf/unlock": async () => ({ downloadUrl: "", newSizeBytes: 0 }),
  "pdf/split": async () => ({ downloadUrls: [] as string[] }),

  /* ------------------------------ NEW TOOL 6: IMAGE COMPRESSOR ------------------------------ */
  "image/compress-client": async (inputRaw: unknown) => {
    const p = inputRaw as {
      fileBytesBase64: string;
      file?: any;
      originalName: string;
      originalSizeBytes: number;
      originalType: string;
      mode: "Quality slider" | "Target file size" | "Auto (recommended)";
      quality: number;
      targetSizeKB: number;
      maxWidth: number;
      maxHeight: number;
      format: "Original" | "JPG" | "WebP" | "PNG";
      stripMeta: boolean;
    };

    // Determine output MIME + extension
    let outputMime = p.originalType || "image/jpeg";
    let ext = "jpg";
    if (p.format === "JPG") { outputMime = "image/jpeg"; ext = "jpg"; }
    else if (p.format === "WebP") { outputMime = "image/webp"; ext = "webp"; }
    else if (p.format === "PNG") { outputMime = "image/png"; ext = "png"; }
    else {
      if (p.originalType === "image/png") { outputMime = "image/png"; ext = "png"; }
      else if (p.originalType === "image/webp") { outputMime = "image/webp"; ext = "webp"; }
      else { outputMime = "image/jpeg"; ext = "jpg"; }
    }

    // --- Real Canvas-based compression (runs in browser) ---
    const hasDOM = typeof document !== "undefined" && typeof Image !== "undefined";

    if (hasDOM) {
      // Load the image from the data URL
      const { img, width: origW, height: origH } = await new Promise<{ img: HTMLImageElement; width: number; height: number }>((resolve, reject) => {
        const im = new Image();
        im.onload = () => resolve({ img: im, width: im.naturalWidth || im.width, height: im.naturalHeight || im.height });
        im.onerror = () => reject(new Error("Failed to load image for compression"));
        im.src = p.fileBytesBase64;
      });

      // Calculate output dimensions (maintain aspect ratio if resize requested)
      let outW = origW;
      let outH = origH;
      if (p.maxWidth > 0 && outW > p.maxWidth) {
        outH = Math.round(outH * (p.maxWidth / outW));
        outW = p.maxWidth;
      }
      if (p.maxHeight > 0 && outH > p.maxHeight) {
        outW = Math.round(outW * (p.maxHeight / outH));
        outH = p.maxHeight;
      }

      // Draw to canvas and encode
      const drawAndEncode = (quality: number): string => {
        const canvas = document.createElement("canvas");
        canvas.width = outW;
        canvas.height = outH;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas 2D context unavailable");
        // White background for JPEG (no alpha channel)
        if (outputMime === "image/jpeg") {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, outW, outH);
        }
        ctx.drawImage(img, 0, 0, outW, outH);
        // PNG ignores quality parameter (lossless)
        const q = outputMime === "image/png" ? undefined : quality;
        return canvas.toDataURL(outputMime, q);
      };

      const dataUrlBytes = (url: string): number => {
        const b64 = url.split(",")[1] || "";
        // Base64 → bytes: each char = 6 bits, 4 chars = 3 bytes, minus padding
        const padding = (b64.match(/=+$/) || [""])[0].length;
        return Math.floor((b64.length * 3) / 4) - padding;
      };

      let compressedDataUrl: string;
      let compressedSizeBytes: number;

      if (p.mode === "Quality slider") {
        // Direct quality → re-encode
        compressedDataUrl = drawAndEncode(Math.max(0.01, Math.min(1, p.quality / 100)));
        compressedSizeBytes = dataUrlBytes(compressedDataUrl);
      } else if (p.mode === "Target file size") {
        // Binary search quality to hit target size (±5%)
        const targetBytes = p.targetSizeKB * 1024;
        let lo = 0.05, hi = 0.95;
        let best = "";
        let bestSize = Infinity;
        for (let i = 0; i < 8; i++) {
          const mid = (lo + hi) / 2;
          const result = drawAndEncode(mid);
          const size = dataUrlBytes(result);
          if (size <= targetBytes) {
            best = result;
            bestSize = size;
            lo = mid; // try higher quality
          } else {
            hi = mid; // need lower quality
          }
        }
        // If even q=0.05 exceeds target, use the lowest
        if (!best) {
          best = drawAndEncode(0.05);
          bestSize = dataUrlBytes(best);
        }
        compressedDataUrl = best;
        compressedSizeBytes = bestSize;
      } else {
        // Auto: target ~70% size reduction, binary search for best quality that achieves it
        const targetBytes = Math.floor(p.originalSizeBytes * 0.30);
        let lo = 0.05, hi = 0.95;
        let best = "";
        let bestSize = Infinity;
        for (let i = 0; i < 8; i++) {
          const mid = (lo + hi) / 2;
          const result = drawAndEncode(mid);
          const size = dataUrlBytes(result);
          if (size <= targetBytes) {
            best = result;
            bestSize = size;
            lo = mid;
          } else {
            hi = mid;
          }
        }
        if (!best) {
          best = drawAndEncode(0.05);
          bestSize = dataUrlBytes(best);
        }
        compressedDataUrl = best;
        compressedSizeBytes = bestSize;
      }

      const savingsPercent = Math.max(0, Math.min(99.9, 100 * (p.originalSizeBytes - compressedSizeBytes) / Math.max(1, p.originalSizeBytes)));
      const baseName = p.originalName.replace(/\.[^.]+$/, "");

      const item: ImageCompressResultItem = {
        originalName: p.originalName,
        originalSizeBytes: p.originalSizeBytes,
        compressedSizeBytes,
        originalW: origW,
        originalH: origH,
        outputW: outW,
        outputH: outH,
        savingsPercent,
        bytesBase64: compressedDataUrl,
        mimeType: outputMime,
        downloadName: `${baseName}-compressed.${ext}`,
      };

      return {
        files: [item],
        totalOriginalBytes: p.originalSizeBytes,
        totalCompressedBytes: compressedSizeBytes,
        totalSavingsPercent: savingsPercent,
      } satisfies ImageCompressResult;
    }

    // --- Fallback (SSR / no DOM): return original unchanged ---
    const baseName = p.originalName.replace(/\.[^.]+$/, "");
    const item: ImageCompressResultItem = {
      originalName: p.originalName,
      originalSizeBytes: p.originalSizeBytes,
      compressedSizeBytes: p.originalSizeBytes,
      originalW: p.maxWidth || 1920,
      originalH: p.maxHeight || 1080,
      outputW: p.maxWidth || 1920,
      outputH: p.maxHeight || 1080,
      savingsPercent: 0,
      bytesBase64: p.fileBytesBase64,
      mimeType: outputMime,
      downloadName: `${baseName}-compressed.${ext}`,
    };
    return {
      files: [item],
      totalOriginalBytes: p.originalSizeBytes,
      totalCompressedBytes: p.originalSizeBytes,
      totalSavingsPercent: 0,
    } satisfies ImageCompressResult;
  },

  /* ------------------------------ NEW TOOL 7: PDF TO WORD ------------------------------ */
  "pdf/to-word": async (inputRaw: unknown) => {
    const p = inputRaw as {
      fileBytesBase64?: string;
      sourceName?: string;
      sourcePages?: number;
      outputFormat: ".docx" | ".txt";
      ocrFallback: boolean;
      plan?: "free" | "pro";
    };

    // --- If running in the browser, hit the server-side API route instead.
    // pdf-parse v2 + docx both work perfectly in Node but their ESM bundles
    // can't be loaded correctly by webpack in-browser (Object.defineProperty
    // crash on the wrapped namespace), so we offload the work entirely.
    if (typeof window !== "undefined") {
      const res = await fetch("/api/pdf-to-word", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileBytesBase64: p.fileBytesBase64 ?? "",
          sourceName: p.sourceName,
          sourcePages: p.sourcePages,
          outputFormat: p.outputFormat,
          ocrFallback: p.ocrFallback,
          plan: p.plan,
        }),
      });
      const json: any = await res.json().catch(() => ({}));
      if (!json?.ok) {
        throw new Error(json?.error ?? `Server returned HTTP ${res.status}`);
      }
      // Build Uint8Array from server-returned base64 to match the in-process
      // response contract (fileBytes: Uint8Array). Also build the data: URL
      // downloadUrl that the result mapper and widget's blob-url fixer expect.
      const b64: string = json.fileBytesBase64 ?? "";
      const mime: string = (json.mime as string) ?? "application/octet-stream";
      const bin = typeof atob === "function" ? atob(b64) : "";
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i) & 0xff;
      const downloadUrl = `data:${mime};base64,${b64}`;
      const sizeBytes: number = typeof json.textChars === "number" ? bytes.length : bytes.length;
      const pagesTotal: number = (json.pagesTotal as number) ?? (json.pagesProcessed as number) ?? 0;
      const textCharsNum: number = (json.textChars as number) ?? 0;
      const firstPagePreview: string =
        typeof json.firstPagePreview === "string"
          ? (json.firstPagePreview as string)
          : ""; // widget handles empty string fine
      return {
        outputFormat: p.outputFormat,
        fileName: json.fileName as string,
        mime,
        fileBytes: bytes,
        downloadUrl,
        sizeBytes,
        pagesProcessed: json.pagesProcessed as number,
        pagesTotal,
        textChars: textCharsNum,
        tablesDetected: json.tablesDetected as number,
        ocrUsed: Boolean(json.ocrUsed),
        exceeded: Boolean(json.exceeded),
        firstPagePreview,
      } satisfies PdfToWordResult & {
        mime: string;
        fileBytes: Uint8Array;
        pagesTotal: number;
        textChars: number;
        exceeded: boolean;
      };
    }

    // --- The client widget always runs in the browser; the server route
    // is NOT here — it lives under /app/api/pdf-to-word/route.ts.
    // We keep this explicit safety net so if someone accidentally wires
    // the function for SSR, it fails loudly instead of trying to import
    // pdf-parse/docx (which would break webpack on the next build).
    throw new Error(
      "PDF to Word conversion requires a browser environment to POST " +
        "to /api/pdf-to-word. On the server, call the API route directly."
    );
  },

  /* ------------------------------ NEW TOOL 8: PASSWORD GENERATOR ------------------------------ */
  "security/password-gen": async (inputRaw: unknown) => {
    const p = inputRaw as {
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
      batchCount: number;
      plan?: "free" | "pro";
    };

    const rngArray: Uint32Array | null =
      (typeof globalThis !== "undefined" && (globalThis as any).crypto?.getRandomValues)
        ? new Uint32Array(1)
        : null;
    function randInt(n: number): number {
      if (n <= 0) return 0;
      if (rngArray && (globalThis as any).crypto) {
        const limit = Math.floor(0xFFFFFFFF / n) * n;
        let x: number;
        do {
          (globalThis as any).crypto.getRandomValues(rngArray);
          x = rngArray[0];
        } while (x >= limit);
        return x % n;
      }
      return Math.floor(Math.random() * n);
    }

    const EFF_WORDS = [
      "apple","banana","cherry","dragon","elder","forest","garden","harbor","island","jungle",
      "kite","lemon","mango","noble","ocean","piano","quilt","river","sugar","tiger",
      "urban","valley","water","xenon","yellow","zebra","anchor","bridge","castle","diamond",
      "eagle","flame","grape","honey","iron","jade","koala","lily","maple","nectar",
      "olive","pearl","quartz","rabbit","silver","thunder","unity","violet","whale","yogurt",
      "abandon","ability","absorb","academy","account","achieve","acoustic","acquire","across","action",
      "active","actual","adapt","admire","advance","advice","affair","affirm","afraid","agency",
      "agenda","almost","alpine","always","amazing","amount","analog","annual","answer","anxiety",
      "anyone","appeal","appear","arcade","arena","argue","arrive","article","artist","aspect",
      "assist","attach","attack","attend","august","author","autumn","average","avoid","awaken",
      "bachelor","balance","ballot","banner","barrel","battle","beauty","become","before","behave",
      "belief","belong","beneath","benefit","beyond","bishop","blanket","blossom","borrow","bottle",
      "bounce","brave","bread","breeze","brief","bright","broker","bronze","bubble","budget",
      "buffer","build","bundle","burden","butter","cabin","cactus","cadet","camel","candle",
      "canyon","capable","capital","captain","capture","carbon","career","carpet","carton","casual",
      "catalog","caught","cause","ceiling","cement","census","century","certain","chalk","champion",
      "change","chaos","chapter","charge","charm","chart","chase","cheap","check","cheese",
      "chef","cherish","chicken","child","choice","choose","chronic","circle","citizen","civil",
      "claim","clash","class","clean","clear","clerk","clever","cliff","climb","clinic",
      "clock","close","cloth","cloud","coast","coconut","coffee","coil","coin","collect",
    ];
    const wordList = EFF_WORDS;

    let entropyBits = 0;
    let strength: "Weak" | "Fair" | "Good" | "Strong" | "Very Strong" = "Weak";
    let mode: "random" | "passphrase" = p.mode === "Passphrase (words)" ? "passphrase" : "random";
    const passwords: string[] = [];
    const batchSize = Math.max(1, Math.min(100, p.batchCount || 1));

    if (mode === "random") {
      let pool = "";
      let UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
      let LOWER = "abcdefghijklmnopqrstuvwxyz";
      let NUMS = "0123456789";
      let SYMS = "!@#$%^&*()_+-=[]{}|;':\",./<>?";
      if (p.noAmbiguous) {
        UPPER = UPPER.replace(/[IO]/g, "");
        LOWER = LOWER.replace(/[l]/g, "");
        NUMS = NUMS.replace(/[01]/g, "");
      }
      if (p.upper) pool += UPPER;
      if (p.lower) pool += LOWER;
      if (p.numbers) pool += NUMS;
      if (p.symbols) pool += SYMS;
      if (pool.length === 0) { pool = LOWER + NUMS; }

      const requiredSets: string[] = [];
      if (p.upper && UPPER.length > 0) requiredSets.push(UPPER);
      if (p.lower && LOWER.length > 0) requiredSets.push(LOWER);
      if (p.numbers && NUMS.length > 0) requiredSets.push(NUMS);
      if (p.symbols && SYMS.length > 0) requiredSets.push(SYMS);
      if (requiredSets.length === 0) requiredSets.push(LOWER + NUMS);

      const len = Math.max(4, Math.min(128, p.length || 16));
      entropyBits = len * Math.log2(Math.max(2, pool.length));

      for (let b = 0; b < batchSize; b++) {
        let pw = "";
        for (let i = 0; i < len; i++) {
          pw += pool.charAt(randInt(pool.length));
        }
        const arr = pw.split("");
        for (let s = 0; s < requiredSets.length; s++) {
          const set = requiredSets[s];
          const pos = randInt(arr.length);
          arr[pos] = set.charAt(randInt(set.length));
        }
        passwords.push(arr.join(""));
      }
    } else {
      const wordCount = Math.max(3, Math.min(10, p.words || 4));
      entropyBits = wordCount * Math.log2(Math.max(2, wordList.length));

      for (let b = 0; b < batchSize; b++) {
        const chosen: string[] = [];
        for (let i = 0; i < wordCount; i++) {
          let w = wordList[randInt(wordList.length)];
          if (p.capitalize && w.length > 0) {
            w = w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
          }
          chosen.push(w);
        }
        let sep = "-";
        if (p.separator === "space") sep = " ";
        else if (p.separator === "period") sep = ".";
        else if (p.separator === "none") sep = "";
        let result = chosen.join(sep);
        if (p.appendNumber) {
          const num = randInt(100);
          if (p.separator === "none") result = `${result}${num}`;
          else result = `${result}${sep}${num}`;
        }
        passwords.push(result);
      }
    }

    if (entropyBits < 28) strength = "Weak";
    else if (entropyBits < 36) strength = "Fair";
    else if (entropyBits < 60) strength = "Good";
    else if (entropyBits < 128) strength = "Strong";
    else strength = "Very Strong";

    return {
      passwords,
      entropyBits,
      strength,
      mode,
    } satisfies PasswordGenResult;
  },

  /* ------------------------------ NEW TOOL 1: AI REWRITER ------------------------------ */
  "ai/rewriter": async (inputRaw: unknown) => {
    const payload = inputRaw as {
      text: string;
      intensity: "Light (minor swaps)" | "Balanced (restructured)" | "Deep (full rewrite)";
      tone: "Keep original" | "Formal" | "Casual" | "Academic";
      preserveKeyTerms: boolean;
      plan: "free" | "pro";
    };
    const intensity: "light" | "balanced" | "deep" =
      payload.intensity.startsWith("Light")
        ? "light"
        : payload.intensity.startsWith("Deep")
        ? "deep"
        : "balanced";

    // FREE tier hard constraints: enforce "Balanced" intensity, 5K cap (should be UI-limited too).
    let text = payload.text ?? "";
    const tone = payload.tone === "Keep original" ? "Keep original" : payload.tone;
    if (payload.plan === "free") {
      text = text.slice(0, 5000);
    }

    const cacheKey = `${intensity}|${tone}|${!!payload.preserveKeyTerms}|${text}`;
    const cached = getRewriterCached(cacheKey);
    if (cached) return cached;

    const rewritten = localRewrite(text, intensity, tone);
    const sim = similarityScore(text, rewritten);
    const resp: {
      output: string;
      similarityPercent: number;
      outputChars: number;
      watermark: boolean;
      sideBySideDiff?: RewriterDiffSpan[];
    } = {
      output: rewritten,
      similarityPercent: sim,
      outputChars: rewritten.length,
      watermark: payload.plan === "free",
    };
    if (payload.plan === "pro") {
      resp.sideBySideDiff = diffSpans(text, rewritten);
    }

    setRewriterCached(cacheKey, resp);
    return resp;
  },

  /* ------------------------------ NEW TOOL 2: PDF SPLITTER ------------------------------ */
  "pdf/split-v2": async (inputRaw: unknown) => {
    const p = inputRaw as {
      mode: string;
      pageRangesText?: string;
      everyN?: number;
      prefix?: string;
      sourcePages?: number;
      plan: "free" | "pro";
      sourceName: string;
      /** Base64-encoded source PDF bytes (client-side uploaded file). */
      fileBytesBase64?: string;
    };

    // --- 1. Parse page ranges (same as before) ---
    const defaultFromBase64 = async (b64?: string): Promise<number> => {
      if (!b64) return 0;
      try {
        // Best-effort approximate page count via pdf-lib if available.
        const { PDFDocument } = await import("pdf-lib");
        const bytes = base64ToUint8(b64);
        const doc = await PDFDocument.load(bytes);
        return doc.getPageCount();
      } catch {
        return 0;
      }
    };

    const base64ToUint8 = (b64: string): Uint8Array => {
      const bin =
        typeof atob === "function"
          ? atob(b64)
          : Buffer.from(b64, "base64").toString("binary");
      const len = bin.length;
      const out = new Uint8Array(len);
      for (let i = 0; i < len; i++) out[i] = bin.charCodeAt(i);
      return out;
    };

    const uint8ToBase64 = (buf: Uint8Array): string => {
      let s = "";
      for (let i = 0; i < buf.length; i++) s += String.fromCharCode(buf[i]);
      return typeof btoa === "function"
        ? btoa(s)
        : Buffer.from(s, "binary").toString("base64");
    };

    // Determine page count: prefer real count from base64 via pdf-lib, fall back to UI-provided.
    let total = Math.max(1, p.sourcePages ?? 1);
    if (p.fileBytesBase64) {
      const realTotal = await defaultFromBase64(p.fileBytesBase64);
      if (realTotal > 0) total = realTotal;
    }

    let ranges: [number, number][];
    if (p.mode.includes("Fixed")) {
      ranges = rangesEveryN(p.everyN ?? 10, total);
    } else if (p.mode.includes("Bookmark")) {
      // Split by bookmarks (top-level outlines). If none available,
      // fall back to demo: split into up to 3 roughly equal chunks
      // (matches the "Demo shows 3 placeholder bookmark groups" UI hint).
      ranges = [];
      if (p.fileBytesBase64) {
        try {
          const { PDFDocument } = await import("pdf-lib");
          const srcBytes = base64ToUint8(p.fileBytesBase64);
          const tmpDoc = await PDFDocument.load(srcBytes);
          const realTotal = tmpDoc.getPageCount();
          if (realTotal > 0) total = realTotal;
          // Try getOutline (pdf-lib may support outlines via getOutline())
          try {
            if (typeof (tmpDoc as any).getOutline === "function") {
              const outline = await (tmpDoc as any).getOutline();
              if (Array.isArray(outline) && outline.length > 0) {
                // Convert outline → page ranges.
                // Collect pages referenced by top-level outline items in order.
                const pageIndices: number[] = [];
                const walk = (nodes: any[]) => {
                  for (const n of nodes) {
                    try {
                      if (typeof n?.page?.getIndex === "function") {
                        const idx = n.page.getIndex() as number;
                        if (idx >= 0 && idx < realTotal) pageIndices.push(idx);
                      }
                    } catch {
                      /* ignore */
                    }
                    if (Array.isArray(n?.children) && n.children.length) {
                      walk(n.children);
                    }
                  }
                };
                walk(outline);
                const sorted = Array.from(new Set(pageIndices)).sort((a, b) => a - b);
                const srt = sorted.length > 0 ? sorted : [0];
                // Build ranges: start[i]..end[i], end[i] = max(start[i+1]-1, lastPage-1)
                for (let i = 0; i < srt.length; i++) {
                  const start = srt[i] + 1; // → 1-indexed
                  const end =
                    i === srt.length - 1
                      ? realTotal
                      : Math.max(start, srt[i + 1]); // next item's page (inclusive)
                  if (start <= end && start >= 1) ranges.push([start, end]);
                }
              }
            }
          } catch {
            /* outline not supported; fall through to demo chunks */
          }
        } catch {
          /* ignore */
        }
      }
      // Fallback: demo → split into up to 3 equal chunks
      if (ranges.length === 0) {
        const n = Math.min(3, Math.max(1, total));
        const chunkSize = Math.max(1, Math.ceil(total / n));
        for (let i = 0; i < n; i++) {
          const s = i * chunkSize + 1;
          const e = Math.min(total, (i + 1) * chunkSize);
          if (s <= e) ranges.push([s, e]);
        }
      }
    } else {
      ranges = parsePageRanges(p.pageRangesText ?? "1-5", total);
    }

    // FREE → max 5 output files. The 5th absorbs the tail ranges.
    if (p.plan === "free" && ranges.length > 5) {
      const head = ranges.slice(0, 4);
      const tail = ranges.slice(4);
      const lastStart = tail[0][0];
      const lastEnd = tail[tail.length - 1][1];
      ranges = [...head, [lastStart, lastEnd]];
    }

    const prefix = (p.prefix ?? "split").trim() || "split";
    const jobId = `job_${Math.random().toString(36).slice(2, 10)}`;
    const jobIdForUrl = jobId;

    // --- 2. Actually split the PDF using pdf-lib if bytes provided. ---
    const files: SplitOutFile[] = [];
    let splitOk = false;
    if (p.fileBytesBase64) {
      try {
        const { PDFDocument } = await import("pdf-lib");
        const srcBytes = base64ToUint8(p.fileBytesBase64);
        const srcDoc = await PDFDocument.load(srcBytes);
        const srcTotal = srcDoc.getPageCount();
        // Re-calibrate total with actual page count
        if (srcTotal > 0) total = srcTotal;
        // Re-normalize ranges against the real total, drop invalids, deduplicate
        ranges = ranges
          .map(([s, e]) => [
            Math.max(1, Math.min(srcTotal, s)),
            Math.max(1, Math.min(srcTotal, e)),
          ] as [number, number])
          .filter(([s, e]) => s <= e)
          // Sort, then merge only truly overlapping ranges (not adjacent)
          .sort((a, b) => a[0] - b[0] || a[1] - b[1])
          .reduce<[number, number][]>((acc, r) => {
            const last = acc[acc.length - 1];
            if (last && r[0] <= last[1]) {
              last[1] = Math.max(last[1], r[1]);
            } else {
              acc.push([r[0], r[1]]);
            }
            return acc;
          }, []);

        for (let idx = 0; idx < ranges.length; idx++) {
          const r = ranges[idx];
          const pages = r[0] === r[1] ? String(r[0]) : `${r[0]}-${r[1]}`;
          const outDoc = await PDFDocument.create();
          const startIdx = Math.max(1, r[0]);
          const endIdx = Math.min(srcTotal, r[1]);
          // pdf-lib uses 0-indexed page indices
          const indices: number[] = [];
          for (let n = startIdx; n <= endIdx; n++) indices.push(n - 1);
          const copied = await outDoc.copyPages(srcDoc, indices);
          copied.forEach((pg) => outDoc.addPage(pg));
          const outBytes = await outDoc.save();
          const b64 = uint8ToBase64(outBytes);
          const sizeBytes = outBytes.length;
          const name = `${prefix}-${String(idx + 1).padStart(2, "0")}.pdf`;
          // Temporary placeholder URL; client widget will convert bytesBase64 → blob URL.
          files.push({
            name,
            pages,
            sizeBytes,
            downloadUrl: `#split:${jobIdForUrl}/${idx}`,
            bytesBase64: b64,
          });
        }
        splitOk = true;
      } catch (e) {
        // Fall through to synthetic output below
      }
    }

    if (!splitOk) {
      // Fallback: synthetic entries (no bytes — download won't actually produce a PDF)
      const baseBytes = (p.sourcePages ?? 0) * 18_000;
      ranges.forEach((r, idx) => {
        const pages = r[0] === r[1] ? String(r[0]) : `${r[0]}-${r[1]}`;
        const pagesCount = 1 + (r[1] - r[0]);
        files.push({
          name: `${prefix}-${String(idx + 1).padStart(2, "0")}.pdf`,
          pages,
          sizeBytes: Math.max(
            4_000,
            Math.round(baseBytes * (pagesCount / Math.max(1, total)))
          ),
          downloadUrl: `#split:${jobIdForUrl}/${idx}`,
        });
      });
    }

    const out: { jobId: string; files: SplitOutFile[]; zipDownloadUrl?: string } = {
      jobId,
      files,
    };
    if (p.plan === "pro") {
      out.zipDownloadUrl = `#split-zip:${jobId}`;
    }
    return out;
  },

  /* ------------------------------ NEW TOOL 3: IMAGE CROPPER ------------------------------ */
  "image/cropper": async (inputRaw: unknown) => {
    // NOTE: real canvas cropping runs client-side in the widget because canvas APIs
    // require DOM access. This processor normalizes outputs (file naming + sizes)
    // so the result panel has consistent shape. Replace with server crop endpoint
    // for batch mode later.
    const p = inputRaw as {
      dataUrl: string;
      x: number;
      y: number;
      w: number;
      h: number;
      outFormat: "original" | "jpeg" | "webp" | "png";
      quality: number;
      originalName: string;
      originalType: string;
      originalSizeBytes: number;
      croppedDataUrl?: string;
      croppedSizeBytes?: number;
    };
    const ext =
      p.outFormat === "original"
        ? (p.originalType === "image/png"
            ? "png"
            : p.originalType === "image/webp"
            ? "webp"
            : "jpg")
        : p.outFormat === "jpeg"
        ? "jpg"
        : p.outFormat;
    const base = p.originalName.replace(/\.[^.]+$/, "");
    return {
      downloadName: `${base}-cropped.${ext}`,
      blobBase64: p.croppedDataUrl ?? p.dataUrl,
      blobType: `image/${ext === "jpg" ? "jpeg" : ext}`,
      sizeBytes: p.croppedSizeBytes ?? Math.max(512, Math.round((p.w * p.h) / 6)),
      originalSizeBytes: p.originalSizeBytes ?? 0,
    };
  },

  /* ------------------------------ NEW TOOL 4: QR GENERATOR ------------------------------ */
  "qr/generate": async (inputRaw: unknown) => {
    // NOTE: real QR matrix encoding + PNG/SVG/EPS export is computed client-side
    // by the widget (requires canvas or libraries). This processor returns a
    // consistent response envelope so the result panel has shape + filenames.
    const p = inputRaw as {
      dataType: "Text" | "URL" | "Email" | "Phone" | "Wi-Fi";
      size: number;
      fgColor: string;
      bgColor: string;
      errorLevel: "Low (7%)" | "Medium (15%)" | "Quartile (25%)" | "High (30%)";
      fields: Record<string, string>;
      plan: "free" | "pro";
      pngDataUrl?: string;
      svgMarkup?: string;
      epsMarkup?: string;
    };
    const ts = Date.now();
    const typeSlug = (p.dataType || "text").toLowerCase();
    const envelope: {
      pngDataUrl: string;
      svgMarkup?: string;
      epsMarkup?: string;
      downloadName: string;
    } = {
      pngDataUrl: p.pngDataUrl ?? "",
      downloadName: `qr-code-${typeSlug}-${ts}.png`,
    };
    if (p.plan === "pro") {
      envelope.svgMarkup = p.svgMarkup ?? "";
      envelope.epsMarkup = p.epsMarkup ?? "";
    }
    return envelope;
  },

  /* ------------------------------ NEW TOOL 5: WORD COUNTER ------------------------------ */
  "text/word-counter": async (inputRaw: unknown) => {
    const p = inputRaw as {
      text: string;
      readWpm: number;
      speakWpm: number;
      stopLang: "English" | "Spanish" | "French" | "German";
    };
    const txt = p.text ?? "";
    const charsWithSpaces = txt.length;
    const charsWithoutSpaces = txt.replace(/\s+/g, "").length;
    // Word tokens: split on whitespace/non-breaking-space, then trim leading/trailing non-word chars.
    // Use ASCII-safe trimming (not \p{}) since TS targets <ES2018.
    const trimNonWord = (s: string) => s.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, "");
    const wordTokens = txt
      .split(/[\s\u00A0]+/)
      .map(trimNonWord)
      .filter(Boolean);
    const words = wordTokens.length;

    // Sentences: split on .!? (followed by whitespace, quotes, parens, or bracket).
    // Avoid lookbehind (?<=) because it requires ES2018+.
    const sents = txt
      .split(/([.!?])(?:[\s"')\]]+|$)/)
      .reduce<string[]>((acc, chunk, i, arr) => {
        // The regex captures punctuation. Group punctuation with preceding text.
        if (/^[.!?]$/.test(chunk) && acc.length > 0) {
          acc[acc.length - 1] += chunk;
        } else if (chunk.trim().length > 0) {
          acc.push(chunk.trim());
        } else if (chunk.length > 0 && i === arr.length - 1 && /^[.!?]$/.test(chunk) && acc.length > 0) {
          acc[acc.length - 1] += chunk;
        }
        return acc;
      }, [])
      .map((s) => s.trim())
      .filter(Boolean);
    const sentences = sents.length;

    // Paragraphs = number of non-empty blocks separated by double newlines
    const paras = txt
      .split(/\n\s*\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    const paragraphs = paras.length;

    // Unique, excluding stop words
    const STOP: Record<Exclude<typeof p.stopLang, never>, Set<string>> = {
      English: new Set(
        "the a an and or but if then so of on in to for with by at from as is are was were be been being have has had do does did can could should would may might must i you he she it we they them my your his her its our their this that these those not no nor yet also just only".split(
          " "
        )
      ),
      Spanish: new Set(
        "el la los las un una unas unos y o pero si es son fue fueron ser estar de en a para por con al del se no me te lo le nos les muy".split(
          " "
        )
      ),
      French: new Set(
        "le la les un une des et ou mais si est sont été être de en à pour par avec au aux se ne pas je tu il elle on nous vous ils leur tres".split(
          " "
        )
      ),
      German: new Set(
        "der die das ein eine einen und oder aber wenn ist sind war waren sein werden von zu in mit auf für als auch noch nur ich du er sie es wir ihr".split(
          " "
        )
      ),
    };
    const stop = STOP[p.stopLang] ?? STOP.English;
    const freq = new Map<string, number>();
    wordTokens.forEach((t) => {
      const k = t.toLowerCase();
      if (stop.has(k)) return;
      if (k.length < 2) return;
      freq.set(k, (freq.get(k) ?? 0) + 1);
    });
    const totalContentWords = Array.from(freq.values()).reduce((a, b) => a + b, 0) || 1;
    const topWords = Array.from(freq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word, count]) => ({
        word,
        count,
        pct: Math.round((100 * count) / totalContentWords),
      }));
    const uniqueWords = freq.size;

    // Times
    const formatTime = (minutesFloat: number): string => {
      const m = Math.floor(minutesFloat);
      const s = Math.round((minutesFloat - m) * 60);
      if (m === 0) return `${s}s`;
      return s === 0 ? `${m}m` : `${m}m ${s}s`;
    };
    const readingTime = formatTime(words / Math.max(1, p.readWpm));
    const speakingTime = formatTime(words / Math.max(1, p.speakWpm));

    // Long sentences (>25 words) with startChar positions for jump-to
    const longSentences: WordCounterResult["longSentences"] = [];
    let scanIdx = 0;
    sents.forEach((sent, index) => {
      const pos = txt.indexOf(sent, scanIdx);
      const w = sent.split(/\s+/).filter((s) => s.length > 0).length;
      if (w > 25) longSentences.push({ index, words: w, text: sent, startChar: pos >= 0 ? pos : scanIdx });
      scanIdx = pos >= 0 ? pos + sent.length : scanIdx + sent.length;
    });

    return {
      words,
      charsWithSpaces,
      charsWithoutSpaces,
      sentences,
      paragraphs,
      uniqueWords,
      readingTime,
      speakingTime,
      topWords,
      longSentences,
    } satisfies WordCounterResult;
  },
};
