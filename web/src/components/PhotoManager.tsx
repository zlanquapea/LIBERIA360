'use client';

import { useRef, useState } from 'react';
import { uploadImage } from '@/lib/uploads-api';
import { resolveImageUrl } from '@/lib/images';
import { HttpError } from '@/lib/http';

const MAX_PHOTOS = 10; // matches the API's ArrayMaxSize(10) on images

// Shared "manage this listing's photos" control — a thumbnail grid with a
// remove button per photo, plus a file input that uploads and appends.
// Used by both the business owner's self-edit form and the admin content
// management screens (Place and Business both carry the same `images: []`
// shape), so the upload/attach behavior only needs to be right once.
export function PhotoManager({
  token,
  images,
  onChange,
  label = 'Photos',
}: {
  token: string;
  images: string[];
  onChange: (next: string[]) => void;
  label?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const room = MAX_PHOTOS - images.length;
    if (room <= 0) {
      setError(`Up to ${MAX_PHOTOS} photos — remove one first.`);
      return;
    }
    setError(null);
    setUploading(true);
    try {
      const toUpload = Array.from(files).slice(0, room);
      const uploaded: string[] = [];
      for (const file of toUpload) {
        uploaded.push(await uploadImage(token, file));
      }
      onChange([...images, ...uploaded]);
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  function remove(url: string) {
    onChange(images.filter((i) => i !== url));
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium text-slate-700">{label}</p>

      {images.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {images.map((img) => (
            <div key={img} className="group relative aspect-square overflow-hidden rounded-lg border border-slate-200">
              {/* Uploaded images are on the API's own origin, unknown ahead of
                  time — next/image would need that host allow-listed, so a
                  plain <img> is simpler here than fighting remotePatterns. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={resolveImageUrl(img)} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => remove(img)}
                aria-label="Remove photo"
                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-slate-900/70 text-white opacity-0 transition group-hover:opacity-100"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {images.length < MAX_PHOTOS && (
        <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-full border border-dashed border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-brand-500 hover:text-brand-700">
          {uploading ? 'Uploading…' : '+ Add photos'}
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            disabled={uploading}
            onChange={(e) => handleFiles(e.target.files)}
            className="hidden"
          />
        </label>
      )}
      {error && <p className="text-xs text-flag-700">{error}</p>}
    </div>
  );
}
