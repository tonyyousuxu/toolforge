import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { buildBaseMetadata } from "@/lib/seo";

export const metadata = buildBaseMetadata({
  title: "Privacy Policy — ToolForge",
  description:
    "ToolForge privacy policy: what data we collect, how processors handle your documents, your rights under GDPR and CCPA.",
  path: "/privacy",
});

export default function PrivacyPage() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <article className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
          <nav aria-label="Breadcrumb" className="mb-6 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Link href="/" className="hover:text-primary">All Tools</Link>
            <span>/</span>
            <span className="text-foreground/70">Privacy Policy</span>
          </nav>
          <h1 className="text-4xl font-extrabold tracking-tight">Privacy Policy</h1>
          <p className="mt-3 text-sm text-muted-foreground">Last updated — September 2025 · Slot (have legal review post-MVP)</p>

          <div className="prose prose-slate mt-10 max-w-none dark:prose-invert [&_h2]:text-xl [&_h2]:font-bold [&_h3]:mt-6 [&_h3]:font-semibold [&_h2]:mt-10 [&_p]:leading-7 [&_p]:text-foreground/80 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
            <h2>1. Summary (TL;DR)</h2>
            <p>
              ToolForge is built browser-first. If you do not sign up and do not click a Pro or
              Save-to-account action, your work on most free tools never leaves your device. Tools
              that require an LLM or server-side PDF processor use signed URLs and delete artifacts
              within the tool&apos;s stated TTL (default 7 days).
            </p>

            <h2>2. Data we collect</h2>
            <ul>
              <li>Anonymous usage events via analytics (PostHog) — no personal data.</li>
              <li>Account fields: email, name, OAuth provider id, plan tier.</li>
              <li>Signed-url uploads: files are deleted after result TTL.</li>
              <li>Cookies: session JWT (httpOnly, 30d), anonymous-UUID limit cookie (365d).</li>
            </ul>

            <h2>3. Sub-processors</h2>
            <ul>
              <li>Stripe — payments (PCI/DSS scope only; we never see card numbers).</li>
              <li>LLM providers — prompt-only, no training by default (see each tool&apos;s policy badge).</li>
              <li>Cloud storage — result artifacts, signed URLs, auto-expiry.</li>
            </ul>

            <h2>4. Your rights</h2>
            <p>
              Under GDPR/CCPA you may request export or erasure via <a className="text-primary" href="mailto:privacy@toolforge.example.com">privacy@toolforge.example.com</a>. Account delete in <Link href="/account" className="text-primary">My Account</Link> wipes immediately; analytics anonymize within 30 days.
            </p>

            <h2>5. Children</h2>
            <p>ToolForge is not directed to children under 13 and we do not knowingly collect data from them.</p>

            <h2>6. Changes</h2>
            <p>Material changes posted here 30 days in advance; logged-in users notified by email.</p>
          </div>
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
