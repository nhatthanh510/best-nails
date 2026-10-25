import Image from "next/image";
import logo from "@/public/brand/logo-mark.png";
import { cn } from "@/lib/utils";

/**
 * The Best Nails logo: the gold butterfly, hand and profile in its round frame. The source is
 * square with the ring touching the edges, so it's shown as a circle. Size it with `className`
 * (e.g. size-10) and tell `sizes` roughly how many pixels wide it renders.
 */
export function BrandMark({ className = "size-10", sizes = "48px" }: { className?: string; sizes?: string }) {
  return (
    <Image
      src={logo}
      alt=""
      aria-hidden="true"
      sizes={sizes}
      // Always at the top of the screen it's on.
      loading="eager"
      className={cn("flex-none rounded-full object-cover", className)}
    />
  );
}

/** Logo and name for the kiosk's dark screens. */
export function KioskBrand({ size = "md" }: { size?: "md" | "lg" }) {
  return (
    <div className={cn("flex items-center", size === "lg" ? "flex-col gap-5" : "gap-4")}>
      <BrandMark
        className={size === "lg" ? "size-36 ring-4 ring-gold/30" : "size-14"}
        sizes={size === "lg" ? "144px" : "56px"}
      />
      <span className={cn("font-heading font-bold tracking-wide", size === "lg" ? "text-5xl" : "text-[32px]")}>Best Nails</span>
    </div>
  );
}
