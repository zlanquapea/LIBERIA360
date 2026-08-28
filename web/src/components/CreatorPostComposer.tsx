"use client";

import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import {
  DocumentTextIcon,
  PhotoIcon,
  VideoCameraIcon,
} from "@heroicons/react/24/outline";
import { HttpError } from "@/lib/http";
import { createCreatorPost, updateCreatorPost } from "@/lib/creator-feed-api";
import type { CreatorPost, CreatorPostMediaType } from "@/lib/types";
import { validateVideoFile, uploadVideo } from "@/lib/video-uploads-api";
import { SingleImageUploader } from "./SingleImageUploader";
import { CreatorVideoThumbnail } from "./CreatorVideoThumbnail";
import { creatorVideoPosterUrl } from "@/lib/creator-media";

type VideoSource = "upload" | "link";

export function CreatorPostComposer({
  token,
  initialPost = null,
  onPublished,
}: {
  token: string;
  initialPost?: CreatorPost | null;
  onPublished?: () => void;
}) {
  const isEditing = Boolean(initialPost);
  const [mediaType, setMediaType] = useState<CreatorPostMediaType>(initialPost?.mediaType ?? "text");
  const [imageUrl, setImageUrl] = useState<string | null>(initialPost?.mediaType === "image" ? initialPost.mediaUrl : null);
  const [videoSource, setVideoSource] = useState<VideoSource>(initialPost?.mediaType === "video" ? "link" : "upload");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [videoInputKey, setVideoInputKey] = useState(0);
  const [videoUrl, setVideoUrl] = useState(initialPost?.mediaType === "video" ? initialPost.mediaUrl : "");
  const [caption, setCaption] = useState(initialPost?.caption ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!videoPreviewUrl) return;
    return () => URL.revokeObjectURL(videoPreviewUrl);
  }, [videoPreviewUrl]);

  function handleVideoFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setError(null);
    setSuccess(false);
    if (!file) {
      setVideoFile(null);
      setVideoPreviewUrl(null);
      return;
    }
    try {
      validateVideoFile(file);
      setVideoFile(file);
      setVideoPreviewUrl(URL.createObjectURL(file));
    } catch (err) {
      setVideoFile(null);
      setVideoPreviewUrl(null);
      setVideoInputKey((key) => key + 1);
      setError(
        err instanceof HttpError ? err.message : "That video cannot be used.",
      );
    }
  }

  function clearVideoFile() {
    setVideoFile(null);
    setVideoPreviewUrl(null);
    setVideoInputKey((key) => key + 1);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const imageMediaUrl = mediaType === "image" ? imageUrl : null;
    const trimmedCaption = caption.trim();
    if (mediaType === "text" && !trimmedCaption) {
      setError("Write something before publishing.");
      return;
    }
    if (mediaType === "image" && !imageMediaUrl) {
      setError("Upload an image before publishing.");
      return;
    }
    if (mediaType === "video" && videoSource === "link" && !videoUrl.trim()) {
      setError("Add a YouTube or Vimeo link before publishing.");
      return;
    }
    if (mediaType === "video" && videoSource === "upload" && !videoFile) {
      setError("Choose a video before publishing.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(false);
    setUploadProgress(
      mediaType === "video" && videoSource === "upload" ? 0 : null,
    );
    try {
      const mediaUrl =
        mediaType === "text"
          ? ""
          : mediaType === "image"
            ? imageMediaUrl!
            : videoSource === "link"
              ? videoUrl.trim()
              : await uploadVideo(token, videoFile!, setUploadProgress);

      const input = {
        mediaType,
        mediaUrl,
        caption: trimmedCaption || undefined,
      };
      if (initialPost) {
        await updateCreatorPost(token, initialPost.id, input);
      } else {
        await createCreatorPost(token, input);
      }
      setImageUrl(null);
      clearVideoFile();
      setVideoUrl("");
      setCaption("");
      setSuccess(true);
      onPublished?.();
    } catch (err) {
      setError(
        err instanceof HttpError
          ? err.message
          : "Your post could not be published.",
      );
    } finally {
      setSubmitting(false);
      setUploadProgress(null);
    }
  }

  const postTypes: Array<{
    type: CreatorPostMediaType;
    label: string;
    hint: string;
    Icon: typeof DocumentTextIcon;
  }> = [
    { type: "text", label: "Text", hint: "Share an update", Icon: DocumentTextIcon },
    { type: "image", label: "Photo", hint: "Add a photo", Icon: PhotoIcon },
    { type: "video", label: "Video", hint: "Share a video", Icon: VideoCameraIcon },
  ];

  return (
    <section
      id="composer"
      aria-labelledby="creator-post-composer-heading"
      className="scroll-mt-24 overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_18px_60px_-32px_rgba(15,23,42,0.45)] dark:border-slate-800 dark:bg-slate-900 sm:scroll-mt-28"
    >
      <div className="bg-gradient-to-br from-brand-950 via-brand-800 to-brand-700 px-5 pb-6 pt-6 text-white sm:px-7 sm:pt-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-gold-200">
              Creator studio
            </p>
            <h2
              id="creator-post-composer-heading"
              className="mt-2 font-display text-2xl font-bold tracking-tight sm:text-3xl"
            >
              {isEditing ? "Edit your post" : "Create a post"}
            </h2>
            <p className="mt-2 max-w-lg text-sm leading-6 text-white/75">
              {isEditing
                ? "Update your caption or media, then save the changes."
                : "Share a thought, real photo, or video with the LIBERIA360 community."}
            </p>
          </div>
          <span className="hidden rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/80 sm:inline-flex">
            Public post
          </span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 p-4 sm:p-7">
        <div className="grid grid-cols-3 gap-2 rounded-2xl bg-slate-100 p-2 dark:bg-slate-800">
          {postTypes.map(({ type, label, hint, Icon }) => (
            <button
              key={type}
              type="button"
              onClick={() => {
                setMediaType(type);
                setError(null);
              }}
              aria-pressed={mediaType === type}
              className={`flex min-h-[76px] flex-col items-center justify-center gap-1.5 rounded-2xl px-2 py-2 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${mediaType === type ? "bg-white text-brand-800 shadow-sm ring-1 ring-brand-100 dark:bg-slate-700 dark:text-brand-100 dark:ring-brand-900" : "text-slate-500 hover:bg-white/70 hover:text-brand-700 dark:text-slate-400 dark:hover:bg-slate-700/60 dark:hover:text-brand-200"}`}
            >
              <Icon aria-hidden className="h-6 w-6" />
              <span className="text-sm font-bold">{label}</span>
              <span className="text-[11px] font-normal leading-4 opacity-75">{hint}</span>
            </button>
          ))}
        </div>

        {mediaType === "text" ? (
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
            Your post
            <textarea
              value={caption}
              onChange={(event) => setCaption(event.target.value)}
              maxLength={2000}
              rows={8}
              placeholder="Share a story, tip, question, or thought with your audience…"
              className="resize-y rounded-2xl border border-slate-300 px-4 py-4 text-base leading-7 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-950 dark:focus:ring-brand-950"
            />
            <span className="text-right text-xs font-normal text-slate-400">
              {caption.length}/2000
            </span>
          </label>
        ) : mediaType === "image" ? (
          <SingleImageUploader
            token={token}
            value={imageUrl}
            onChange={setImageUrl}
            label="Post photo"
            className="h-44 w-full"
          />
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 rounded-2xl bg-slate-100 p-1 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => {
                  setVideoSource("upload");
                  setError(null);
                }}
                className={`min-h-10 rounded-xl px-3 text-sm font-semibold ${videoSource === "upload" ? "bg-white text-brand-800 shadow-sm dark:bg-slate-700 dark:text-brand-200" : "text-slate-500 dark:text-slate-400"}`}
              >
                Upload video
              </button>
              <button
                type="button"
                onClick={() => {
                  setVideoSource("link");
                  setError(null);
                }}
                className={`min-h-10 rounded-xl px-3 text-sm font-semibold ${videoSource === "link" ? "bg-white text-brand-800 shadow-sm dark:bg-slate-700 dark:text-brand-200" : "text-slate-500 dark:text-slate-400"}`}
              >
                Use a link
              </button>
            </div>

            {videoSource === "upload" ? (
              <div className="space-y-3">
                <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-brand-300 bg-brand-50/50 px-4 py-4 text-center text-sm font-semibold text-brand-800 hover:bg-brand-50 dark:border-brand-800 dark:bg-brand-950/20 dark:text-brand-200 dark:hover:bg-brand-950/30">
                  <span>
                    {videoFile
                      ? videoFile.name
                      : "Choose a video from your device"}
                  </span>
                  <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                    MP4, WebM, QuickTime, or Ogg · up to 50MB
                  </span>
                  <input
                    key={videoInputKey}
                    type="file"
                    accept="video/mp4,video/webm,video/quicktime,video/ogg"
                    onChange={handleVideoFileChange}
                    className="sr-only"
                  />
                </label>
                {videoPreviewUrl && (
                  <div className="relative aspect-video overflow-hidden rounded-2xl">
                    <CreatorVideoThumbnail
                      src={videoPreviewUrl}
                      label="Video post preview"
                    />
                    <button
                      type="button"
                      onClick={clearVideoFile}
                      className="absolute right-2 top-2 z-10 rounded-full bg-black/65 px-3 py-1.5 text-xs font-semibold text-white hover:bg-black/80"
                    >
                      Remove
                    </button>
                  </div>
                )}
                {uploadProgress !== null && (
                  <div role="status" aria-live="polite" className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                      <span>Uploading video…</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                      <div
                        className="h-full rounded-full bg-brand-600 transition-[width]"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
                  Video URL
                  <input
                    type="url"
                    required
                    value={videoUrl}
                    onChange={(event) => setVideoUrl(event.target.value)}
                    maxLength={500}
                    placeholder="https://youtube.com/watch?v=…"
                    className="rounded-2xl border border-slate-300 px-3 py-3 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-950 dark:focus:ring-brand-950"
                  />
                </label>
                {videoUrl.trim() && (
                  <div className="aspect-video overflow-hidden rounded-2xl">
                    <CreatorVideoThumbnail
                      src={videoUrl.trim()}
                      poster={creatorVideoPosterUrl(videoUrl.trim())}
                      label="Video post preview"
                    />
                  </div>
                )}
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Use a YouTube or Vimeo link when the video is already hosted
                  elsewhere.
                </p>
              </div>
            )}
          </div>
        )}

        {mediaType !== "text" && (
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
            Caption
            <textarea
              value={caption}
              onChange={(event) => setCaption(event.target.value)}
              maxLength={2000}
              rows={4}
              placeholder="Tell your audience what this moment means…"
              className="resize-y rounded-2xl border border-slate-300 px-3 py-3 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-950 dark:focus:ring-brand-950"
            />
            <span className="text-right text-xs font-normal text-slate-400">
              {caption.length}/2000
            </span>
          </label>
        )}

        {error && (
          <p
            role="alert"
            className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/30 dark:text-rose-300"
          >
            {error}
          </p>
        )}
        {success && (
          <p
            role="status"
            className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
          >
            {isEditing ? "Post changes saved." : "Post published to the creator feed."}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="min-h-12 w-full rounded-2xl bg-brand-700 px-4 py-3 text-sm font-bold text-white hover:bg-brand-800 disabled:opacity-60"
        >
          {submitting
            ? mediaType === "video" && videoSource === "upload"
              ? "Uploading…"
              : isEditing
                ? "Saving…"
                : "Publishing…"
            : isEditing
              ? "Save changes"
              : "Publish post"}
        </button>
      </form>
    </section>
  );
}
