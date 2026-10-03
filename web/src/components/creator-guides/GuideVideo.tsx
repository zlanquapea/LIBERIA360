'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { PlayIcon } from '@heroicons/react/24/solid';
import { guideVideoSource } from '@/lib/guide-video';
import { resolveImageUrl } from '@/lib/images';

// Nothing from the video host loads until the visitor presses play: no
// autoplay, no third-party requests, no data used on a slow connection.
export function GuideVideo({ url, title, poster }: { url: string; title: string; poster: string | null }) {
  const t = useTranslations('creatorGuides');
  const [playing, setPlaying] = useState(false);
  const source = guideVideoSource(url);
  if (!source) return null;

  if (playing) {
    return source.kind === 'embed' ? (
      <iframe
        src={source.src}
        title={t('videoTitle', { title })}
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
        className="aspect-video w-full rounded-2xl bg-black"
      />
    ) : (
      <video src={source.src} controls autoPlay playsInline className="aspect-video w-full rounded-2xl bg-black" />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setPlaying(true)}
      className="group relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-2xl bg-brand-950 text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sunset-300"
    >
      {poster && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={resolveImageUrl(poster)} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-60" />
      )}
      <span className="relative flex flex-col items-center gap-2">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-sunset-600 shadow-lg transition-transform group-hover:scale-105 motion-reduce:transition-none">
          <PlayIcon aria-hidden className="h-8 w-8 ps-1" />
        </span>
        <span className="text-sm font-semibold">{t('playVideo')}</span>
        <span className="text-xs text-white/75">{t('videoLoadsOnPlay')}</span>
      </span>
    </button>
  );
}
