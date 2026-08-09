import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { buildBaseMetadata } from "@/lib/seo";

export const metadata = buildBaseMetadata({
  title: "Contact — ToolForge",
  description: "Get in touch with ToolForge support, partnerships, and press.",
  path: "/contact",
});

export default function ContactPage() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <section className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
          <nav aria-label="Breadcrumb" className="mb-6 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Link href="/" className="hover:text-primary">All Tools</Link>
            <span>/</span>
            <span className="text-foreground/70">Contact</span>
          </nav>
          <h1 className="text-4xl font-extrabold tracking-tight">Contact us</h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Post-MVP: a secure form + anti-bot captcha backs each of these addresses. For now, direct inboxes.
          </p>
          <ul className="mt-10 divide-y divide-border rounded-xl border border-border bg-card">
            <Row label="Support" email="support@toolforge.example.com" desc="Bug reports, broken tools, how-to help." />
            <Row label="Partnerships" email="partners@toolforge.example.com" desc="API / processor / co-branding inquiries." />
            <Row label="Press & media" email="press@toolforge.example.com" desc="Press kit, interviews, embargoed launches." />
          </ul>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

function Row({ label, email, desc }: { label: string; email: string; desc: string }) {
  return (
    <li className="flex flex-col gap-1 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="font-semibold">{label}</div>
        <div className="text-sm text-muted-foreground">{desc}</div>
      </div>
      <a className="font-mono text-sm text-primary hover:underline" href={`mailto:${email}`}>
        {email}
      </a>
    </li>
  );
}
