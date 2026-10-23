export function BrandMark({ className = "size-10", strokeWidth = 2 }: { className?: string; strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 44 44" fill="none" aria-hidden="true" className={className}>
      <rect x="1" y="1" width="42" height="42" rx="14" stroke="currentColor" strokeWidth={strokeWidth} />
      <path d="M22 10c-4 5-6 9-6 13a6 6 0 0 0 12 0c0-4-2-8-6-13Z" stroke="currentColor" strokeWidth={strokeWidth} strokeLinejoin="round" />
      <path d="M19 31h6" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" />
    </svg>
  );
}

export function KioskBrand() {
  return (
    <div className="flex items-center gap-3.5">
      <BrandMark className="size-10 text-kiosk-accent" />
      <span className="text-2xl font-extrabold tracking-tight">Best Nails</span>
    </div>
  );
}
