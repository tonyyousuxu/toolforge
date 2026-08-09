import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <section className="mx-auto flex min-h-[60vh] w-full max-w-3xl flex-col items-center justify-center px-4 py-16 text-center sm:px-6 lg:px-8">
          <div className="grid h-20 w-20 place-items-center rounded-full bg-primary/10 text-5xl">
            🔭
          </div>
          <h1 className="mt-6 text-4xl font-extrabold tracking-tight sm:text-5xl">
            404 — Nothing here
          </h1>
          <p className="mt-4 max-w-lg text-muted-foreground sm:text-lg">
            The tool or page you&apos;re looking for doesn&apos;t exist, may have been moved, or is hidden for admins.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/"
              className="inline-flex h-11 items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90"
            >
              ← Browse all tools
            </Link>
            <Link
              href="/pricing"
              className="inline-flex h-11 items-center justify-center rounded-lg border border-input bg-background px-5 text-sm font-semibold shadow-sm transition hover:bg-muted"
            >
              View pricing
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
