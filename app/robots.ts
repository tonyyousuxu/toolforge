import type { MetadataRoute } from "next";

/**
 * Module 8: Robots.txt (SEO).
 * Allow all; point crawlers to sitemap.xml.
 * Post-MVP: Disallow /admin and /account paths via real auth middleware.
 * ------------------------------------------------------------------------- */
export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://toolforge.example.com";
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin/",
          "/account/",
          "/api/",
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
