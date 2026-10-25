import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Check in",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Best Nails", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#16110c",
  // Kiosk screens are laid out for a landscape iPad; stop pinch-zoom from breaking them.
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function KioskLayout({ children }: LayoutProps<"/kiosk">) {
  return <div className="flex min-h-dvh flex-1 touch-manipulation bg-kiosk-bg text-kiosk-ink select-none">{children}</div>;
}
