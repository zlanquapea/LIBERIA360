'use client';

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowPathRoundedSquareIcon, MagnifyingGlassMinusIcon, MagnifyingGlassPlusIcon } from '@heroicons/react/24/outline';
import {
  MAX_ZOOM,
  cropRect,
  drawCrop,
  initialCrop,
  isUnchanged,
  outputSize,
  type AspectId,
  type CropState,
  type Rotation,
} from '@/lib/photo-crop';

const ASPECT_OPTIONS: AspectId[] = ['original', '4:3', '16:9', '1:1'];

// Frame a photo before it's uploaded: pick a shape, drag to position,
// zoom, rotate, and see how it will look on a card and as a cover. The
// server then evens out exposure and colour on every upload (see
// api/src/uploads/image-processing.ts), so this step is only about
// framing. "Use original" uploads the file untouched.
export function PhotoEditor({
  file,
  defaultAspect = 'original',
  remaining = 0,
  onDone,
  onCancel,
  onSkipRest,
}: {
  file: File;
  defaultAspect?: AspectId;
  // How many more photos are queued after this one.
  remaining?: number;
  onDone: (file: File) => void;
  onCancel: () => void;
  onSkipRest?: () => void;
}) {
  const t = useTranslations('photoEditor');
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [state, setState] = useState<CropState | null>(null);
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);
  const frameRef = useRef<HTMLCanvasElement>(null);
  const cardRef = useRef<HTMLCanvasElement>(null);
  const coverRef = useRef<HTMLCanvasElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; cx: number; cy: number } | null>(null);

  useEffect(() => {
    // A superseded load (a new file, or React re-running the effect)
    // must not report back: its URL is revoked, so it would always "fail".
    let live = true;
    setError(false);
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      if (!live) return;
      setImg(image);
      setState(initialCrop(image.naturalWidth, image.naturalHeight, defaultAspect));
    };
    image.onerror = () => {
      if (live) setError(true);
    };
    image.src = url;
    return () => {
      live = false;
      URL.revokeObjectURL(url);
    };
  }, [file, defaultAspect]);

  useEffect(() => {
    dialogRef.current?.focus();
    const onKey = (e: globalThis.KeyboardEvent) => e.key === 'Escape' && onCancel();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  // Redraw the frame and both previews whenever the framing changes.
  useEffect(() => {
    if (!img || !state) return;
    const raf = requestAnimationFrame(() => {
      const rect = cropRect(img.naturalWidth, img.naturalHeight, state);
      for (const canvas of [frameRef.current, cardRef.current, coverRef.current]) {
        if (!canvas) continue;
        const cssW = canvas.clientWidth || 320;
        const w = Math.round(cssW * Math.min(2, window.devicePixelRatio || 1));
        const h = Math.round(w * (rect.height / rect.width));
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx) drawCrop(ctx, img, state, w, h);
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [img, state]);

  const update = useCallback((patch: Partial<CropState>) => {
    setState((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  if (error) {
    return (
      <Shell dialogRef={dialogRef} title={t('title')}>
        <p className="text-sm text-flag-700 dark:text-flag-300">{t('cantOpen')}</p>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => onDone(file)} className={secondary}>
            {t('useOriginal')}
          </button>
          <button type="button" onClick={onCancel} className={secondary}>
            {t('cancel')}
          </button>
        </div>
      </Shell>
    );
  }
  if (!img || !state) {
    return (
      <Shell dialogRef={dialogRef} title={t('title')}>
        <p className="text-sm text-slate-500">{t('loading')}</p>
      </Shell>
    );
  }

  const rect = cropRect(img.naturalWidth, img.naturalHeight, state);
  // Pixels in the source per CSS pixel on screen, for dragging.
  const sourcePerCss = () => rect.width / (frameRef.current?.clientWidth || 1);

  function onPointerDown(e: PointerEvent<HTMLCanvasElement>) {
    (e.target as Element).setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, cx: rect.x + rect.width / 2, cy: rect.y + rect.height / 2 };
  }
  function onPointerMove(e: PointerEvent<HTMLCanvasElement>) {
    if (!drag.current) return;
    const k = sourcePerCss();
    update({ cx: drag.current.cx - (e.clientX - drag.current.x) * k, cy: drag.current.cy - (e.clientY - drag.current.y) * k });
  }
  function onKeyDown(e: KeyboardEvent<HTMLCanvasElement>) {
    const step = rect.width * 0.03;
    const cx = rect.x + rect.width / 2;
    const cy = rect.y + rect.height / 2;
    const moves: Record<string, Partial<CropState>> = {
      ArrowLeft: { cx: cx - step },
      ArrowRight: { cx: cx + step },
      ArrowUp: { cy: cy - step },
      ArrowDown: { cy: cy + step },
      '+': { zoom: Math.min(MAX_ZOOM, state!.zoom + 0.1) },
      '=': { zoom: Math.min(MAX_ZOOM, state!.zoom + 0.1) },
      '-': { zoom: Math.max(1, state!.zoom - 0.1) },
    };
    if (moves[e.key]) {
      e.preventDefault();
      update({ cx, cy, ...moves[e.key] });
    }
  }

  function rotate() {
    const next = (((state!.rotation + 90) % 360) as Rotation);
    setState(initialCrop(img!.naturalWidth, img!.naturalHeight, state!.aspect, next));
  }

  function setAspect(aspect: AspectId) {
    setState(initialCrop(img!.naturalWidth, img!.naturalHeight, aspect, state!.rotation));
  }

  async function apply() {
    if (isUnchanged(state!)) {
      onDone(file);
      return;
    }
    setSaving(true);
    const size = outputSize(rect);
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      onDone(file);
      return;
    }
    drawCrop(ctx, img!, state!, size.width, size.height);
    canvas.toBlob(
      (blob) => {
        setSaving(false);
        if (!blob) {
          onDone(file);
          return;
        }
        const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
        onDone(new File([blob], name, { type: 'image/jpeg' }));
      },
      'image/jpeg',
      0.92,
    );
  }

  return (
    <Shell dialogRef={dialogRef} title={t('title')}>
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t('shape')}>
        {ASPECT_OPTIONS.map((a) => (
          <button
            key={a}
            type="button"
            role="radio"
            aria-checked={state.aspect === a}
            onClick={() => setAspect(a)}
            className={`min-h-9 rounded-full border px-3 text-xs font-semibold ${
              state.aspect === a
                ? 'border-brand-700 bg-brand-700 text-white'
                : 'border-slate-300 text-slate-700 hover:border-brand-500 dark:border-slate-700 dark:text-slate-200'
            }`}
          >
            {t(`aspect_${a.replace(':', '_')}`)}
          </button>
        ))}
      </div>

      <div className="relative overflow-hidden rounded-xl bg-slate-900">
        <canvas
          ref={frameRef}
          tabIndex={0}
          role="img"
          aria-label={t('frameLabel')}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={() => (drag.current = null)}
          onPointerCancel={() => (drag.current = null)}
          onKeyDown={onKeyDown}
          className="block w-full cursor-grab touch-none select-none active:cursor-grabbing focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sunset-300"
          style={{ maxHeight: '50vh', objectFit: 'contain' }}
        />
        <div aria-hidden className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">
          {Array.from({ length: 9 }, (_, i) => (
            <span key={i} className="border border-white/15" />
          ))}
        </div>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400">{t('dragHint')}</p>

      <div className="flex items-center gap-3">
        <MagnifyingGlassMinusIcon aria-hidden className="h-5 w-5 shrink-0 text-slate-500" />
        <label className="sr-only" htmlFor="photo-zoom">
          {t('zoom')}
        </label>
        <input
          id="photo-zoom"
          type="range"
          min={1}
          max={MAX_ZOOM}
          step={0.01}
          value={state.zoom}
          onChange={(e) => update({ zoom: Number(e.target.value), cx: rect.x + rect.width / 2, cy: rect.y + rect.height / 2 })}
          className="w-full accent-brand-700"
        />
        <MagnifyingGlassPlusIcon aria-hidden className="h-5 w-5 shrink-0 text-slate-500" />
        <button type="button" onClick={rotate} className={`${secondary} shrink-0`} aria-label={t('rotate')}>
          <ArrowPathRoundedSquareIcon aria-hidden className="h-5 w-5" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <figure className="flex flex-col gap-1">
          <div className="aspect-[4/3] overflow-hidden rounded-xl bg-slate-200 dark:bg-slate-800">
            <canvas ref={cardRef} className="h-full w-full object-cover" aria-hidden />
          </div>
          <figcaption className="text-xs text-slate-500 dark:text-slate-400">{t('previewCard')}</figcaption>
        </figure>
        <figure className="flex flex-col gap-1">
          <div className="aspect-video overflow-hidden rounded-xl bg-slate-200 dark:bg-slate-800">
            <canvas ref={coverRef} className="h-full w-full object-cover" aria-hidden />
          </div>
          <figcaption className="text-xs text-slate-500 dark:text-slate-400">{t('previewCover')}</figcaption>
        </figure>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400">{t('finishNote')}</p>

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
        {remaining > 0 && onSkipRest && (
          <button type="button" onClick={onSkipRest} className="me-auto text-xs font-semibold text-slate-600 hover:underline dark:text-slate-300">
            {t('skipRest', { count: remaining + 1 })}
          </button>
        )}
        <button type="button" onClick={onCancel} className={secondary}>
          {t('cancel')}
        </button>
        <button type="button" onClick={() => onDone(file)} className={secondary}>
          {t('useOriginal')}
        </button>
        <button type="button" onClick={apply} disabled={saving} className="min-h-10 rounded-full bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60">
          {saving ? t('saving') : remaining > 0 ? t('useAndNext') : t('usePhoto')}
        </button>
      </div>
    </Shell>
  );
}

const secondary =
  'inline-flex min-h-10 items-center justify-center rounded-full border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:border-brand-500 dark:border-slate-700 dark:text-slate-200';

function Shell({ dialogRef, title, children }: { dialogRef: React.RefObject<HTMLDivElement | null>; title: string; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[3000] flex items-end justify-center bg-black/60 sm:items-center sm:p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="flex max-h-[95vh] w-full max-w-xl flex-col gap-3 overflow-y-auto rounded-t-3xl bg-white p-4 shadow-2xl outline-none dark:bg-slate-900 sm:rounded-3xl sm:p-5"
      >
        <h2 className="font-display text-lg font-bold text-slate-950 dark:text-slate-50">{title}</h2>
        {children}
      </div>
    </div>
  );
}
