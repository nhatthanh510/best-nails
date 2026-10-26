import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

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
    <html lang="en" className={`${jakarta.variable} ${cormorant.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
