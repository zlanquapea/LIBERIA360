"use client";

import { Link, usePathname } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import {
  UserGroupIcon,
  MapIcon,
  MapPinIcon,
  ChatBubbleLeftRightIcon,
} from "@heroicons/react/24/outline";

const sections = [
  { href: "/creators", key: "creators", icon: UserGroupIcon },
  { href: "/guides", key: "guides", icon: MapPinIcon },
  { href: "/trips", key: "trips", icon: MapIcon },
  { href: "/messages", key: "messages", icon: ChatBubbleLeftRightIcon },
];

export function FeatureNavigation() {
  const pathname = usePathname();
  const t = useTranslations("nav");
  return (
    <nav
      aria-label={t("siteSections")}
      className="mb-5 grid grid-cols-4 gap-1 rounded-2xl border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-900"
    >
      {sections.map(({ href, key, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-center text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${active ? "bg-brand-50 text-brand-800 dark:bg-brand-950 dark:text-brand-300" : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"}`}
          >
            <Icon aria-hidden className="h-5 w-5 shrink-0" />
            <span className="max-w-full break-words">{t(key)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
