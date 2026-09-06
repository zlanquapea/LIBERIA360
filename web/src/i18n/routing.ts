import { defineRouting } from "next-intl/routing";

// The four locales this phase targets (I18N_PLAN.md): English (default,
// unprefixed URLs — see localePrefix below), French, Chinese (Simplified),
// and Arabic. Admin and the legal pages (Privacy/Terms) are deliberately
// NOT part of this routing config at all — they live outside the
// `[locale]` segment entirely (see src/app/(no-locale)) and stay
// English-only regardless of what's added here later.
export const routing = defineRouting({
  locales: ["en", "fr", "zh", "ar"],
  defaultLocale: "en",
  // "as-needed": the default locale (English) keeps today's unprefixed
  // URLs (/places/sapo-national-park) so no existing/indexed link breaks;
  // every other locale gets a prefix (/fr/places/..., /zh/..., /ar/...).
  localePrefix: "as-needed",
});

// Locales that read right-to-left — drives the <html dir> attribute in
// [locale]/layout.tsx. Arabic is the only one in this set today; French
// and Chinese are both LTR.
export const RTL_LOCALES: readonly string[] = ["ar"];
