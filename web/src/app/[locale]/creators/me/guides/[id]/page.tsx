'use client';

import Link from 'next/link';
import { use, useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ChevronDownIcon, ChevronUpIcon, MagnifyingGlassIcon, PhotoIcon, TrashIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useAuth } from '@/hooks/useAuth';
import { getPlaces } from '@/lib/api';
import { createGuide, deleteGuide, getMyGuide, submitGuide, updateGuide } from '@/lib/creator-guides-api';
import { uploadImage } from '@/lib/uploads-api';
import { guideVideoSource } from '@/lib/guide-video';
import { resolveImageUrl } from '@/lib/images';
import { HttpError } from '@/lib/http';
import { BrandLoader } from '@/components/BrandLoader';
import { GuideStatusBadge } from '@/components/creator-guides/GuideStatusBadge';
import type { CreatorGuide, CreatorGuideInput, Place } from '@/lib/types';

interface StopDraft {
  place: Pick<Place, 'id' | 'name' | 'city'> & { county: { name: string } };
  day: number;
  note: string;
}

const MAX_DAYS = 7;
const field =
  'min-h-11 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50';
const label = 'flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200';

// Write or edit a guide: title, story, cover and video, and the real places
// it covers with a note for each. Saving keeps a draft; submitting sends it
// to the LIBERIA360 team, and it goes live once approved.
export default function GuideEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const isNew = id === 'new';
  const t = useTranslations('creatorGuides');
  const router = useRouter();
  const { token, ready } = useAuth();
  const [guide, setGuide] = useState<CreatorGuide | null>(null);
  const [loading, setLoading] = useState(!isNew);
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [stops, setStops] = useState<StopDraft[]>([]);
  const [mediaOk, setMediaOk] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Place[]>([]);
  const [busy, setBusy] = useState<'save' | 'submit' | 'upload' | 'delete' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (isNew || !ready || !token) return;
    getMyGuide(token, id)
      .then((g) => {
        setGuide(g);
        setTitle(g.title);
        setSummary(g.summary);
        setCoverImage(g.coverImage);
        setVideoUrl(g.videoUrl ?? '');
        setMediaOk(Boolean(g.mediaPermissionConfirmedAt));
        setStops(g.stops.map((s) => ({ place: s.place, day: s.day, note: s.note ?? '' })));
      })
      .catch((err) => setError(err instanceof HttpError ? err.message : t('actionError')))
      .finally(() => setLoading(false));
  }, [isNew, ready, token, id, t]);

  async function search(e: { preventDefault(): void }) {
    e.preventDefault();
    if (query.trim().length < 2) return;
    const page = await getPlaces({ q: query.trim(), limit: 6 }).catch(() => null);
    setResults(page?.data ?? []);
  }

  function addPlace(place: Place) {
    if (stops.some((s) => s.place.id === place.id)) return;
    const lastDay = stops.length ? stops[stops.length - 1].day : 1;
    setStops([...stops, { place, day: lastDay, note: '' }]);
    setResults([]);
    setQuery('');
  }

  function move(index: number, delta: number) {
    const next = [...stops];
    const [item] = next.splice(index, 1);
    next.splice(index + delta, 0, item);
    setStops(next);
  }

  async function onCover(file: File | undefined) {
    if (!file || !token) return;
    setBusy('upload');
    setError(null);
    try {
      setCoverImage(await uploadImage(token, file));
      setMediaOk(false);
    } catch (err) {
      setError(err instanceof HttpError ? err.message : t('actionError'));
    } finally {
      setBusy(null);
    }
  }

  const videoInvalid = videoUrl.trim() !== '' && !guideVideoSource(videoUrl.trim());
  const hasMedia = Boolean(coverImage || videoUrl.trim());

  function input(): CreatorGuideInput {
    // Stops keep the order they're listed in; days group them.
    const ordered = [...stops].sort((a, b) => a.day - b.day);
    return {
      title: title.trim(),
      summary: summary.trim(),
      coverImage,
      videoUrl: videoUrl.trim() || null,
      stops: ordered.map((s) => ({ placeId: s.place.id, day: s.day, note: s.note.trim() || null })),
      mediaPermissionConfirmed: mediaOk,
    };
  }

  async function save(andSubmit: boolean) {
    if (!token) return;
    if (videoInvalid) {
      setError(t('videoInvalid'));
      return;
    }
    if (andSubmit && hasMedia && !mediaOk) {
      setError(t('mediaPermissionRequired'));
      return;
    }
    setBusy(andSubmit ? 'submit' : 'save');
    setError(null);
    setNotice(null);
    try {
      let saved = isNew || !guide ? await createGuide(token, input()) : await updateGuide(token, guide.id, input());
      if (andSubmit && saved.status !== 'pending_review') saved = await submitGuide(token, saved.id);
      setGuide(saved);
      setNotice(andSubmit || saved.status === 'pending_review' ? t('submittedNotice') : t('savedNotice'));
      if (isNew) router.replace(`/creators/me/guides/${saved.id}`);
    } catch (err) {
      setError(err instanceof HttpError ? err.message : t('actionError'));
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (!token || !guide || !window.confirm(t('deleteConfirm'))) return;
    setBusy('delete');
    try {
      await deleteGuide(token, guide.id);
      router.push('/creators/me/guides');
    } catch (err) {
      setError(err instanceof HttpError ? err.message : t('actionError'));
      setBusy(null);
    }
  }

  if (!ready || loading) return <BrandLoader />;
  if (!token) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <Link href={`/login?next=/creators/me/guides/${id}`} className="font-semibold text-brand-700 underline">
          {t('loginToWrite')}
        </Link>
      </main>
    );
  }

  const days = Array.from({ length: MAX_DAYS }, (_, i) => i + 1);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/creators/me/guides" className="text-sm font-semibold text-brand-700 hover:underline dark:text-brand-300">
          ← {t('myGuides')}
        </Link>
        {guide && <GuideStatusBadge status={guide.status} />}
      </div>
      <h1 className="font-display text-3xl font-extrabold tracking-tight text-slate-950 dark:text-slate-50">
        {isNew ? t('newGuide') : t('editGuide')}
      </h1>

      {guide?.status === 'rejected' && guide.rejectionReason && (
        <p className="rounded-xl bg-flag-500/10 px-3 py-2 text-sm text-flag-800 dark:text-flag-200">
          <strong>{t('reviewerNote')}</strong> {guide.rejectionReason}
        </p>
      )}
      {guide?.status === 'published' && (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-900/30 dark:text-amber-100">
          {t('editPublishedWarning')}{' '}
          <Link href={`/creator-guides/${guide.slug}`} className="font-semibold underline">
            {t('viewPublished')}
          </Link>
        </p>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save(false);
        }}
        className="flex flex-col gap-5"
      >
        <label className={label}>
          {t('fieldTitle')}
          <input value={title} onChange={(e) => setTitle(e.target.value)} required minLength={4} maxLength={150} className={field} />
        </label>
        <label className={label}>
          {t('fieldSummary')}
          <textarea value={summary} onChange={(e) => setSummary(e.target.value)} required minLength={20} maxLength={4000} rows={5} className={field} />
          <span className="text-xs font-normal text-slate-500 dark:text-slate-400">{t('fieldSummaryHint')}</span>
        </label>

        <fieldset className="flex flex-col gap-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
          <legend className="px-1 text-sm font-semibold text-slate-800 dark:text-slate-100">{t('mediaHeading')}</legend>
          <div className="flex flex-wrap items-center gap-3">
            {coverImage ? (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={resolveImageUrl(coverImage)} alt="" className="h-24 w-40 rounded-xl object-cover" />
                <button
                  type="button"
                  onClick={() => {
                    setCoverImage(null);
                  }}
                  aria-label={t('removeCover')}
                  className="absolute -end-2 -top-2 rounded-full bg-white p-1 shadow dark:bg-slate-800"
                >
                  <XMarkIcon aria-hidden className="h-4 w-4" />
                </button>
              </div>
            ) : null}
            <label className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:border-brand-500 dark:border-slate-700 dark:text-slate-200">
              <PhotoIcon aria-hidden className="h-4 w-4" />
              {busy === 'upload' ? t('uploading') : coverImage ? t('replaceCover') : t('addCover')}
              <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => onCover(e.target.files?.[0])} />
            </label>
          </div>
          <label className={label}>
            {t('fieldVideo')}
            <input
              type="url"
              value={videoUrl}
              onChange={(e) => {
                setVideoUrl(e.target.value);
                setMediaOk(false);
              }}
              placeholder="https://youtu.be/…"
              aria-invalid={videoInvalid}
              className={field}
            />
            <span className={`text-xs font-normal ${videoInvalid ? 'text-flag-700 dark:text-flag-300' : 'text-slate-500 dark:text-slate-400'}`}>
              {videoInvalid ? t('videoInvalid') : t('fieldVideoHint')}
            </span>
          </label>
          {hasMedia && (
            <label className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-200">
              <input type="checkbox" checked={mediaOk} onChange={(e) => setMediaOk(e.target.checked)} className="mt-0.5 h-4 w-4 accent-brand-700" />
              {t('mediaPermission')}
            </label>
          )}
        </fieldset>

        <fieldset className="flex flex-col gap-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
          <legend className="px-1 text-sm font-semibold text-slate-800 dark:text-slate-100">{t('placesHeading')}</legend>
          <div role="search" className="flex gap-2">
            <label className="relative min-w-0 flex-1">
              <span className="sr-only">{t('searchPlaces')}</span>
              <MagnifyingGlassIcon aria-hidden className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void search(e);
                }}
                placeholder={t('searchPlaces')}
                className={`${field} w-full ps-9`}
              />
            </label>
            <button type="button" onClick={(e) => void search(e)} className="min-h-11 rounded-full border border-slate-300 px-4 text-sm font-semibold dark:border-slate-700">
              {t('search')}
            </button>
          </div>
          {results.length > 0 && (
            <ul className="flex flex-col divide-y divide-slate-100 rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
              {results.map((p) => (
                <li key={p.id}>
                  <button type="button" onClick={() => addPlace(p)} className="flex w-full items-center justify-between gap-2 px-3 py-2 text-start text-sm hover:bg-slate-50 dark:hover:bg-slate-800">
                    <span>
                      <span className="font-semibold text-slate-900 dark:text-slate-50">{p.name}</span>
                      <span className="text-slate-500 dark:text-slate-400"> · {p.county.name}</span>
                    </span>
                    <span className="text-brand-700 dark:text-brand-300">{t('add')}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {stops.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">{t('noPlacesYet')}</p>
          ) : (
            <ol className="flex flex-col gap-3">
              {stops.map((s, i) => (
                <li key={s.place.id} className="flex flex-col gap-2 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate font-semibold text-slate-900 dark:text-slate-50">
                      {i + 1}. {s.place.name}
                    </span>
                    <label className="sr-only" htmlFor={`day-${s.place.id}`}>
                      {t('dayFor', { name: s.place.name })}
                    </label>
                    <select
                      id={`day-${s.place.id}`}
                      value={s.day}
                      onChange={(e) => setStops(stops.map((x, j) => (j === i ? { ...x, day: Number(e.target.value) } : x)))}
                      className="min-h-9 rounded-full border border-slate-300 bg-transparent px-2 text-xs dark:border-slate-700"
                    >
                      {days.map((d) => (
                        <option key={d} value={d}>
                          {t('day', { day: d })}
                        </option>
                      ))}
                    </select>
                    <button type="button" disabled={i === 0} onClick={() => move(i, -1)} aria-label={t('moveUp', { name: s.place.name })} className="rounded p-1 disabled:opacity-30">
                      <ChevronUpIcon aria-hidden className="h-4 w-4" />
                    </button>
                    <button type="button" disabled={i === stops.length - 1} onClick={() => move(i, 1)} aria-label={t('moveDown', { name: s.place.name })} className="rounded p-1 disabled:opacity-30">
                      <ChevronDownIcon aria-hidden className="h-4 w-4" />
                    </button>
                    <button type="button" onClick={() => setStops(stops.filter((_, j) => j !== i))} aria-label={t('removePlace', { name: s.place.name })} className="rounded p-1 text-flag-700 dark:text-flag-300">
                      <TrashIcon aria-hidden className="h-4 w-4" />
                    </button>
                  </div>
                  <label className="sr-only" htmlFor={`note-${s.place.id}`}>
                    {t('noteFor', { name: s.place.name })}
                  </label>
                  <textarea
                    id={`note-${s.place.id}`}
                    value={s.note}
                    onChange={(e) => setStops(stops.map((x, j) => (j === i ? { ...x, note: e.target.value } : x)))}
                    maxLength={600}
                    rows={2}
                    placeholder={t('notePlaceholder')}
                    className={field}
                  />
                </li>
              ))}
            </ol>
          )}
        </fieldset>

        {error && (
          <p role="alert" className="rounded-xl bg-flag-500/10 px-3 py-2 text-sm text-flag-800 dark:text-flag-200">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="rounded-xl bg-brand-50 px-3 py-2 text-sm text-brand-900 dark:bg-brand-900/30 dark:text-brand-100">
            {notice}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <button type="submit" disabled={busy !== null} className="min-h-11 rounded-full border border-brand-700 px-5 text-sm font-semibold text-brand-800 disabled:opacity-60 dark:border-brand-400 dark:text-brand-200">
            {busy === 'save' ? t('saving') : t('saveDraft')}
          </button>
          <button
            type="button"
            disabled={busy !== null || stops.length === 0}
            onClick={() => void save(true)}
            className="min-h-11 rounded-full bg-brand-700 px-5 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
          >
            {busy === 'submit' ? t('submitting') : guide?.status === 'published' ? t('resubmit') : t('submitForReview')}
          </button>
          {guide && (
            <button type="button" onClick={remove} disabled={busy !== null} className="ms-auto min-h-11 px-3 text-sm font-semibold text-flag-700 hover:underline dark:text-flag-300">
              {t('deleteGuide')}
            </button>
          )}
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">{t('moderationNote')}</p>
      </form>
    </main>
  );
}
