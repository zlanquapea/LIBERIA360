import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

// Locale-aware drop-in replacements for next/link and next/navigation.
// Every internal `<Link>`, `useRouter()`, `usePathname()`, and `redirect()`
// call in the tourist-facing tree (src/app/[locale]/**) must import from
// here instead of "next/link" / "next/navigation" — otherwise the active
// locale prefix silently drops on client-side navigation (a French visitor
// clicking a link would land back on the English "/" version of that page).
// src/app/(no-locale)/** (admin, legal pages) intentionally keeps using
// plain next/link and next/navigation — those routes have no locale to
// preserve.
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
