'use client';

import { useRef, useState } from 'react';
import { PlayCircleIcon } from '@heroicons/react/24/solid';
import { addPortfolioItem, removePortfolioItem, updatePortfolioItem } from '@/lib/creator-api';
import { uploadImage } from '@/lib/uploads-api';
import { resolveImageUrl } from '@/lib/images';
import { HttpError } from '@/lib/http';
import type { CreatorPortfolioItem } from '@/lib/types';

// The creator dashboard's portfolio manager — each item is its own row on
// the backend (creator_portfolio_items), so mutations happen immediately
// per action (upload → POST, caption/category edit on blur → PATCH,
// remove → DELETE) rather than batched behind a page-level Save button,
// same "each item is independently persisted" shape as PhotoManager's
// underlying images but with real per-item metadata to edit.
export function CreatorPortfolioManager({
  token,
  items,
  onChange,
}: {
  token: string;
  items: CreatorPortfolioItem[];
  onChange: (next: CreatorPortfolioItem[]) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [videoUrl, setVideoUrl] = useState('');
  const [addingVideo, setAddingVideo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleImageFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const url = await uploadImage(token, file);
        const item = await addPortfolioItem(token, { type: 'image', url });
        onChange([...items, item]);
      }
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleAddVideo() {
    if (!videoUrl.trim()) return;
    setError(null);
    setAddingVideo(true);
    try {
      const item = await addPortfolioItem(token, { type: 'video', url: videoUrl.trim() });
      onChange([...items, item]);
      setVideoUrl('');
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setAddingVideo(false);
    }
  }

  async function handleFieldBlur(item: CreatorPortfolioItem, field: 'caption' | 'category', value: string) {
    const current = item[field] ?? '';
    if (value === current) return;
    try {
      const updated = await updatePortfolioItem(token, item.id, { [field]: value || undefined });
      onChange(items.map((i) => (i.id === item.id ? updated : i)));
    } catch {
      // Non-critical field, non-blocking — the item stays as it was
      // locally; the next successful edit will retry the save.
    }
  }

  async function handleRemove(itemId: string) {
    try {
      await removePortfolioItem(token, itemId);
      onChange(items.filter((i) => i.id !== itemId));
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Could not remove that item. Please try again.');
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {items.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {items.map((item) => (
            <div key={item.id} className="flex flex-col gap-1.5">
              <div className="group relative aspect-square overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
                {item.type === 'image' ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={resolveImageUrl(item.url)} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-slate-900 text-white">
                    <PlayCircleIcon aria-hidden className="h-8 w-8" />
                    <a href={item.url} target="_blank" rel="noopener noreferrer" className="max-w-[90%] truncate text-xs underline">
                      {item.url}
                    </a>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => handleRemove(item.id)}
                  aria-label="Remove item"
                  className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-slate-900/70 text-white opacity-0 transition group-hover:opacity-100"
                >
                  ×
                </button>
              </div>
              <input
                placeholder="Caption"
                defaultValue={item.caption ?? ''}
                onBlur={(e) => handleFieldBlur(item, 'caption', e.target.value)}
                maxLength={200}
                className="rounded-md border border-slate-300 dark:border-slate-700 px-2 py-1 text-xs outline-none focus:border-brand-500"
              />
              <input
                placeholder="Category (e.g. Weddings)"
                defaultValue={item.category ?? ''}
                onBlur={(e) => handleFieldBlur(item, 'category', e.target.value)}
                maxLength={60}
                className="rounded-md border border-slate-300 dark:border-slate-700 px-2 py-1 text-xs outline-none focus:border-brand-500"
              />
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-full border border-dashed border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:border-brand-500 hover:text-brand-700">
          {uploading ? 'Uploading…' : '+ Add photos'}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            disabled={uploading}
            onChange={(e) => handleImageFiles(e.target.files)}
            className="hidden"
          />
        </label>
      </div>

      <div className="flex gap-2">
        <input
          placeholder="Paste a YouTube / Vimeo / Instagram video link…"
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
          className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs outline-none focus:border-brand-500"
        />
        <button
          type="button"
          onClick={handleAddVideo}
          disabled={addingVideo || !videoUrl.trim()}
          className="shrink-0 rounded-full border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:border-brand-500 disabled:opacity-60"
        >
          {addingVideo ? 'Adding…' : '+ Add video'}
        </button>
      </div>

      {error && <p className="text-xs text-flag-700">{error}</p>}
    </div>
  );
}
