import Link from "next/link";
import { CATEGORIES } from "@/lib/tool-registry";

/**
 * Module 1: Footer
 *  - Brand + tagline
 *  - Category quick links (auto-generated from CATEGORIES)
 *  - Legal (auto-generated links, pages stub: /privacy, /terms)
 *  - Ad slot (Module 8 / ads expansion — AdSense/Ezoic placeholder div)
 *
 * Expansion: append columns here (e.g. Blog, API, Developers) by adding
 * to the FOOTER_COLUMNS constant.
 * ---------------------------------------------------------------------- */
const FOOTER_COLUMNS: Array<{
  heading: string;
  links: Array<{ label: string; href: string; external?: boolean }>;
}> = [
  {
    heading: "Product",
    links: [
      { label: "All Tools", href: "/" },
      { label: "Pricing", href: "/pricing" },
      { label: "Blog", href: "/blog" },
      { label: "Developers (soon)", href: "#" },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Contact", href: "/contact" },
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border bg-muted/30">
      {/* AD SLOT — Module 8 / AdSense placeholder. Inject adsense script here when live. */}
      <div
        aria-label="advertisement slot"
        className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8"
      >
        <div className="h-16 w-full rounded-lg border border-dashed border-border/70 bg-muted/50 text-[11px] uppercase tracking-wider text-muted-foreground/60 flex items-center justify-center">
          Ad Slot (Ezoic/AdSense · 50K visits/mo threshold)
        </div>
      </div>

      <div className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-5">
          <div className="col-span-2">
            <Link href="/" className="flex items-center gap-2 font-bold text-lg">
              <span className="text-2xl">🛠️</span>
              <span>
                Tool<span className="text-primary">Forge</span>
              </span>
            </Link>
            <p className="mt-3 max-w-xs text-sm text-muted-foreground">
              Generous free online tools — AI, PDF, Image and more. 3 free operations
              per day, no watermarks, your files auto-expire.
            </p>
          </div>

          <div>
            <h4 className="text-sm font-semibold">Categories</h4>
            <ul className="mt-3 space-y-2 text-sm">
              {CATEGORIES.filter((c) => c.slug !== "all").map((c) => (
                <li key={c.slug}>
                  <Link
                    href={`/category/${c.slug}`}
                    className="inline-flex items-center gap-2 text-muted-foreground transition hover:text-foreground"
                  >
                    <span>{c.icon}</span>
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {FOOTER_COLUMNS.map((col) => (
            <div key={col.heading}>
              <h4 className="text-sm font-semibold">{col.heading}</h4>
              <ul className="mt-3 space-y-2 text-sm">
                {col.links.map((l) => (
                  <li key={l.label}>
                    {l.external ? (
                      <a
                        href={l.href}
                        target="_blank"
                        rel="noreferrer"
                        className="text-muted-foreground transition hover:text-foreground"
                      >
                        {l.label}
                      </a>
                    ) : (
                      <Link
                        href={l.href}
                        className="text-muted-foreground transition hover:text-foreground"
                      >
                        {l.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-3 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center">
          <p>© {new Date().getFullYear()} ToolForge. All rights reserved.</p>
          <p>
            Files auto-delete within 1–2 hours. No account required.
          </p>
        </div>
      </div>
    </footer>
  );
}
