import type { Metadata } from "next";
import { notFound } from "next/navigation";

// Nothing to prefetch or show instantly: it only ever renders the not-found page.
export const instant = false;
export const metadata: Metadata = { title: "Page not found" };

/**
 * An admin URL that doesn't exist (an old bookmark, a typo): shows the admin's own not-found page,
 * inside the sidebar, rather than the site-wide one.
 */
export default function MissingAdminPage() {
  notFound();
}
