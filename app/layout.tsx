import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://toolforge.example.com"),
  title: {
    default: "ToolForge — Free Online Tools (PDF, AI, Image, Calculators)",
    template: "%s | ToolForge",
  },
  description:
    "ToolForge is a generous free online tools hub. Compress PDF, summarize text, compress images, and more. 3 free operations per day, no credit card.",
  keywords: [
    "compress PDF",
    "PDF tools",
    "text summarizer",
    "grammar checker",
    "paraphraser",
    "image compressor",
    "free online tools",
    "AI tools",
  ],
  authors: [{ name: "ToolForge" }],
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://toolforge.example.com",
    siteName: "ToolForge",
    title: "ToolForge — Free Online Tools (PDF, AI, Image)",
    description:
      "Generous free online tools hub. 3 ops/day, no watermarks, files auto-delete.",
  },
  twitter: {
    card: "summary_large_image",
    title: "ToolForge — Free Online Tools",
    description: "Generous free online tools for PDF, AI, image and more.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "white" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased">
        <div className="relative flex min-h-screen flex-col">{children}</div>
      </body>
    </html>
  );
}
