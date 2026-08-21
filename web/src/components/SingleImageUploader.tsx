'use client';

import { useState } from 'react';
import { uploadImage } from '@/lib/uploads-api';
import { resolveImageUrl } from '@/lib/images';
import { HttpError } from '@/lib/http';
import { SafeImage } from './SafeImage';

// Single-value counterpart to PhotoManager (which manages a `string[]`
// gallery) — profileImage/coverImage are one-URL fields, not a list, so
// reusing PhotoManager's array-shaped API and MAX_PHOTOS cap would just
// add awkward bookkeeping for something that's really just "replace this
// one image."
export function SingleImageUploader({
  token,
  value,
  onChange,
  label,
  className = 'h-28 w-28',
}: {
  token: string;
  value: string | null;
  onChange: (url: string | null) => void;
  label: string;
  className?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      onChange(await uploadImage(token, file));
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{label}</p>
      {value ? (
        <div className={`group relative overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800 ${className}`}>
          <SafeImage
            src={resolveImageUrl(value)}
            alt=""
            className="h-full w-full object-cover"
            fallback={
              <div
                aria-hidden
                className="flex h-full w-full items-center justify-center bg-slate-100 text-xs text-slate-400 dark:bg-slate-800 dark:text-slate-400"
              >
                Image unavailable
              </div>
            }
          />
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-label="Remove image"
            className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-slate-900/70 text-white opacity-0 transition group-hover:opacity-100"
          >
            ×
          </button>
        </div>
      ) : (
        <label
          className={`inline-flex cursor-pointer items-center justify-center rounded-lg border border-dashed border-slate-300 dark:border-slate-700 text-center text-xs font-medium text-slate-500 dark:text-slate-400 hover:border-brand-500 hover:text-brand-700 dark:hover:text-brand-300 ${className}`}
        >
          {uploading ? 'Uploading…' : '+ Upload'}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            disabled={uploading}
            onChange={(e) => handleFile(e.target.files?.[0])}
            className="hidden"
          />
        </label>
      )}
      {error && <p className="text-xs text-flag-700 dark:text-flag-300">{error}</p>}
    </div>
  );
}
