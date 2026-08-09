/**
 * Module 8 — SEO / METADATA helpers.
 * ------------------------------------------------------------------
 * Central place to build:
 *  - OpenGraph + Twitter metadata per page
 *  - JSON-LD structured data (WebSite + ItemList + FAQPage + SoftwareApplication)
 *  - Canonical URLs for tools/categories
 *
 * Consumed by generateMetadata() in app/**page.tsx files.
 * ------------------------------------------------------------------ */
import type { Metadata } from "next";
import type { ToolDefinition, CategorySlug } from "@/lib/tool-registry/types";
import { CATEGORIES } from "@/lib/tool-registry";

const DEFAULT_SITE_URL = "https://toolforge.example.com";
const SITE_NAME = "ToolForge";
const DEFAULT_TITLE_TEMPLATE = "%s · ToolForge — 100+ Free Online Tools";

export function baseUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? DEFAULT_SITE_URL).replace(/\/$/, "");
}

export function buildBaseMetadata({
  title,
  description,
  path = "/",
  image,
  keywords,
}: {
  title: string;
  description: string;
  path?: string;
  image?: string;
  keywords?: string[];
}): Metadata {
  const url = `${baseUrl()}${path}`;
  const ogImage = image ?? `${baseUrl()}/og-default.png`;
  return {
    title,
    description,
    keywords,
    metadataBase: new URL(baseUrl()),
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      url,
      siteName: SITE_NAME,
      title: `${title}`,
      description,
      images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  };
}

export function titleTemplate() {
  return DEFAULT_TITLE_TEMPLATE;
}

/* -------- JSON-LD snippets (render in <script> tags on each page) -------- */

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: baseUrl(),
    potentialAction: {
      "@type": "SearchAction",
      target: `${baseUrl()}/?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
}

export function toolItemListJsonLd(tools: ToolDefinition[]) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: tools.map((t, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${baseUrl()}/tools/${t.slug}`,
      name: t.name,
      description: t.tagline,
    })),
  };
}

export function toolSoftwareApplicationJsonLd(tool: ToolDefinition) {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: tool.name,
    description: tool.tagline,
    applicationCategory: "UtilitiesApplication",
    operatingSystem: "Any",
    offer: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    url: `${baseUrl()}/tools/${tool.slug}`,
  };
}

export function faqPageJsonLd(faqs: { q: string; a: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };
}

export function categoryMeta(slug: Exclude<CategorySlug, "all">) {
  const c = CATEGORIES.find((x) => x.slug === slug);
  const name = c?.name ?? slug;
  const desc =
    c?.description ??
    `Free online ${name} tools: compress, convert, edit, summarize. No signup, browser-only, privacy first.`;
  return buildBaseMetadata({
    title: `${name} Tools — Free & Online`,
    description: desc,
    path: `/category/${slug}`,
    keywords: [`${name} tools`, `free online ${name}`, `${name} editor online`],
  });
}
