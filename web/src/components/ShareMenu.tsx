'use client';

import { useEffect, useState, type ComponentType } from 'react';
import { ArrowUpOnSquareIcon, ClipboardDocumentIcon, EnvelopeIcon, ShareIcon } from '@heroicons/react/24/outline';
import { FacebookIcon, LinkedInIcon, TelegramIcon, WhatsAppIcon, XIcon } from './icons/SocialIcons';

type ShareMenuProps = {
  placeName: string;
  shareUrl?: string;
  variant?: 'circle' | 'action';
  contentType?: 'place' | 'creator';
};

type ShareItem = {
  label: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  className: string;
};

export function ShareMenu({ placeName, shareUrl, variant = 'circle', contentType = 'place' }: ShareMenuProps) {
  const [open, setOpen] = useState(false);
  const contentNoun = contentType === 'creator' ? 'creator' : 'place';
  const [currentUrl, setCurrentUrl] = useState(shareUrl ?? '');
  const [canNativeShare, setCanNativeShare] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!shareUrl) setCurrentUrl(window.location.href);
    setCanNativeShare(typeof navigator !== 'undefined' && typeof navigator.share === 'function');
  }, [shareUrl]);

  const encodedUrl = encodeURIComponent(currentUrl);
  const encodedText = encodeURIComponent(`Check out ${placeName} on LIBERIA360`);
  const encodedSubject = encodeURIComponent(`${placeName} — LIBERIA360`);

  const shareItems: ShareItem[] = [
    {
      label: 'Facebook',
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      icon: FacebookIcon,
      className: 'bg-[#1877F2] text-white hover:bg-[#166FE5]',
    },
    {
      label: 'WhatsApp',
      href: `https://wa.me/?text=${encodedText}%20${encodedUrl}`,
      icon: WhatsAppIcon,
      className: 'bg-[#25D366] text-white hover:bg-[#1ebe5d]',
    },
    {
      label: 'X',
      href: `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`,
      icon: XIcon,
      className: 'bg-slate-950 text-white hover:bg-slate-800',
    },
    {
      label: 'Telegram',
      href: `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`,
      icon: TelegramIcon,
      className: 'bg-[#229ED9] text-white hover:bg-[#1789bf]',
    },
    {
      label: 'LinkedIn',
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
      icon: LinkedInIcon,
      className: 'bg-[#0A66C2] text-white hover:bg-[#0959a9]',
    },
    {
      label: 'Email',
      href: `mailto:?subject=${encodedSubject}&body=${encodedText}%0A%0A${encodedUrl}`,
      icon: EnvelopeIcon,
      className: 'bg-brand-700 text-white hover:bg-brand-800',
    },
  ];

  async function copyLink() {
    if (!currentUrl) return;
    try {
      await navigator.clipboard.writeText(currentUrl);
      setStatus('Link copied');
    } catch {
      setStatus('Copy unavailable — select the page URL instead');
    }
    window.setTimeout(() => setStatus(null), 2200);
  }

  async function nativeShare() {
    if (!currentUrl || !navigator.share) return;
    try {
      await navigator.share({ title: placeName, text: `Check out ${placeName} on LIBERIA360`, url: currentUrl });
      setOpen(false);
    } catch {
      // Closing or cancelling the native sheet is not an error to show the user.
    }
  }

  const actionTrigger =
    variant === 'action'
      ? 'inline-flex min-h-16 w-full items-center justify-center gap-2 rounded-2xl bg-sky-400 px-3 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-sky-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400'
      : 'flex h-12 w-12 items-center justify-center rounded-full bg-brand-700 text-white shadow-sm transition-colors hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400';

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
        <ShareIcon aria-hidden className={variant === 'action' ? 'h-5 w-5' : 'h-6 w-6'} />
        {variant === 'action' && 'Share'}
      </button>

      {open && (
        <div
          role="menu"
          aria-label={`Share ${placeName}`}
          className="absolute right-0 top-[4.5rem] z-50 w-72 rounded-2xl border border-slate-200 bg-white p-3 text-slate-900 shadow-2xl dark:border-slate-700 dark:bg-slate-900 dark:text-white"
        >
          <div className="flex items-center justify-between gap-3 px-1 pb-3">
            <div>
              <p className="font-display text-sm font-bold">Share this {contentNoun}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Send it to friends or save the link.</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close share menu"
              className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              <span aria-hidden className="text-lg leading-none">×</span>
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2" role="group" aria-label="Social sharing options">
            {shareItems.map(({ label, href, icon: Icon, className }) => (
              <a
                key={label}
                href={href}
                target={label === 'Email' ? undefined : '_blank'}
                rel={label === 'Email' ? undefined : 'noopener noreferrer'}
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-slate-100 bg-slate-50 px-2 py-3 text-center transition-colors hover:border-transparent hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700"
              >
                <span className={`flex h-11 w-11 items-center justify-center rounded-full ${className}`}>
                  <Icon className="h-5 w-5" />
                </span>
                <span className="text-[11px] font-medium leading-none text-slate-600 dark:text-slate-300">{label}</span>
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
              <span className="text-[11px] font-medium leading-none text-slate-600 dark:text-slate-300">Copy link</span>
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
                <span className="text-[11px] font-medium leading-none text-slate-600 dark:text-slate-300">More apps</span>
              </button>
            )}
          </div>

          {status && <p role="status" className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">{status}</p>}
        </div>
      )}
    </div>
  );
}
