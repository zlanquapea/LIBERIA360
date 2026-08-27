"use client";

import { useEffect, useState, type ComponentType } from "react";
import {
  ArrowUturnRightIcon,
  ArrowUpOnSquareIcon,
  ClipboardDocumentIcon,
  EnvelopeIcon,
} from "@heroicons/react/24/outline";
import {
  FacebookIcon,
  LinkedInIcon,
  TelegramIcon,
  WhatsAppIcon,
  XIcon,
} from "./icons/SocialIcons";

type ShareMenuProps = {
  placeName: string;
  shareUrl?: string;
  // "feed" matches a plain-text icon+label button (this platform's own
  // Like/Comment button recipe) — for a feed action row where "action"'s
  // filled sky-blue pill or "circle"'s solid brand button would stick out
  // next to two minimal-styled siblings.
  variant?: "circle" | "action" | "feed";
  contentType?: "place" | "creator" | "post" | "event";
  onShare?: () => void;
};

type ShareItem = {
  label: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  className: string;
};

export function ShareMenu({
  placeName,
  shareUrl,
  variant = "circle",
  contentType = "place",
  onShare,
}: ShareMenuProps) {
  const [open, setOpen] = useState(false);
  const contentNoun =
    contentType === "creator"
      ? "creator"
      : contentType === "post"
        ? "post"
        : contentType === "event"
          ? "event"
          : "place";
  const [currentUrl, setCurrentUrl] = useState(shareUrl ?? "");
  const [canNativeShare, setCanNativeShare] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!shareUrl) setCurrentUrl(window.location.href);
    setCanNativeShare(
      typeof navigator !== "undefined" && typeof navigator.share === "function",
    );
  }, [shareUrl]);

  const encodedUrl = encodeURIComponent(currentUrl);
  const encodedText = encodeURIComponent(
    `Check out ${placeName} on LIBERIA360`,
  );
  const encodedSubject = encodeURIComponent(`${placeName} — LIBERIA360`);

  const shareItems: ShareItem[] = [
    {
      label: "Facebook",
      href: `https://www.facebook.com/sharer.php?u=${encodedUrl}&quote=${encodedText}`,
      icon: FacebookIcon,
      className: "bg-[#1877F2] text-white hover:bg-[#166FE5]",
    },
    {
      label: "WhatsApp",
      href: `https://wa.me/?text=${encodedText}%20${encodedUrl}`,
      icon: WhatsAppIcon,
      className: "bg-[#25D366] text-white hover:bg-[#1ebe5d]",
    },
    {
      label: "X",
      href: `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`,
      icon: XIcon,
      className: "bg-slate-950 text-white hover:bg-slate-800",
    },
    {
      label: "Telegram",
      href: `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`,
      icon: TelegramIcon,
      className: "bg-[#229ED9] text-white hover:bg-[#1789bf]",
    },
    {
      label: "LinkedIn",
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
      icon: LinkedInIcon,
      className: "bg-[#0A66C2] text-white hover:bg-[#0959a9]",
    },
    {
      label: "Email",
      href: `mailto:?subject=${encodedSubject}&body=${encodedText}%0A%0A${encodedUrl}`,
      icon: EnvelopeIcon,
      className: "bg-brand-700 text-white hover:bg-brand-800",
    },
  ];

  async function copyLink() {
    if (!currentUrl) return;
    onShare?.();
    try {
      await navigator.clipboard.writeText(currentUrl);
      setStatus("Link copied");
    } catch {
      setStatus("Copy unavailable — select the page URL instead");
    }
    window.setTimeout(() => setStatus(null), 2200);
  }

  async function nativeShare() {
    if (!currentUrl || !navigator.share) return;
    try {
      await navigator.share({
        title: placeName,
        text: `Check out ${placeName} on LIBERIA360`,
        url: currentUrl,
      });
      onShare?.();
      setOpen(false);
    } catch {
      // Closing or cancelling the native sheet is not an error to show the user.
    }
  }

  const actionTrigger =
    variant === "action"
      ? "inline-flex min-h-14 min-w-0 w-full items-center justify-center gap-1.5 rounded-2xl bg-sky-400 px-2 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-sky-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
      : variant === "feed"
        ? "flex min-h-11 min-w-0 w-full items-center justify-center gap-1.5 rounded-xl px-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
        : "flex h-12 w-12 min-w-0 items-center justify-center rounded-full bg-brand-700 text-white shadow-sm transition-colors hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400";

  return (
    <div className="relative h-full">
      <button
        type="button"
        aria-label={`Share ${placeName}`}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
        className={actionTrigger}
      >
        <ArrowUturnRightIcon
          aria-hidden
          className={variant === "circle" ? "h-6 w-6" : "h-5 w-5"}
        />
        {(variant === "action" || variant === "feed") && "Share"}
      </button>

      {open && (
        <div
          role="menu"
          aria-label={`Share ${placeName}`}
          className="fixed inset-x-4 bottom-24 z-[100] w-auto max-w-md rounded-2xl border border-slate-200 bg-white p-3 text-slate-900 shadow-2xl sm:absolute sm:inset-x-auto sm:right-0 sm:bottom-auto sm:top-[4.5rem] sm:w-72 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
        >
          <div className="flex items-center justify-between gap-3 px-1 pb-3">
            <div>
              <p className="font-display text-sm font-bold">
                Share this {contentNoun}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Send it to friends or save the link.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close share menu"
              className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              <span aria-hidden className="text-lg leading-none">
                ×
              </span>
            </button>
          </div>

          <div
            className="grid grid-cols-3 gap-2"
            role="group"
            aria-label="Social sharing options"
          >
            {shareItems.map(({ label, href, icon: Icon, className }) => (
              <a
                key={label}
                href={href}
                target={label === "Email" ? undefined : "_blank"}
                rel={label === "Email" ? undefined : "noopener noreferrer"}
                role="menuitem"
                onClick={() => {
                  onShare?.();
                  setOpen(false);
                }}
                className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-slate-100 bg-slate-50 px-2 py-3 text-center transition-colors hover:border-transparent hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700"
              >
                <span
                  className={`flex h-11 w-11 items-center justify-center rounded-full ${className}`}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <span className="text-[11px] font-medium leading-none text-slate-600 dark:text-slate-300">
                  {label}
                </span>
              </a>
            ))}
            <button
              type="button"
              role="menuitem"
              onClick={copyLink}
              className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-slate-100 bg-slate-50 px-2 py-3 text-center transition-colors hover:border-brand-200 hover:bg-brand-50 dark:border-slate-800 dark:bg-slate-800 dark:hover:bg-brand-950/30"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                <ClipboardDocumentIcon aria-hidden className="h-5 w-5" />
              </span>
              <span className="text-[11px] font-medium leading-none text-slate-600 dark:text-slate-300">
                Copy link
              </span>
            </button>
            {canNativeShare && (
              <button
                type="button"
                role="menuitem"
                onClick={nativeShare}
                className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-slate-100 bg-slate-50 px-2 py-3 text-center transition-colors hover:border-brand-200 hover:bg-brand-50 dark:border-slate-800 dark:bg-slate-800 dark:hover:bg-brand-950/30"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gold-400 text-brand-950">
                  <ArrowUpOnSquareIcon aria-hidden className="h-5 w-5" />
                </span>
                <span className="text-[11px] font-medium leading-none text-slate-600 dark:text-slate-300">
                  More apps
                </span>
              </button>
            )}
          </div>

          {status && (
            <p
              role="status"
              className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
            >
              {status}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
