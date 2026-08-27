'use client';

import { useState, type FormEvent } from 'react';
import { HttpError } from '@/lib/http';
import { createCreatorPost } from '@/lib/creator-feed-api';
import type { CreatorPostMediaType } from '@/lib/types';
import { SingleImageUploader } from './SingleImageUploader';
import { CreatorVideoThumbnail } from './CreatorVideoThumbnail';
import { creatorVideoPosterUrl } from '@/lib/creator-media';

export function CreatorPostComposer({ token, onPublished }: { token: string; onPublished?: () => void }) {
  const [mediaType, setMediaType] = useState<CreatorPostMediaType>('image');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const mediaUrl = mediaType === 'image' ? imageUrl : videoUrl.trim();
    if (!mediaUrl) {
      setError(mediaType === 'image' ? 'Upload an image before publishing.' : 'Add a video link before publishing.');
      return;
    }
    setSubmitting(true);
    setError(null);
    setSuccess(false);
    try {
      await createCreatorPost(token, {
        mediaType,
        mediaUrl,
        caption: caption.trim() || undefined,
      });
      setImageUrl(null);
      setVideoUrl('');
      setCaption('');
      setSuccess(true);
      onPublished?.();
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Your post could not be published.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section aria-labelledby="creator-post-composer-heading" className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
      <div className="mb-4">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-700 dark:text-brand-300">Share with your audience</p>
        <h2 id="creator-post-composer-heading" className="mt-1 font-display text-xl font-bold text-slate-950 dark:text-white">Create a post</h2>
        <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">Post a real photo or video and write the caption your viewers will see in the creator feed.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 rounded-2xl bg-slate-100 p-1 dark:bg-slate-800">
          {(['image', 'video'] as CreatorPostMediaType[]).map((type) => (
            <button key={type} type="button" onClick={() => setMediaType(type)} className={`min-h-11 rounded-xl px-3 text-sm font-semibold capitalize ${mediaType === type ? 'bg-white text-brand-800 shadow-sm dark:bg-slate-700 dark:text-brand-200' : 'text-slate-500 dark:text-slate-400'}`}>
              {type === 'image' ? 'Photo post' : 'Video link'}
            </button>
          ))}
        </div>

        {mediaType === 'image' ? (
          <SingleImageUploader token={token} value={imageUrl} onChange={setImageUrl} label="Post photo" className="h-44 w-full" />
        ) : (
          <div className="space-y-3">
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
              Video URL
              <input type="url" required value={videoUrl} onChange={(event) => setVideoUrl(event.target.value)} maxLength={500} placeholder="https://youtube.com/watch?v=…" className="rounded-2xl border border-slate-300 px-3 py-3 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-950 dark:focus:ring-brand-950" />
            </label>
            {videoUrl.trim() && (
              <div className="aspect-video overflow-hidden rounded-2xl">
                <CreatorVideoThumbnail src={videoUrl.trim()} poster={creatorVideoPosterUrl(videoUrl.trim())} label="Video post preview" />
              </div>
            )}
            <p className="text-xs text-slate-500 dark:text-slate-400">Video posts currently use a YouTube or Vimeo link. The feed will show the provider thumbnail when available.</p>
          </div>
        )}

        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
          Caption
          <textarea value={caption} onChange={(event) => setCaption(event.target.value)} maxLength={2000} rows={4} placeholder="Tell your audience what this moment means…" className="resize-y rounded-2xl border border-slate-300 px-3 py-3 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-950 dark:focus:ring-brand-950" />
          <span className="text-right text-xs font-normal text-slate-400">{caption.length}/2000</span>
        </label>

        {error && <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">{error}</p>}
        {success && <p role="status" className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">Post published to the creator feed.</p>}

        <button type="submit" disabled={submitting} className="min-h-12 w-full rounded-2xl bg-brand-700 px-4 py-3 text-sm font-bold text-white hover:bg-brand-800 disabled:opacity-60">
          {submitting ? 'Publishing…' : 'Publish post'}
        </button>
      </form>
    </section>
  );
}
