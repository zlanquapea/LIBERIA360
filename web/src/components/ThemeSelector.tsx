"use client";

import {
  ComputerDesktopIcon,
  MoonIcon,
  SunIcon,
} from "@heroicons/react/24/outline";
import { useTranslations } from "next-intl";
import { useTheme } from "@/hooks/useTheme";
import type { Theme } from "@/lib/theme-storage";

const OPTIONS: Array<{
  value: Theme;
  labelKey: "themeLight" | "themeDark" | "themeSystem";
  descriptionKey:
    "themeLightDescription" | "themeDarkDescription" | "themeSystemDescription";
  Icon: typeof SunIcon;
}> = [
  {
    value: "light",
    labelKey: "themeLight",
    descriptionKey: "themeLightDescription",
    Icon: SunIcon,
  },
  {
    value: "dark",
    labelKey: "themeDark",
    descriptionKey: "themeDarkDescription",
    Icon: MoonIcon,
  },
  {
    value: "system",
    labelKey: "themeSystem",
    descriptionKey: "themeSystemDescription",
    Icon: ComputerDesktopIcon,
  },
];

export function ThemeSelector() {
  const t = useTranslations("common");
  const { theme, setTheme } = useTheme();

  return (
    <section
      aria-labelledby="theme-preference-heading"
      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="mb-3">
        <h2
          id="theme-preference-heading"
          className="text-sm font-semibold text-slate-900 dark:text-slate-50"
        >
          {t("themeAppearance")}
        </h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {t("themeDescription")}
        </p>
      </div>
      <div
        className="grid grid-cols-3 gap-2"
        role="radiogroup"
        aria-label={t("themePreference")}
      >
        {OPTIONS.map(({ value, labelKey, descriptionKey, Icon }) => {
          const selected = theme === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setTheme(value)}
              className={`flex min-h-20 flex-col items-center justify-center rounded-lg border px-2 py-2 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                selected
                  ? "border-brand-600 bg-brand-50 text-brand-800 ring-1 ring-brand-600 dark:border-brand-400 dark:bg-brand-950/40 dark:text-brand-200 dark:ring-brand-400"
                  : "border-slate-200 text-slate-600 hover:border-brand-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:border-brand-700 dark:hover:bg-slate-800"
              }`}
            >
              <Icon aria-hidden className="mb-1 h-5 w-5" />
              <span className="text-xs font-semibold">{t(labelKey)}</span>
              <span className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">
                {t(descriptionKey)}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
