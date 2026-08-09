import type { MetadataRoute } from "next";
import {
  CATEGORIES,
  getAllSlugsForSitemap,
  getCategoryLandingSlugs,
} from "@/lib/tool-registry";

/**
 * Module 8: Sitemap (auto-generated from Tool Registry).
 *  - Home page
 *  - One entry per LIVE tool (/tools/[slug])
 *  - One entry per category landing (/category/[slug])
 *  - Static specials: /pricing, /blog
 *
 * Expansion (i18n): duplicate entries per locale with hreflang.
 * Expansion (blog): append entries from headless CMS (Sanity/Markdown) list.
 * ------------------------------------------------------------------------- */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://toolforge.example.com";

  const home: MetadataRoute.Sitemap = [
    {
      url: base,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
  ];

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${base}/pricing`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/blog`, changeFrequency: "weekly", priority: 0.7 },
  ];

  const tools: MetadataRoute.Sitemap = getAllSlugsForSitemap().map((slug) => ({
    url: `${base}/tools/${slug}`,
    lastModified: new Date(),
    changeFrequency: "monthly",
    priority: 0.9,
  }));

  const categories: MetadataRoute.Sitemap = getCategoryLandingSlugs().map((s) => ({
    url: `${base}/category/${s}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: 0.75,
  }));

  // Post-MVP: fetch blog posts from CMS and append here.
  // Expansion: hreflang alternates for i18n locales (CATEGORY copies).
  void CATEGORIES;

  return [...home, ...staticPages, ...tools, ...categories];
}
