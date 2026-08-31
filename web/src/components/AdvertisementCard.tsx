"use client";

import Link from "next/link";
import {
  ArrowRightIcon,
  ChatBubbleLeftRightIcon,
  CheckCircleIcon,
  PhoneIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { resolveImageUrl } from "@/lib/images";
import { ContactLink } from "./ContactLink";
import { SafeImage } from "./SafeImage";
import type { Ad } from "@/lib/types";

const CTA_CONFIG = {
  learn_more: { label: "Learn more", Icon: ArrowRightIcon },
  call: { label: "Call", Icon: PhoneIcon },
  message: { label: "Message", Icon: ChatBubbleLeftRightIcon },
  apply: { label: "Apply now", Icon: CheckCircleIcon },
} as const;

export function AdvertisementCard({
  ad,
  onDismiss,
  cardRef,
}: {
  ad: Ad;
  onDismiss: () => void;
  cardRef?: (element: HTMLDivElement | null) => void;
}) {
  const cta = CTA_CONFIG[ad.ctaType];
  const CtaIcon = cta.Icon;
  const image = ad.image ? resolveImageUrl(ad.image) : null;
  const isExternal = Boolean(ad.ctaUrl?.startsWith("http"));
  const ctaHref = ad.ctaUrl ?? `/ads/${ad.id}`;

  return (
    <article
      ref={cardRef}
      className="group flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card transition-shadow duration-300 hover:shadow-card-hover dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <span className="inline-flex w-fit items-center rounded-full bg-brand-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-brand-800 dark:bg-brand-950/60 dark:text-brand-200">
          {ad.sponsorLabel}
        </span>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss this ad"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-100"
        >
          <XMarkIcon aria-hidden className="h-4 w-4" />
        </button>
      </div>

      <Link
        href={`/ads/${ad.id}`}
        className="relative block aspect-[16/9] overflow-hidden bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500 dark:bg-slate-800"
        aria-label={`View ${ad.title}`}
      >
        <SafeImage
          src={image}
          alt=""
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
          fallback={
            <div
              aria-hidden
              className="h-full w-full bg-gradient-to-br from-brand-900 via-brand-800 to-slate-900"
            />
          }
        />
      </Link>

      <div className="flex flex-1 flex-col gap-2 p-4">
        {ad.advertiserName && (
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {ad.advertiserName}
          </p>
        )}
        <h3 className="font-display text-lg font-bold leading-tight text-slate-950 dark:text-white">
          {ad.title}
        </h3>
        <p className="line-clamp-2 text-sm leading-5 text-slate-600 dark:text-slate-300">
          {ad.description}
        </p>
        {ad.ctaType === "call" || ad.ctaType === "message" ? (
          <ContactLink
            advertisementId={ad.id}
            href={ctaHref}
            className="mt-auto inline-flex min-h-10 w-fit items-center gap-2 rounded-full bg-brand-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:bg-brand-500 dark:text-brand-950 dark:hover:bg-brand-400"
          >
            {cta.label}
            <CtaIcon aria-hidden className="h-4 w-4" />
          </ContactLink>
        ) : isExternal ? (
          <a
            href={ctaHref}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-auto inline-flex min-h-10 w-fit items-center gap-2 rounded-full bg-brand-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:bg-brand-500 dark:text-brand-950 dark:hover:bg-brand-400"
          >
            {cta.label}
            <CtaIcon aria-hidden className="h-4 w-4" />
          </a>
        ) : (
          <Link
            href={ctaHref}
            className="mt-auto inline-flex min-h-10 w-fit items-center gap-2 rounded-full bg-brand-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:bg-brand-500 dark:text-brand-950 dark:hover:bg-brand-400"
          >
            {cta.label}
            <CtaIcon aria-hidden className="h-4 w-4" />
          </Link>
        )}
      </div>
    </article>
  );
}
