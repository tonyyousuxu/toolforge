import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { buildBaseMetadata } from "@/lib/seo";

export const metadata = buildBaseMetadata({
  title: "Terms of Service — ToolForge",
  description:
    "ToolForge Terms: acceptable use, Pro subscription terms, refund policy, disclaimers, limitation of liability.",
  path: "/terms",
});

export default function TermsPage() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <article className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
          <nav aria-label="Breadcrumb" className="mb-6 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Link href="/" className="hover:text-primary">All Tools</Link>
            <span>/</span>
            <span className="text-foreground/70">Terms of Service</span>
          </nav>
          <h1 className="text-4xl font-extrabold tracking-tight">Terms of Service</h1>
          <p className="mt-3 text-sm text-muted-foreground">Last updated — September 2025 · Slot (have legal review post-MVP)</p>

          <div className="prose prose-slate mt-10 max-w-none dark:prose-invert [&_h2]:text-xl [&_h2]:font-bold [&_h3]:mt-6 [&_h3]:font-semibold [&_h2]:mt-10 [&_p]:leading-7 [&_p]:text-foreground/80 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-5">
            <h2>1. Parties &amp; acceptance</h2>
            <p>
              These terms are a contract between you and ToolForge. By using the site you accept
              them. If you do not, stop using ToolForge.
            </p>

            <h2>2. Services &amp; acceptable use</h2>
            <ul>
              <li>You will not use ToolForge to process infringing, unlawful, or harmful content.</li>
              <li>You will not reverse-engineer or resell the processors, wrappers, or UI components.</li>
              <li>Fair-use: automated scraping of results or APIs is not permitted without a written enterprise agreement.</li>
            </ul>

            <h2>3. Pro subscription, billing &amp; refunds</h2>
            <ul>
              <li>Pro is billed monthly in advance via Stripe; see <Link href="/pricing" className="text-primary">/pricing</Link> for inclusions.</li>
              <li>Card failures enter a 24-hour grace window; the account is then downgraded to Free.</li>
              <li>Full refund within 14 days of first purchase on request if unused (≤ 3 ops). No partial-month refunds.</li>
            </ul>

            <h2>4. Intellectual property</h2>
            <p>
              You keep ownership of content you upload or generate. You grant ToolForge only the
              limited, revocable right to host and display it for the purpose of rendering the
              result during the result TTL window.
            </p>

            <h2>5. Disclaimers</h2>
            <p>
              TOOLS ARE PROVIDED “AS IS” WITHOUT WARRANTY OF ANY KIND. LLM OUTPUTS ARE GENERATIVE
              AND MAY BE INCORRECT — ALWAYS REVIEW LEGAL, FINANCIAL, OR MEDICAL TEXT.
            </p>

            <h2>6. Limitation of liability</h2>
            <p>
              TO THE FULLEST EXTENT PERMITTED, TOOLFORGE&apos;S AGGREGATE LIABILITY FOR ANY CLAIM IS
              LIMITED TO THE AMOUNT YOU PAID IN THE PAST 12 MONTHS.
            </p>

            <h2>7. Termination / account deletion</h2>
            <p>
              Either party may terminate at any time. You can self-serve wipe from <Link href="/account" className="text-primary">My Account</Link>.
            </p>

            <h2>8. Governing law</h2>
            <p>Delaware, USA. Disputes first via good-faith negotiation; then arbitration or courts of competent jurisdiction.</p>
          </div>
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
