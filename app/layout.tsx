import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { RESTORE_SIDEBAR } from "@/lib/sidebar";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
});

// Headings (h1 and the wordmark): an elegant serif to match the logo's fine line art.
const cormorant = Cormorant_Garamond({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  // Share previews need absolute URLs. Without NEXT_PUBLIC_SITE_URL, Next falls back to the
  // Vercel production URL (or localhost in dev).
  ...(process.env.NEXT_PUBLIC_SITE_URL && { metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL) }),
  title: { default: "Best Nails Rewards", template: "%s · Best Nails" },
  description: "Loyalty check-in and rewards for Best Nails.",
  // The preview image itself is app/opengraph-image.tsx.
  openGraph: {
    type: "website",
    siteName: "Best Nails",
    title: "Best Nails Rewards",
    description: "Loyalty check-in and rewards for Best Nails.",
    locale: "en_AU",
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: "#faf7f1",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: the admin sets data-nav-collapsed on <html> before React hydrates.
    <html lang="en" className={`${jakarta.variable} ${cormorant.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        {/* Runs as the first page is read, before the admin sidebar paints: puts it back collapsed
            if it was. Here, not in the admin layout: React never runs a <script> it renders in the
            browser, which is what happens to the admin layout when you get there by a link (e.g. the
            kiosk's Admin button). The root layout is always in the first HTML. */}
        <script dangerouslySetInnerHTML={{ __html: RESTORE_SIDEBAR }} />
      </head>
      <body className="min-h-full flex flex-col">
        {children}
      </body>
    </html>
  );
}
