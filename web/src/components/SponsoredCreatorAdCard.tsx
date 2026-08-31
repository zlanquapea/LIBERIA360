"use client";

import Link from "next/link";
import {
  ArrowRightIcon,
  ChatBubbleLeftRightIcon,
  CheckCircleIcon,
  PhoneIcon,
} from "@heroicons/react/24/outline";
import type { Ad } from "@/lib/types";
import { resolveImageUrl } from "@/lib/images";
import { ContactLink } from "./ContactLink";
import { SafeImage } from "./SafeImage";

const CTA_CONFIG = {
  learn_more: { label: "Learn more", Icon: ArrowRightIcon },
  call: { label: "Call", Icon: PhoneIcon },
  message: { label: "Message", Icon: ChatBubbleLeftRightIcon },
  apply: { label: "Apply now", Icon: CheckCircleIcon },
} as const;

const CARD_CTA_CLASS =
  "inline-flex min-h-10 items-center gap-2 rounded-full bg-brand-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:bg-brand-500 dark:text-brand-950 dark:hover:bg-brand-400";

export function SponsoredCreatorAdCard({ ad }: { ad: Ad }) {
  const cta = CTA_CONFIG[ad.ctaType];
  const CtaIcon = cta.Icon;
  const image = ad.image ? resolveImageUrl(ad.image) : null;
  const isExternal = Boolean(ad.ctaUrl?.startsWith("http"));
  const ctaHref = ad.ctaUrl ?? `/ads/${ad.id}`;
  const advertiserInitial = (ad.advertiserName || "S")
    .slice(0, 1)
    .toUpperCase();

  const ctaContent = (
    <>
      {cta.label}
      <CtaIcon aria-hidden className="h-4 w-4" />
    </>
  );

  return (
    <article className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start gap-3 px-4 pt-4 sm:px-5">
        <Link
          href={`/ads/${ad.id}`}
          className="shrink-0"
          aria-label={`View ${ad.advertiserName || ad.title}`}
        >
          {image ? (
            <SafeImage
              src={image}
              alt=""
              className="h-12 w-12 rounded-full object-cover ring-2 ring-brand-100 dark:ring-brand-950"
              fallback={
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-lg font-bold text-brand-800 dark:bg-brand-950 dark:text-brand-200">
                  {advertiserInitial}
                </span>
              }
            />
          ) : (
            <span
              aria-hidden
              className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-lg font-bold text-brand-800 dark:bg-brand-950 dark:text-brand-200"
            >
              {advertiserInitial}
            </span>
          )}
        </Link>
        <div className="min-w-0 flex-1">
          <Link
            href={`/ads/${ad.id}`}
            className="block truncate font-display text-sm font-bold text-slate-950 hover:text-brand-700 dark:text-white dark:hover:text-brand-300 sm:text-base"
          >
            {ad.advertiserName || ad.title}
          </Link>
          <div className="mt-0.5 inline-flex items-center rounded-full bg-brand-50 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-brand-800 dark:bg-brand-950/60 dark:text-brand-200">
            {ad.sponsorLabel}
          </div>
        </div>
      </div>

      <div className="px-4 pb-3 pt-3 sm:px-5">
        <Link
          href={`/ads/${ad.id}`}
          className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
        >
          <h3 className="font-display text-lg font-bold leading-tight text-slate-950 dark:text-white">
            {ad.title}
          </h3>
          <p className="mt-1 line-clamp-2 text-sm leading-5 text-slate-600 dark:text-slate-300">
            {ad.description}
          </p>
        </Link>
      </div>

      {image && (
        <Link
          href={`/ads/${ad.id}`}
          className="block aspect-[16/9] overflow-hidden bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500 dark:bg-slate-800"
          aria-label={`View ${ad.title}`}
        >
          <SafeImage
            src={image}
            alt=""
            className="h-full w-full object-cover"
            fallback={
              <div
                aria-hidden
                className="h-full w-full bg-gradient-to-br from-brand-900 via-brand-800 to-slate-900"
              />
            }
          />
        </Link>
      )}

      <div className="flex items-center px-4 pb-4 pt-3 sm:px-5">
        {ad.ctaType === "call" || ad.ctaType === "message" ? (
          <ContactLink
            advertisementId={ad.id}
            href={ctaHref}
            className={CARD_CTA_CLASS}
          >
            {ctaContent}
          </ContactLink>
        ) : isExternal ? (
          <a
            href={ctaHref}
            target="_blank"
            rel="noopener noreferrer"
            className={CARD_CTA_CLASS}
          >
            {ctaContent}
          </a>
        ) : (
          <Link href={ctaHref} className={CARD_CTA_CLASS}>
            {ctaContent}
          </Link>
        )}
      </div>
    </article>
  );
}
