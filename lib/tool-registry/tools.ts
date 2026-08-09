import type { ToolDefinition } from "./types";

/**
 * HERO TOOLS — 8 initial stubs (3 AI + 5 PDF) per PRD §2.
 * New tool = append to this array. Home, search, sitemaps, nav update
 * automatically (build-time generation).
 *
 * Each tool uses status "coming-soon" until its processor is implemented.
 * Flip to "live" when processor + tests are in.
 * -------------------------------------------------------------------------- */
export const TOOLS: ToolDefinition[] = [
  /* =========================== [ AI TEXT TOOLS (3) ] =========================== */

  {
    slug: "text-summarizer",
    name: "Text Summarizer",
    tagline: "Turn long texts into concise summaries with AI.",
    icon: "📝",
    category: "ai",
    widgetType: "text-input",
    processor: "llm",
    processorId: "ai/summarize",
    keywords: ["summarize", "summary", "tl;dr", "condense", "abstract"],
    featured: true,
    minChars: 100,
    maxChars: { free: 5000, pro: 50000, unit: "chars" },
    options: [
      {
        id: "length",
        label: "Summary length",
        type: "select",
        options: ["Short (1-2 paragraphs)", "Medium (3-4)", "Detailed (5+)"],
        defaultValue: "Medium (3-4)",
        help: "Shorter = punchier; longer = keeps more detail.",
      },
      {
        id: "tone",
        label: "Tone",
        type: "select",
        options: ["Neutral", "Formal", "Casual"],
        defaultValue: "Neutral",
      },
      {
        id: "bulletPoints",
        label: "Bullet points",
        type: "toggle",
        defaultValue: false,
      },
    ],
    seo: {
      title: "Free AI Text Summarizer — Summarize Any Text Online",
      metaDescription:
        "Use ToolForge's free AI text summarizer to condense articles, essays and PDFs into concise summaries. 5,000 char free, no signup.",
      intro:
        "Paste any article, paper or transcript — get a clear, accurate summary powered by AI in seconds.",
      howItWorks: [
        { step: 1, heading: "Paste your text", body: "Copy up to 5,000 characters into the box (Pro: 50,000)." },
        { step: 2, heading: "Choose length & tone", body: "Pick summary length and writing tone. Toggle bullets for quick scans." },
        { step: 3, heading: "Get AI summary", body: "ToolForge calls an LLM and caches repeats — you get instant, accurate results." },
      ],
      faq: [
        { q: "Is my text stored?", a: "No. Inputs are processed in memory; cached responses expire from Redis after 1 hour." },
        { q: "How long is the free tier?", a: "Free tier is permanent — 3 operations/day and 5,000 chars per input." },
      ],
      relatedKeywords: ["article summarizer", "pdf summarizer", "ai summary tool"],
    },
    status: "coming-soon",
  },

  {
    slug: "paraphraser",
    name: "Paraphraser",
    tagline: "Rewrite sentences naturally while keeping the meaning.",
    icon: "🔄",
    category: "ai",
    widgetType: "text-input",
    processor: "llm",
    processorId: "ai/paraphrase",
    keywords: ["paraphrase", "rewrite", "rephrase", "reword"],
    featured: true,
    minChars: 100,
    maxChars: { free: 5000, pro: 50000, unit: "chars" },
    options: [
      {
        id: "tone",
        label: "Tone",
        type: "select",
        options: ["Formal", "Casual", "Academic", "Creative", "Simple"],
        defaultValue: "Formal",
      },
    ],
    seo: {
      title: "Free AI Paraphraser — Rewrite Text Online",
      metaDescription:
        "Rewrite essays, emails and sentences with ToolForge's free AI paraphraser. Pick your tone, no signup, 5,000 chars free.",
      intro:
        "Rewrite any text in a fresh tone while preserving the original meaning.",
      howItWorks: [
        { step: 1, heading: "Paste text", body: "Drop your paragraph, essay or email into the textarea." },
        { step: 2, heading: "Pick a tone", body: "Choose formal, academic, casual, creative or plain-language." },
        { step: 3, heading: "Copy the rewrite", body: "The model rephrases sentence-by-sentence; copy or reset and try again." },
      ],
      faq: [
        { q: "Will it pass plagiarism checks?", a: "Paraphrasing produces original phrasing. Always cite sources for academic work." },
      ],
      relatedKeywords: ["sentence rewriter", "essay rewriter", "ai rewording tool"],
    },
    status: "coming-soon",
  },

  {
    slug: "grammar-checker",
    name: "Grammar Checker",
    tagline: "Fix grammar, spelling and style in one click.",
    icon: "✅",
    category: "ai",
    widgetType: "text-input",
    processor: "llm",
    processorId: "ai/grammar",
    keywords: ["grammar", "spell check", "proofread", "punctuation"],
    featured: true,
    minChars: 100,
    maxChars: { free: 5000, pro: 50000, unit: "chars" },
    options: [
      {
        id: "highlightChanges",
        label: "Highlight changes",
        type: "toggle",
        defaultValue: true,
      },
      {
        id: "strictness",
        label: "Strictness",
        type: "select",
        options: ["Light (typos only)", "Standard", "Strict (style too)"],
        defaultValue: "Standard",
      },
    ],
    seo: {
      title: "Free AI Grammar Checker — Proofread Online",
      metaDescription:
        "Check grammar, spelling and punctuation instantly with ToolForge's free AI proofreader. 5,000 chars free, no account.",
      intro:
        "Catch typos, grammar errors and awkward phrasing — with inline change highlighting.",
      howItWorks: [
        { step: 1, heading: "Paste your writing", body: "Up to 5,000 chars of text, email or essay." },
        { step: 2, heading: "Set strictness", body: "Light fixes typos; Standard fixes grammar; Strict polishes style." },
        { step: 3, heading: "Apply corrections", body: "Changes are highlighted. Copy the fixed version or refine further." },
      ],
      faq: [],
      relatedKeywords: ["spell checker", "proofreader", "punctuation checker"],
    },
    status: "coming-soon",
  },

  /* =========================== [ NEW TOOL 1: AI ARTICLE REWRITER ] =========================== */
  {
    slug: "ai-rewriter",
    name: "AI Article Rewriter",
    tagline: "Rewrite text naturally — full-context, not just synonyms.",
    icon: "✍️",
    category: "ai",
    widgetType: "text-input",
    processor: "llm",
    processorId: "ai/rewriter",
    keywords: [
      "rewrite article",
      "ai rewriter",
      "reword tool",
      "paraphrase long text",
      "article spinner",
      "rewrite essay",
      "humanize ai text",
    ],
    tags: ["Featured AI", "Writing"],
    featured: true,
    minChars: 100,
    maxChars: { free: 5000, pro: 50000, unit: "chars" },
    options: [
      {
        id: "intensity",
        label: "Rewriting intensity",
        type: "select",
        options: ["Light (minor swaps)", "Balanced (restructured)", "Deep (full rewrite)"],
        defaultValue: "Balanced (restructured)",
        proOnly: false, // Deep is locked for FREE → handled in options-row
        help: "Light keeps sentences mostly intact; Deep rewrites line-by-line.",
      },
      {
        id: "tone",
        label: "Tone",
        type: "select",
        options: ["Keep original", "Formal", "Casual", "Academic"],
        defaultValue: "Keep original",
        help: "Forces the rewritten output into a specific register.",
      },
      {
        id: "preserveKeyTerms",
        label: "Preserve key terms (names, brands, numbers)",
        type: "toggle",
        defaultValue: true,
        help: "Avoids swapping proper nouns, numbers, or domain jargon.",
      },
    ],
    seo: {
      title: "Free AI Article Rewriter — Rewrite Text Online",
      metaDescription:
        "Rewrite articles, essays and drafts naturally. 100-char minimum, intensity Light/Balanced/Deep, tone control. 5,000 chars free, no signup.",
      intro:
        "Paste any article or draft and get a naturally-worded rewrite. Unlike synonym-swappers, ToolForge reads the full context and reconstructs each sentence from scratch — preserving your meaning, changing your words.",
      howItWorks: [
        { step: 1, heading: "Paste your text", body: "From 100 to 5,000 characters (50,000 on Pro)." },
        { step: 2, heading: "Choose intensity & tone", body: "Light for polish, Balanced for rewrite, Deep for full restructure. Force tone or keep original." },
        { step: 3, heading: "Rewrite", body: "Cached repeats return instantly. Copy the rewritten version, or 'Rewrite again' for a fresh pass." },
      ],
      faq: [
        { q: "Is this plagiarism-safe for students?", a: "Rewrite produces original phrasing. Always cite sources and follow your institution's AI-use policy." },
        { q: "What does the similarity score mean?", a: "A lightweight diff compares your input vs. output. Higher % = more change. 0-100% scale." },
        { q: "Where is the side-by-side diff?", a: "Side-by-side with green/red inline changes is a Pro feature." },
      ],
      relatedKeywords: ["essay rewriter", "ai article spinner", "rephrase article", "humanize ai writing"],
    },
    status: "live",
  },

  /* =========================== [ PDF & FILE TOOLS (5) ] =========================== */

  {
    slug: "compress-pdf",
    name: "Compress PDF",
    tagline: "Shrink PDF file size without losing quality.",
    icon: "📉",
    category: "pdf",
    widgetType: "file-upload",
    processor: "pdf-serverless",
    processorId: "pdf/compress",
    keywords: ["compress pdf", "reduce pdf size", "shrink pdf", "pdf compressor"],
    featured: true,
    acceptedFileTypes: ["application/pdf", ".pdf"],
    maxFileSizeMB: { free: 10, pro: 2000, unit: "MB" },
    options: [
      {
        id: "level",
        label: "Compression level",
        type: "select",
        options: ["Recommended", "Smallest size (lower quality)", "Best quality"],
        defaultValue: "Recommended",
      },
    ],
    seo: {
      title: "Compress PDF Online — Free, Up to 10 MB",
      metaDescription:
        "Shrink PDF files for free with ToolForge. Up to 10 MB per file, 3 ops/day. Files auto-delete after 1 hour.",
      intro:
        "Upload a PDF and we'll reduce its size while keeping text and images crisp.",
      howItWorks: [
        { step: 1, heading: "Drop your PDF", body: "Drag-and-drop or click to upload (up to 10 MB free / 2 GB Pro)." },
        { step: 2, heading: "Pick compression level", body: "Recommended balances size and quality; choose extremes if needed." },
        { step: 3, heading: "Download", body: "Download your smaller PDF. Original and output both expire in 1-2 hours." },
      ],
      faq: [
        { q: "Are my PDFs private?", a: "Yes. Files are encrypted in transit, stored with auto-expire TTL, and never shared." },
      ],
      relatedKeywords: ["pdf reducer", "pdf size reducer", "make pdf smaller"],
    },
    status: "coming-soon",
  },

  {
    slug: "merge-pdf",
    name: "Merge PDF",
    tagline: "Combine multiple PDFs into one file.",
    icon: "🔗",
    category: "pdf",
    widgetType: "multi-file",
    processor: "pdf-serverless",
    processorId: "pdf/merge",
    keywords: ["merge pdf", "combine pdf", "join pdf"],
    featured: true,
    acceptedFileTypes: ["application/pdf", ".pdf"],
    maxFiles: { free: 3, pro: "unlimited", unit: "files" },
    maxFileSizeMB: { free: 10, pro: 2000, unit: "MB" },
    options: [],
    seo: {
      title: "Merge PDF Online — Combine PDF Files Free",
      metaDescription:
        "Merge up to 3 PDFs for free with ToolForge. Reorder pages by drag-and-drop, no watermarks.",
      intro:
        "Combine PDFs in your preferred order — drag to sort, then download the single merged file.",
      howItWorks: [
        { step: 1, heading: "Add PDFs", body: "Drop 2 or more PDFs (free: up to 3; Pro: unlimited)." },
        { step: 2, heading: "Reorder", body: "Drag files by their handle to set the final order." },
        { step: 3, heading: "Merge & download", body: "We stitch them into a single PDF. No watermarks." },
      ],
      faq: [],
      relatedKeywords: ["pdf joiner", "combine pdf files", "merge pdf free"],
    },
    status: "coming-soon",
  },

  {
    slug: "unlock-pdf",
    name: "Unlock PDF",
    tagline: "Remove password protection from PDFs.",
    icon: "🔓",
    category: "pdf",
    widgetType: "file-upload",
    processor: "pdf-serverless",
    processorId: "pdf/unlock",
    keywords: ["unlock pdf", "remove pdf password", "pdf password remover"],
    acceptedFileTypes: ["application/pdf", ".pdf"],
    maxFileSizeMB: { free: 10, pro: 2000, unit: "MB" },
    options: [
      {
        id: "password",
        label: "PDF owner password",
        type: "password",
        defaultValue: "",
        help: "We use it locally to unlock; the password is never stored.",
      },
    ],
    seo: {
      title: "Unlock PDF — Remove PDF Password Free",
      metaDescription:
        "Remove password protection from PDF files free online. Upload + enter owner password, download the unlocked copy.",
      intro:
        "Enter the owner password for a protected PDF and instantly download a restriction-free copy.",
      howItWorks: [
        { step: 1, heading: "Upload protected PDF", body: "Drop the locked file (10 MB free)." },
        { step: 2, heading: "Enter owner password", body: "The password is only used locally to decrypt this upload." },
        { step: 3, heading: "Download unlocked PDF", body: "Copy, print, and edit freely. Both files expire after 1-2 hours." },
      ],
      faq: [
        { q: "Can you crack a PDF I don't have the password for?", a: "No. You must have the owner password. ToolForge does not perform attacks on encryption." },
      ],
      relatedKeywords: ["pdf password remover", "decrypt pdf", "remove pdf restriction"],
    },
    status: "coming-soon",
  },

  {
    slug: "pdf-to-word",
    name: "PDF to Word",
    tagline: "Convert PDFs to editable Word documents.",
    icon: "📑",
    category: "pdf",
    widgetType: "pdf-to-word-converter",
    processor: "pdf-serverless",
    processorId: "pdf/to-word",
    keywords: ["pdf to word", "pdf to docx", "convert pdf to word"],
    featured: true,
    acceptedFileTypes: ["application/pdf", ".pdf"],
    maxFileSizeMB: { free: 10, pro: 2000, unit: "MB" },
    options: [
      {id:"outputFormat", label:"Output format", type:"select", options:[".docx",".txt"], defaultValue:".docx"},
      {id:"ocrFallback", label:"OCR fallback for scanned PDFs", type:"toggle", defaultValue:true},
    ],
    seo: {
      title: "PDF to Word Converter — Free Online",
      metaDescription:
        "Convert PDF to Word (DOCX) for free. Free tier = plain text; Pro preserves full layout. Files auto-delete.",
      intro:
        "Turn a PDF into an editable .docx. Upgrade to Pro for layout-preserving conversion.",
      howItWorks: [
        { step: 1, heading: "Upload your PDF", body: "Drop a PDF up to 10 MB." },
        { step: 2, heading: "Choose fidelity", body: "Free = basic text; Pro = keep fonts, tables, images." },
        { step: 3, heading: "Download DOCX", body: "Open directly in Microsoft Word, Google Docs, or LibreOffice." },
      ],
      faq: [],
      relatedKeywords: ["pdf to docx", "convert pdf to editable word", "pdf converter"],
    },
    status: "live",
  },

  /* =========================== [ NEW TOOL 2: PDF SPLITTER (replacing stub) ] =========================== */

  {
    slug: "split-pdf",
    name: "Split PDF",
    tagline: "Split by page ranges, fixed count, or bookmark sections.",
    icon: "✂️",
    category: "pdf",
    widgetType: "pdf-splitter",
    processor: "pdf-serverless",
    processorId: "pdf/split-v2",
    keywords: [
      "split pdf",
      "pdf splitter",
      "extract pages pdf",
      "split pdf by pages",
      "divide pdf",
      "bookmark split",
      "separate pdf pages",
    ],
    tags: ["PDF Split / Extract", "Popular"],
    featured: true,
    acceptedFileTypes: ["application/pdf", ".pdf"],
    maxFiles: { free: 1, pro: "unlimited", unit: "files" },
    maxFileSizeMB: { free: 10, pro: 2000, unit: "MB" },
    options: [
      {
        id: "mode",
        label: "Split by",
        type: "select",
        options: [
          "Page ranges (e.g. 1-3, 4-6, 7-10)",
          "Fixed count — every N pages",
          "Bookmark sections (top-level outline)",
        ],
        defaultValue: "Page ranges (e.g. 1-3, 4-6, 7-10)",
      },
      {
        id: "pageRanges",
        label: "Page ranges",
        type: "text",
        defaultValue: "1-5, 6-10, 11-end",
        help: "Comma-separated. Use 'end' for last page.",
      },
      {
        id: "everyN",
        label: "Split every N pages",
        type: "number",
        min: 1,
        max: 500,
        defaultValue: 10,
        help: "Ignored unless mode = Fixed count.",
      },
      {
        id: "outName",
        label: "Output name prefix",
        type: "text",
        defaultValue: "split",
        help: "Each file will be `<prefix>-01.pdf`, `<prefix>-02.pdf`…",
      },
    ],
    seo: {
      title: "Split PDF Online — Free PDF Splitter by Pages / Bookmarks",
      metaDescription:
        "Split a PDF by page ranges, every N pages, or by bookmark sections. Free up to 10 MB, 5 output files. Pro: 2 GB, ZIP download, batch.",
      intro:
        "Extract chapters, reports or contracts. Three split modes: page ranges (1-3, 4-6), every N pages, or by top-level PDF bookmarks.",
      howItWorks: [
        { step: 1, heading: "Drop your PDF", body: "Up to 10 MB Free · 2 GB Pro — we show total page count + bookmark preview." },
        { step: 2, heading: "Pick a split method", body: "Page ranges list, fixed count per file, or bookmark sections. Live preview of output count." },
        { step: 3, heading: "Split & download", body: "Each result is a new PDF. Pro: download all as a single ZIP." },
      ],
      faq: [
        { q: "How many output files can I get on Free?", a: "Free max is 5 output files. Pro has unlimited. The 5th chunk will keep the rest of the document." },
        { q: "What happens to my files?", a: "Files are signed-URL encrypted in transit, stored with 1-2 hour TTL, and never shared." },
      ],
      relatedKeywords: ["pdf page extractor", "break pdf into pages", "separate pdf", "pdf split by bookmark"],
    },
    status: "live",
  },

  /* =========================== [ EXPANSION SLOTS (Image / etc.) ] =========================== */
  // Image Compressor, Resizer, etc., follow the same pattern.
  // Example stub to show the shape:
  {
    slug: "image-compressor",
    name: "Image Compressor",
    tagline: "Compress JPG / PNG / WebP in your browser — instant & private.",
    icon: "🗜️",
    category: "image",
    widgetType: "image-compressor",
    processor: "canvas-client",
    processorId: "image/compress-client",
    keywords: ["compress image", "image compressor", "reduce jpg size", "png compressor"],
    featured: true,
    acceptedFileTypes: ["image/jpeg", "image/png", "image/webp"],
    maxFiles: { free: 1, pro: "unlimited", unit: "images" },
    maxFileSizeMB: { free: 10, pro: 2000, unit: "MB" },
    options: [
      {id:"mode", label:"Compression mode", type:"select", options:["Quality slider","Target file size","Auto (recommended)"], defaultValue:"Quality slider"},
      {id:"quality", label:"Quality (slider mode)", type:"slider", min:1, max:100, step:1, defaultValue:75},
      {id:"targetSizeKB", label:"Target size (KB)", type:"number", min:10, max:10000, step:1, defaultValue:300},
      {id:"maxWidth", label:"Max width (px, optional)", type:"number", min:10, max:10000, step:1, defaultValue:0, help:"0 = keep original"},
      {id:"maxHeight", label:"Max height (px, optional)", type:"number", min:10, max:10000, step:1, defaultValue:0},
      {id:"format", label:"Output format", type:"select", options:["Original","JPG","WebP","PNG"], defaultValue:"Original"},
      {id:"stripMeta", label:"Strip metadata", type:"toggle", defaultValue:true, help:"Remove EXIF, GPS, camera data"},
    ],
    seo: {
      title: "Free Image Compressor — Reduce JPG/PNG Size Online",
      metaDescription:
        "Compress JPG, PNG and WebP images for free in your browser. Zero upload — 100% private and instant.",
      intro:
        "Pick a quality slider and watch it compress right here on your device. Nothing leaves your browser.",
      howItWorks: [
        { step: 1, heading: "Drop images", body: "Batch Pro, or single free. No upload — reads locally." },
        { step: 2, heading: "Tune quality & format", body: "Use the slider and format picker for the perfect trade-off." },
        { step: 3, heading: "Download", body: "Download smaller versions. Savings shown inline." },
      ],
      faq: [
        { q: "Does anything get uploaded?", a: "Nope. Compression runs via Canvas in your browser." },
      ],
      relatedKeywords: ["jpg compressor", "png reducer", "webp converter"],
    },
    status: "live",
  },

  /* =========================== [ NEW TOOL 3: IMAGE CROPPER — client-side ] =========================== */
  {
    slug: "image-cropper",
    name: "Image Cropper",
    tagline: "Crop images with presets — 1:1, 4:3, 16:9, 9:16. Runs in your browser.",
    icon: "🖼️",
    category: "image",
    widgetType: "image-cropper",
    processor: "canvas-client",
    processorId: "image/cropper",
    keywords: [
      "crop image",
      "image cropper",
      "photo cropper",
      "crop jpg",
      "crop png",
      "crop webp",
      "square crop",
      "16:9 crop",
    ],
    tags: ["Social", "Instant"],
    featured: true,
    acceptedFileTypes: ["image/png", "image/jpeg", "image/webp"],
    maxFiles: { free: 1, pro: "unlimited", unit: "images" },
    maxFileSizeMB: { free: 10, pro: 2000, unit: "MB" },
    options: [
      {
        id: "aspect",
        label: "Aspect ratio",
        type: "select",
        options: ["Freeform", "1:1 (square)", "4:3", "16:9 (landscape)", "9:16 (portrait)", "3:2"],
        defaultValue: "Freeform",
      },
      {
        id: "lockAspect",
        label: "Lock aspect ratio",
        type: "toggle",
        defaultValue: true,
      },
      {
        id: "width",
        label: "Width (px)",
        type: "number",
        min: 1,
        max: 10000,
        defaultValue: 1024,
        help: "Sets the cropped output width. Pro: use with Height for exact pixel crops.",
      },
      {
        id: "height",
        label: "Height (px)",
        type: "number",
        min: 1,
        max: 10000,
        defaultValue: 1024,
      },
      {
        id: "format",
        label: "Output format",
        type: "select",
        options: ["Keep original", "JPG", "WebP", "PNG"],
        defaultValue: "Keep original",
      },
      {
        id: "quality",
        label: "Quality (JPG/WebP)",
        type: "slider",
        min: 10,
        max: 100,
        step: 1,
        defaultValue: 90,
      },
    ],
    seo: {
      title: "Free Image Cropper Online — Crop JPG, PNG, WebP Instantly",
      metaDescription:
        "Crop images free online. Aspect ratio presets 1:1, 4:3, 16:9, 9:16, 3:2. Runs in your browser, zero upload, 100% private.",
      intro:
        "Drag a rectangle over your image, pick an aspect ratio preset, enter exact pixels, then download. Everything happens on your device — no upload, no wait.",
      howItWorks: [
        { step: 1, heading: "Drop an image", body: "PNG / JPG / WebP, 10 MB free. No upload." },
        { step: 2, heading: "Crop", body: "Drag corners, snap to aspect preset, or enter exact W/H. Preview updates live." },
        { step: 3, heading: "Download", body: "JPG / WebP quality slider applied. Filename: `<original>-cropped.<ext>`." },
      ],
      faq: [
        { q: "Is any data sent to your servers?", a: "No. Image Cropper runs 100% client-side via Canvas API." },
        { q: "Can I apply the same crop to many images?", a: "Batch crop + ZIP download is a Pro feature." },
      ],
      relatedKeywords: ["photo cropper online", "insta square crop", "youtube thumbnail cropper", "tiktok 9:16"],
    },
    status: "live",
  },

  /* =========================== [ NEW TOOL 4: QR CODE GENERATOR — client-side ] =========================== */
  {
    slug: "qr-generator",
    name: "QR Code Generator",
    tagline: "Make QR codes for text, URL, email, phone, Wi-Fi. Download PNG.",
    icon: "🔳",
    category: "converters",
    widgetType: "qr-generator",
    processor: "canvas-client",
    processorId: "qr/generate",
    keywords: [
      "qr code generator",
      "create qr code",
      "wifi qr",
      "qr code png",
      "qr code svg",
      "vcard qr",
      "menu qr",
    ],
    tags: ["Marketing", "Instant"],
    featured: true,
    maxChars: { free: 4000, pro: 20000, unit: "chars of encoded payload" },
    options: [
      {
        id: "dataType",
        label: "QR content type",
        type: "select",
        options: ["Text", "URL", "Email", "Phone", "Wi-Fi"],
        defaultValue: "URL",
      },
      {
        id: "size",
        label: "QR size",
        type: "slider",
        min: 128,
        max: 1024,
        step: 32,
        defaultValue: 512,
      },
      {
        id: "fgColor",
        label: "Foreground color",
        type: "text",
        defaultValue: "#0f172a",
      },
      {
        id: "bgColor",
        label: "Background color",
        type: "text",
        defaultValue: "#ffffff",
      },
      {
        id: "errorCorrection",
        label: "Error correction",
        type: "select",
        options: ["Low (7%)", "Medium (15%)", "Quartile (25%)", "High (30%)"],
        defaultValue: "Medium (15%)",
      },
    ],
    seo: {
      title: "Free QR Code Generator — Text, URL, Email, Phone, Wi-Fi",
      metaDescription:
        "Generate QR codes for text, URL, email, phone and Wi-Fi. Custom colors, size 128-1024 px, 4 error-correction levels. Download PNG free; SVG/EPS is Pro.",
      intro:
        "Pick a data type, customize colors/size, download instantly. All rendering happens in your browser, data never leaves your device.",
      howItWorks: [
        { step: 1, heading: "Pick a type", body: "URL, Text, Email, Phone, Wi-Fi — each shows inputs for its fields." },
        { step: 2, heading: "Style it", body: "Size slider, FG/BG hex color, error-correction level. Preview updates live." },
        { step: 3, heading: "Download", body: "PNG default. Pro: SVG + EPS vectors, CSV batch, logo overlay." },
      ],
      faq: [
        { q: "Do you store the QR data?", a: "No. Encoding + rendering runs locally in the browser." },
        { q: "Can I put a logo in the center?", a: "Logo overlay is a Pro feature (safe at Medium or higher EC)." },
      ],
      relatedKeywords: ["free wifi qr", "email qr generator", "png qr code", "vector qr code svg"],
    },
    status: "live",
  },

  /* =========================== [ NEW TOOL 5: WORD COUNTER & READING TIME — client ] =========================== */
  {
    slug: "word-counter",
    name: "Word Counter & Reading Time",
    tagline: "Real-time words, chars, sentences, paragraphs, top 10 words, long sentences.",
    icon: "🧮",
    category: "calculators",
    widgetType: "word-counter",
    processor: "canvas-client",
    processorId: "text/word-counter",
    keywords: [
      "word counter",
      "reading time calculator",
      "character counter",
      "paragraph counter",
      "sentence counter",
      "unique word counter",
      "long sentence checker",
      "speaking time estimator",
    ],
    tags: ["Students", "Writers"],
    featured: true,
    options: [
      {
        id: "readWpm",
        label: "Reading speed (WPM)",
        type: "slider",
        min: 100,
        max: 400,
        step: 5,
        defaultValue: 200,
      },
      {
        id: "speakWpm",
        label: "Speaking speed (WPM)",
        type: "slider",
        min: 80,
        max: 250,
        step: 5,
        defaultValue: 130,
      },
      {
        id: "stopLang",
        label: "Stop word language",
        type: "select",
        options: ["English", "Spanish", "French", "German"],
        defaultValue: "English",
      },
    ],
    seo: {
      title: "Free Word Counter — Characters, Sentences, Reading Time",
      metaDescription:
        "Free online word counter with real-time words, chars with/without spaces, sentences, paragraphs, reading/speaking time, top 10 word frequency, long-sentence flagger.",
      intro:
        "Paste, type, or draft. Stats update instantly. Top-10 word frequency chart + long sentences list with jump-to links — 100% in your browser.",
      howItWorks: [
        { step: 1, heading: "Type or paste", body: "No length cap. No uploads — runs locally." },
        { step: 2, heading: "Tune speeds", body: "Reading and speaking WPM sliders change the time estimates instantly." },
        { step: 3, heading: "Analyze", body: "Top-10 words, sentences >25 words list with jump links. Copy summary to clipboard." },
      ],
      faq: [
        { q: "Do you store what I type?", a: "No. Word Counter runs entirely in-browser. Nothing is sent to servers." },
        { q: "What about Flesch-Kincaid and readability scores?", a: "Readability + word-count-goal progress bar + PDF export are Pro features." },
      ],
      relatedKeywords: [
        "essay word count",
        "reading time per words",
        "speech length calculator",
        "frequency of words in text",
      ],
    },
    status: "live",
  },

  {
    slug: "password-generator",
    name: "Password Generator",
    tagline: "Cryptographically random passwords & passphrases — zero server cost.",
    icon: "🔑",
    category: "security",
    widgetType: "password-generator",
    processor: "text-client",
    processorId: "security/password-gen",
    keywords: ["password generator", "random password", "passphrase generator", "strong password maker", "secure password creator"],
    tags: ["Developers","IT admins"],
    featured: true,
    options: [
      {id:"mode", label:"Mode", type:"select", options:["Random password","Passphrase (words)"], defaultValue:"Random password"},
      {id:"length", label:"Length (characters)", type:"slider", min:4, max:128, step:1, defaultValue:16},
      {id:"upper", label:"Include uppercase (A-Z)", type:"toggle", defaultValue:true},
      {id:"lower", label:"Include lowercase (a-z)", type:"toggle", defaultValue:true},
      {id:"numbers", label:"Include numbers (0-9)", type:"toggle", defaultValue:true},
      {id:"symbols", label:"Include symbols (!@#...)", type:"toggle", defaultValue:true},
      {id:"noAmbiguous", label:"Exclude ambiguous (l,1,I,O,0)", type:"toggle", defaultValue:true},
      {id:"words", label:"Word count (passphrase)", type:"slider", min:3, max:10, step:1, defaultValue:4},
      {id:"separator", label:"Word separator", type:"select", options:["hyphen","space","period","none"], defaultValue:"hyphen"},
      {id:"capitalize", label:"Capitalize words", type:"toggle", defaultValue:true},
      {id:"appendNumber", label:"Append a number", type:"toggle", defaultValue:true},
      {id:"batchCount", label:"Batch count (Pro)", type:"number", min:10, max:100, step:1, defaultValue:20, proOnly:true},
    ],
    seo: {
      title: "Free Password Generator — Strong Random Passwords Online",
      metaDescription: "Generate cryptographically random passwords, passphrases and batches. Runs entirely in your browser with Web Crypto — nothing stored or sent.",
      intro: "Pick a length and character set. Every password is drawn from crypto.getRandomValues right here on your device. No servers, no storage, no logs.",
      howItWorks: [
        {step:1, heading:"Choose a mode", body:"Random characters (default) or a memorable 3-10 word passphrase from the EFF list."},
        {step:2, heading:"Tune strength", body:"Slider + checkboxes instantly update entropy and the strength meter."},
        {step:3, heading:"Regenerate & copy", body:"One-click copy with confirmation. Pro users generate 10-100 at a time."},
      ],
      faq: [
        {q:"Are the passwords sent anywhere?", a:"No. Generation runs via Web Crypto in your browser. Nothing leaves your device."},
        {q:"What entropy means here?", a:"log2(poolSize^length) for random mode; log2(7776)*words for passphrases. 60+ bits is Strong; 128+ is Very Strong."},
      ],
      relatedKeywords: ["secure password generator","passphrase generator","random password maker","16 character password generator","strong password generator"],
    },
    status: "live",
  },
];
