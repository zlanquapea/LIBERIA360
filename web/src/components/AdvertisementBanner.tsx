'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeftIcon, ChevronRightIcon, MegaphoneIcon } from '@heroicons/react/24/outline';
import { AdvertisementCard } from './AdvertisementCard';
import type { Advertisement } from '@/lib/types';

const GAP = 12;

/** A drag/swipe carousel on mobile and a space-filling grid from `sm` up. */
export function AdvertisementBanner({ ads }: { ads: Advertisement[] }) {
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const [width, setWidth] = useState(0);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const start = useRef({ x: 0, y: 0 });
  const moved = useRef(false);
  const visible = useMemo(() => ads.filter((ad) => !dismissed.includes(ad.id)), [ads, dismissed]);

  useEffect(() => {
    const node = viewportRef.current;
    if (!node) return;
    if (typeof ResizeObserver === 'undefined') {
      setWidth(node.getBoundingClientRect().width);
      return;
    }
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => setIndex((current) => Math.min(current, Math.max(visible.length - 1, 0))), [visible.length]);
  if (visible.length === 0) return null;

  const cardWidth = width ? Math.min(width * 0.9, width - 28) : 0;
  const step = cardWidth + GAP;
  const go = (next: number) => setIndex(Math.max(0, Math.min(next, visible.length - 1)));

  return (
    <section aria-labelledby="sponsored-heading" aria-label="Sponsored advertisements" className="flex min-w-0 flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 id="sponsored-heading" className="flex items-center gap-1.5 font-display text-lg font-semibold text-slate-900 dark:text-slate-50">
          <MegaphoneIcon aria-hidden className="h-5 w-5 text-slate-500 dark:text-slate-400" /> Sponsored
        </h2>
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Advertisements</p>
      </div>

      <div className="lg:hidden">
        <div
          ref={viewportRef}
          data-testid="sponsored-mobile-slider"
          className="overflow-hidden touch-pan-y"
          onPointerDown={(event) => {
            start.current = { x: event.clientX, y: event.clientY };
            moved.current = false;
            setDragging(true);
          }}
          onPointerMove={(event) => {
            if (!dragging) return;
            const dx = event.clientX - start.current.x;
            const dy = event.clientY - start.current.y;
            if (Math.abs(dy) > Math.abs(dx) && !moved.current) return;
            if (Math.abs(dx) > 6) moved.current = true;
            setDragX(dx);
          }}
          onPointerUp={() => {
            if (Math.abs(dragX) > Math.min(60, cardWidth / 4)) go(index + (dragX < 0 ? 1 : -1));
            setDragX(0); setDragging(false);
          }}
          onPointerCancel={() => { setDragX(0); setDragging(false); }}
          onClickCapture={(event) => { if (moved.current) { event.preventDefault(); event.stopPropagation(); moved.current = false; } }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowLeft') go(index - 1);
            if (event.key === 'ArrowRight') go(index + 1);
          }}
        >
          <div
            className={`flex gap-3 ${dragging ? '' : 'transition-transform duration-300 ease-out motion-reduce:transition-none'}`}
            style={{ transform: `translate3d(${-index * step + dragX}px,0,0)` }}
          >
            {visible.map((ad) => (
              <div key={ad.id} className="shrink-0" style={{ width: cardWidth || '90%' }}>
                <AdvertisementCard ad={ad} onDismiss={() => setDismissed((current) => [...current, ad.id])} />
              </div>
            ))}
          </div>
        </div>

        {visible.length > 1 && (
          <div className="mt-3 flex items-center justify-between">
            <button type="button" aria-label="Previous advertisement" disabled={index === 0} onClick={() => go(index - 1)} className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 disabled:cursor-not-allowed disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-slate-700"><ChevronLeftIcon className="h-5 w-5" /></button>
            <div className="flex gap-1.5" aria-label={`Advertisement ${index + 1} of ${visible.length}`}>
              {visible.map((ad, dot) => <button key={ad.id} type="button" aria-label={`Show advertisement ${dot + 1}`} onClick={() => go(dot)} className={`h-2.5 rounded-full transition-all motion-reduce:transition-none ${dot === index ? 'w-6 bg-brand-700' : 'w-2.5 bg-slate-300 dark:bg-slate-700'}`} />)}
            </div>
            <button type="button" aria-label="Next advertisement" disabled={index === visible.length - 1} onClick={() => go(index + 1)} className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 disabled:cursor-not-allowed disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-slate-700"><ChevronRightIcon className="h-5 w-5" /></button>
          </div>
        )}
      </div>

      <div data-testid="sponsored-card-grid" className="hidden grid-cols-3 gap-4 lg:grid xl:grid-cols-4">
        {visible.map((ad) => <AdvertisementCard key={ad.id} ad={ad} onDismiss={() => setDismissed((current) => [...current, ad.id])} />)}
      </div>
    </section>
  );
}
