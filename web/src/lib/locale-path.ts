const SUPPORTED_LOCALES = ["en", "fr", "zh", "ar"] as const;

/**
 * Keeps shared navigation chrome locale-aware without coupling it to the
 * locale-only app tree. The shared header/footer also render on English-only
 * admin and legal routes, where next-intl's locale-aware Link cannot be used.
 */
export function localePath(href: string, locale: string): string {
  if (
    locale === "en" ||
    !SUPPORTED_LOCALES.includes(locale as (typeof SUPPORTED_LOCALES)[number]) ||
    !href.startsWith("/") ||
    href.startsWith("//")
  ) {
    return href;
  }

  const firstSegment = href.split(/[/?#]/).filter(Boolean)[0];
  if (SUPPORTED_LOCALES.includes(firstSegment as (typeof SUPPORTED_LOCALES)[number])) {
    return href;
  }

  return `/${locale}${href === "/" ? "" : href}`;
}

/** Removes a supported locale prefix so route matching works in every language. */
export function routeWithoutLocale(pathname: string): string {
  const match = pathname.match(/^\/(en|fr|zh|ar)(?=\/|$)/);
  if (!match) return pathname || "/";
  return pathname.slice(match[0].length) || "/";
}
