import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ChatBubbleLeftRightIcon,
  ChevronLeftIcon,
  EnvelopeIcon,
  GlobeAltIcon,
  MegaphoneIcon,
  PhoneIcon,
} from '@heroicons/react/24/outline';
import { ApiError, getActiveAdvertisement } from '@/lib/api';
import { formatAdvertisementType } from '@/lib/format';
import { resolveImageUrl } from '@/lib/images';
import { whatsappLink } from '@/lib/contact';
import { ContactLink } from '@/components/ContactLink';
import { SafeImage } from '@/components/SafeImage';
import { AdvertisementViewTracker } from '@/components/AdvertisementViewTracker';

// The carousel's "See more" destination — full, untruncated ad contents
// (every photo, the complete description, every contact method), unlike
// the compact card. Public and approved-only (see
// AdvertisementsService.findActiveOne): a dismissed/pending/rejected/
// suspended ad 404s here just like it's absent from the carousel itself.
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ad = await getActiveAdvertisement(id).catch(() => null);
  if (!ad) {
    return { title: 'Advertisement — LIBERIA360' };
  }
  const description = ad.description.length > 160 ? `${ad.description.slice(0, 157)}…` : ad.description;
  return {
    title: `${ad.title} — LIBERIA360`,
    description: description || undefined,
  };
}

export default async function AdvertisementDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const ad = await getActiveAdvertisement(id).catch((error) => {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  });
  if (!ad) {
    notFound();
  }

  const images = ad.images.map(resolveImageUrl);
  const cover = images[0] ?? null;

  const primaryClass =
    'inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700';
  const secondaryClass =
    'inline-flex items-center gap-2 rounded-full border border-slate-300 dark:border-slate-700 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 transition-colors hover:border-brand-500 hover:bg-brand-50 dark:hover:bg-brand-950/30';

  return (
    <div className="flex flex-col gap-6 px-4 py-6">
      <AdvertisementViewTracker advertisementId={ad.id} />

      <Link
        href="/"
        className="flex w-fit items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
      >
        <ChevronLeftIcon aria-hidden className="h-4 w-4" />
        Back to Home
      </Link>

      <div className="flex aspect-video w-full items-center justify-center overflow-hidden rounded-2xl bg-slate-100 dark:bg-slate-800">
        <SafeImage
          src={cover}
          alt=""
          className="h-full w-full object-contain"
          fallback={<MegaphoneIcon aria-hidden className="h-16 w-16 text-slate-400 dark:text-slate-500" />}
        />
      </div>

      {images.length > 1 && (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4">
          {images.slice(1).map((src) => (
            <div
              key={src}
              className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800"
            >
              <SafeImage
                src={src}
                alt=""
                className="h-full w-full object-contain"
                fallback={<MegaphoneIcon aria-hidden className="h-6 w-6 text-slate-400 dark:text-slate-500" />}
              />
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <span className="w-fit rounded-full bg-slate-900/80 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-white dark:bg-slate-100/90 dark:text-slate-900">
          Sponsored
        </span>
        <h1 className="font-display text-2xl font-semibold text-slate-900 dark:text-slate-50">{ad.title}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">{formatAdvertisementType(ad.type)}</p>
        {ad.priceLabel && (
          <p className="text-lg font-semibold text-brand-700 dark:text-brand-300">{ad.priceLabel}</p>
        )}
        <p className="whitespace-pre-wrap text-slate-700 dark:text-slate-200">{ad.description}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {ad.contactWhatsapp && (
          <ContactLink
            advertisementId={ad.id}
            href={whatsappLink(ad.contactWhatsapp)}
            target="_blank"
            rel="noopener noreferrer"
            className={primaryClass}
          >
            <ChatBubbleLeftRightIcon aria-hidden className="h-4 w-4" />
            WhatsApp
          </ContactLink>
        )}
        {ad.contactPhone && (
          <ContactLink advertisementId={ad.id} href={`tel:${ad.contactPhone}`} className={secondaryClass}>
            <PhoneIcon aria-hidden className="h-4 w-4" />
            Call
          </ContactLink>
        )}
        {ad.contactEmail && (
          <ContactLink advertisementId={ad.id} href={`mailto:${ad.contactEmail}`} className={secondaryClass}>
            <EnvelopeIcon aria-hidden className="h-4 w-4" />
            Email
          </ContactLink>
        )}
        {ad.externalLink && (
          <ContactLink
            advertisementId={ad.id}
            href={ad.externalLink}
            target="_blank"
            rel="noopener noreferrer"
            className={secondaryClass}
          >
            <GlobeAltIcon aria-hidden className="h-4 w-4" />
            Learn more
          </ContactLink>
        )}
      </div>
    </div>
  );
}
