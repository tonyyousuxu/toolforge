/**
 * Tool Registry Types — Core of the plugin-based architecture.
 * New tools = append to registry + implement a processor.
 * New categories = add slug to CategoryConfig + update tool.category entries.
 * -------------------------------------------------------------------------- */

export type CategorySlug =
  | "all"
  | "ai"
  | "pdf"
  | "image"
  | "converters"
  | "calculators"
  | "security";
// Expansion: append new category slugs here + register in CATEGORIES below.

export type WidgetType =
  | "file-upload"       // Single file (compress PDF, unlock PDF…)
  | "multi-file"        // Multiple sortable files (merge PDF…)
  | "text-input"        // Large textarea (summarizer, paraphraser, grammar…)
  | "image-client"      // Canvas-only, zero server cost (compress, resize)
  | "image-server"      // ML-heavy image (BG remove, OCR)
  | "calculator"        // Form inputs only (converters, calculators)
  | "pdf-splitter"      // NEW TOOL 2: Upload + 3 split modes + file list output
  | "image-cropper"     // NEW TOOL 3: File drop → crop rect → canvas export
  | "qr-generator"      // NEW TOOL 4: DataType switch → live preview canvas → download
  | "word-counter"      // NEW TOOL 5: Textarea → 6 stat cards + analysis panels
  | "image-compressor"  // NEW TOOL 6: Image upload → compress options
  | "pdf-to-word-converter" // NEW TOOL 7: PDF → DOCX/TXT
  | "password-generator";   // NEW TOOL 8: Security / passwords
// Expansion: append new widget types, then add widget renderer in ToolWidget.

export type ProcessorKind =
  | "llm"               // AI text → serverless LLM proxy with Redis cache
  | "pdf-serverless"    // PDF → Vercel/Lambda (pdf-lib / Ghostscript)
  | "canvas-client"     // Image → Canvas API client-side
  | "image-serverless"  // Image-ML → serverless
  | "stub"              // Placeholder until processor implemented
  | "api"               // Generic REST — reuse same processor layer
  | "text-client";      // Pure text client-side (password gen, etc.)

export interface CategoryInfo {
  slug: CategorySlug;
  name: string;
  icon: string;           // emoji for simplicity; swap for SVG later
  description: string;
  landingTagline: string; // /category/[slug] H2
  /** Optional: post-MVP schema-driven landing sub-pages. */
  featuredSlugs?: string[];
}

export interface ToolOptionField {
  id: string;
  label: string;
  type: "select" | "toggle" | "slider" | "number" | "text" | "password";
  options?: string[];           // for select
  min?: number; max?: number; step?: number; // for slider / number
  defaultValue: string | number | boolean;
  /** If true, Pro-only control. Free users see value locked + upgrade tooltip. */
  proOnly?: boolean;
  /** For SEO / How-it-works copy. */
  help?: string;
}

export interface TieredLimit {
  free: number;
  pro: number | "unlimited";
  unit: string; // "chars" | "mb" | "files" | "ops" …
}

export interface SEOCopy {
  title: string;                  // <title> + H1 (matches search intent)
  metaDescription: string;        // <meta description>
  intro: string;                  // H1 sub-copy, 1-2 sentences
  howItWorks: Array<{
    step: number;
    heading: string;
    body: string;
  }>;
  faq: Array<{ q: string; a: string }>;
  relatedKeywords: string[];      // internal-linking & autocomplete seeds
  /** Per-locale overrides (post-MVP i18n): e.g. { es: { title: "...", ... } } */
  locales?: Record<string, Partial<SEOCopy>>;
}

export interface ToolDefinition {
  /** Unique URL slug: /tools/[slug] — immutable once shipped (SEO URLs). */
  slug: string;
  name: string;
  tagline: string;
  icon: string;                        // emoji for zero-dependency icons
  category: Exclude<CategorySlug, "all">;
  widgetType: WidgetType;
  processor: ProcessorKind;
  /** Implementation hook: map processor ID → function. Stub until wired. */
  processorId: string;                 // e.g. "pdf/compress", "ai/summarize"
  keywords: string[];                  // Search + autocomplete
  tags?: string[];                     // Additional groupings
  featured?: boolean;                  // Pinned in home / category

  /** --- Widget / validation --- */
  acceptedFileTypes?: string[];        // MIME or ext; file-upload / multi-file
  maxFileSizeMB?: TieredLimit;
  maxFiles?: TieredLimit;              // multi-file
  maxChars?: TieredLimit;              // text-input
  minChars?: number;                   // text-input (LLM needs enough signal)

  options?: ToolOptionField[];         // Rendered as options row

  /** --- SEO (Module 8) --- */
  seo: SEOCopy;

  /** --- Revenue expansion (post-MVP) --- */
  affiliateLinks?: Array<{ label: string; url: string }>;
  /** Future: Developer API docs / pricing (Module 6, Vector 3) */
  apiEnabled?: boolean;

  /** --- Admin (Module 9) --- */
  /** Hidden tools get 410 Gone; preserves SEO authority until re-enabled. */
  status: "live" | "hidden" | "coming-soon";
}

/** --- Expansion: new category = append here + add CategorySlug union --- */
export const CATEGORIES: CategoryInfo[] = [
  {
    slug: "all",
    name: "All Tools",
    icon: "🧰",
    description: "Every ToolForge utility in one place.",
    landingTagline: "Browse all free online tools",
  },
  {
    slug: "ai",
    name: "AI",
    icon: "✨",
    description: "First-class AI text tools: summarize, paraphrase, grammar.",
    landingTagline: "Free AI text tools — no watermarks, generous limits",
  },
  {
    slug: "pdf",
    name: "PDF",
    icon: "📄",
    description: "Compress, merge, unlock, convert PDFs — 3 free ops/day.",
    landingTagline: "Free PDF tools: compress, merge, unlock, convert",
  },
  {
    slug: "image",
    name: "Image",
    icon: "🖼️",
    description: "Compress, resize, convert images client-side (instant, private).",
    landingTagline: "Free image tools — runs in your browser, zero upload",
  },
  {
    slug: "converters",
    name: "Converters",
    icon: "🔀",
    description: "File & unit converters.",
    landingTagline: "Free converters: documents, images, units",
  },
  {
    slug: "calculators",
    name: "Calculators",
    icon: "🧮",
    description: "Financial, health, and developer calculators.",
    landingTagline: "Free calculators and developer utilities",
  },
  {
    slug: "security",
    name: "Security",
    icon: "🔐",
    description: "Privacy-first security tools — passwords, checksums, encryption.",
    landingTagline: "Free security tools — runs locally, nothing stored",
  },
];
