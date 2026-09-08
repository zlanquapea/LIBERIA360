"use client";

import { useTransition } from "react";
import { useLocale } from "next-intl";
import { GlobeAltIcon } from "@heroicons/react/24/outline";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

// Each language's own name, in its own script — a language switcher shows
// "Français"/"中文"/"العربية" regardless of the currently active locale
// (that's how every major site does this; translating the entry for
// French into English defeats the point of the control).
const LOCALE_LABELS: Record<string, string> = {
  en: "English",
  fr: "Français",
  zh: "中文",
  ar: "العربية",
};

// Phase 1 (I18N_PLAN.md): infra only, no shell-chrome translation yet — so
// this renders as a standalone control rather than being woven into
// Header's nav (that wiring belongs to Phase 2, once Header itself is
// being touched for translation anyway). It's only ever rendered from
// src/app/[locale]/layout.tsx, never from the (no-locale) tree — admin and
// the legal pages have no locale to switch.
type LanguageSwitcherProps = {
  variant?: "floating" | "menu";
};

export function LanguageSwitcher({ variant = "floating" }: LanguageSwitcherProps) {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const nextLocale = event.target.value;
    startTransition(() => {
      // usePathname() from @/i18n/navigation already strips the current
      // locale prefix, so this re-resolves the same page under the new
      // locale instead of stacking prefixes (e.g. never /fr/en/places/...).
      router.replace(pathname, { locale: nextLocale });
    });
  }

  const menuVariant = variant === "menu";

  return (
    <label
      className={
        menuVariant
          ? "flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
          : "inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
      }
    >
      <GlobeAltIcon aria-hidden className="h-4 w-4 shrink-0" />
      <span className="sr-only">Choose a language</span>
      <select
        value={locale}
        onChange={handleChange}
        disabled={isPending}
        aria-label="Choose a language"
        className="min-w-0 flex-1 bg-transparent outline-none disabled:opacity-60"
      >
        {routing.locales.map((code) => (
          <option key={code} value={code}>
            {LOCALE_LABELS[code] ?? code}
          </option>
        ))}
      </select>
    </label>
  );
}
