"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { ArrowLeftIcon, CameraIcon, CheckIcon, ChevronLeftIcon, ChevronRightIcon, EllipsisHorizontalIcon, PhotoIcon, PlusIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { useAuth } from "@/hooks/useAuth";
import { HttpError } from "@/lib/http";
import { createCreatorStory, getActiveCreatorStories, getCreatorStoryEligibility, recordCreatorStoryView, reportCreatorStory, type CreatorStoryInput } from "@/lib/creator-feed-api";
import type { CreatorStory } from "@/lib/types";
import { SingleImageUploader } from "./SingleImageUploader";
import { uploadVideo, validateVideoFile } from "@/lib/video-uploads-api";

const PHOTO_DURATION_MS = 6000;

export function CreatorStories() {
  const { token, ready } = useAuth();
  const [stories, setStories] = useState<CreatorStory[]>([]);
  const [canCreateStory, setCanCreateStory] = useState(false);
  const [loading, setLoading] = useState(true);
  const [composerOpen, setComposerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    setLoading(true);
    if (token) {
      getCreatorStoryEligibility(token)
        .then((result) => { if (!cancelled) setCanCreateStory(result.eligible); })
        .catch(() => { if (!cancelled) setCanCreateStory(false); });
    } else {
      setCanCreateStory(false);
    }
    getActiveCreatorStories(token || undefined)
      .then((items) => { if (!cancelled) setStories(items); })
      .catch(() => { if (!cancelled) setStories([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [ready, token]);

  const creators = useMemo(() => {
    const seen = new Set<string>();
    return stories.filter((story) => {
      if (seen.has(story.creatorId)) return false;
      seen.add(story.creatorId);
      return true;
    });
  }, [stories]);

  function handlePublished(story: CreatorStory) {
    setStories((current) => [story, ...current.filter((item) => item.id !== story.id)]);
    setComposerOpen(false);
  }

  return (
    <>
      <section aria-labelledby="creator-stories-heading" className="mb-7">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand-700 dark:text-brand-300">Fresh from the community</p>
            <h2 id="creator-stories-heading" className="mt-1 font-display text-xl font-bold text-slate-950 dark:text-white">Creator Stories</h2>
          </div>
          <Link href="/creators" className="text-sm font-bold text-brand-700 hover:underline dark:text-brand-300">See all</Link>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Active creator stories">
          {canCreateStory && <button type="button" onClick={() => setComposerOpen(true)} className="group flex w-[82px] shrink-0 flex-col items-center gap-1.5 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2">
            <span className="relative flex h-[68px] w-[68px] items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-brand-400 bg-brand-50 text-brand-800 dark:border-brand-500 dark:bg-brand-950/40 dark:text-brand-200"><PlusIcon aria-hidden className="h-7 w-7 transition-transform group-hover:scale-110" /></span>
            <span className="w-full truncate text-xs font-bold text-slate-800 dark:text-slate-200">Create story</span>
          </button>}
          {!loading && creators.map((story) => <button key={story.creatorId} type="button" onClick={() => setViewerIndex(stories.findIndex((item) => item.id === story.id))} className="group flex w-[82px] shrink-0 flex-col items-center gap-1.5 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2">
            <span className="relative block h-[68px] w-[68px] rounded-full bg-gradient-to-br from-brand-700 via-gold-400 to-emerald-500 p-[3px]"><span className="block h-full w-full overflow-hidden rounded-full border-2 border-white bg-slate-100 dark:border-slate-900">{story.creator.profileImage ? <img src={story.creator.profileImage} alt="" className="h-full w-full object-cover" /> : <span className="flex h-full w-full items-center justify-center text-xl font-bold text-brand-800">{story.creator.name.slice(0, 1)}</span>}</span></span>
            <span className="w-full truncate text-xs font-semibold text-slate-800 dark:text-slate-200">{story.creator.name}</span>
          </button>)}
          {!loading && creators.length === 0 && !token && <p className="py-4 text-sm text-slate-500 dark:text-slate-400">Sign in to view and create creator stories.</p>}
        </div>
      </section>
      {composerOpen && <StoryComposer token={token!} onClose={() => setComposerOpen(false)} onPublished={handlePublished} />}
      {viewerIndex !== null && <StoryViewer stories={stories} initialIndex={viewerIndex} token={token} onClose={() => setViewerIndex(null)} />}
    </>
  );
}

function StoryComposer({ token, onClose, onPublished }: { token: string; onClose: () => void; onPublished: (story: CreatorStory) => void }) {
  const [mediaType, setMediaType] = useState<"image" | "video">("image");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [previewing, setPreviewing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function chooseVideo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      validateVideoFile(file);
      setVideoFile(file);
      setVideoPreview(URL.createObjectURL(file));
      setError(null);
    } catch (err) {
      setVideoFile(null);
      setVideoPreview(null);
      setError(err instanceof HttpError ? err.message : "That video cannot be used.");
    }
  }

  async function publish() {
    if (mediaType === "image" && !imageUrl) return setError("Add a photo before publishing.");
    if (mediaType === "video" && !videoFile) return setError("Choose a video before publishing.");
    setSubmitting(true); setError(null);
    try {
      const mediaUrl = mediaType === "image" ? imageUrl! : await uploadVideo(token, videoFile!);
      const input: CreatorStoryInput = { mediaType, mediaUrl, caption: caption.trim() || undefined };
      const story = await createCreatorStory(token, input);
      onPublished(story);
    } catch (err) {
      setError(err instanceof HttpError ? err.message : "Your story could not be published. Please try again.");
    } finally { setSubmitting(false); }
  }

  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/70 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="story-composer-title">
    <section className="max-h-[94vh] w-full max-w-xl overflow-y-auto rounded-t-[2rem] bg-white shadow-2xl dark:bg-slate-900 sm:rounded-[2rem]">
      <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800"><button type="button" onClick={onClose} className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:text-slate-300 dark:hover:bg-slate-800" aria-label="Close story composer"><XMarkIcon className="h-6 w-6" /></button><h2 id="story-composer-title" className="font-display text-lg font-bold text-slate-950 dark:text-white">Create a Story</h2><button type="button" onClick={() => void publish()} disabled={submitting || previewing} className="min-h-11 rounded-full bg-brand-800 px-4 text-sm font-bold text-white disabled:opacity-50">{submitting ? "Publishing…" : "Publish"}</button></header>
      <div className="space-y-5 p-5">
        {previewing ? <div className="relative flex aspect-[9/16] max-h-[56vh] items-end overflow-hidden rounded-[1.5rem] bg-slate-950 p-5 text-white">{mediaType === "image" && imageUrl ? <img src={imageUrl} alt="Story preview" className="absolute inset-0 h-full w-full object-cover opacity-90" /> : videoPreview ? <video src={videoPreview} controls className="absolute inset-0 h-full w-full object-contain" /> : null}<div className="relative z-10 w-full rounded-xl bg-black/35 p-3 text-center text-lg font-semibold">{caption || "Your story caption"}</div></div> : <>
          <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1 dark:bg-slate-800"><button type="button" onClick={() => setMediaType("image")} aria-pressed={mediaType === "image"} className={`flex min-h-12 items-center justify-center gap-2 rounded-xl text-sm font-bold ${mediaType === "image" ? "bg-white text-brand-800 shadow-sm dark:bg-slate-700 dark:text-white" : "text-slate-500"}`}><PhotoIcon className="h-5 w-5" /> Photo</button><button type="button" onClick={() => setMediaType("video")} aria-pressed={mediaType === "video"} className={`flex min-h-12 items-center justify-center gap-2 rounded-xl text-sm font-bold ${mediaType === "video" ? "bg-white text-brand-800 shadow-sm dark:bg-slate-700 dark:text-white" : "text-slate-500"}`}><CameraIcon className="h-5 w-5" /> Video</button></div>
          {mediaType === "image" ? <SingleImageUploader token={token} value={imageUrl} onChange={setImageUrl} label="Story photo" className="h-56 w-full" /> : <label className="flex min-h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-brand-300 bg-brand-50 px-5 text-center text-sm font-semibold text-brand-800 dark:border-brand-800 dark:bg-brand-950/30 dark:text-brand-200">{videoPreview ? <video src={videoPreview} controls className="max-h-44 w-full rounded-xl object-contain" /> : <><CameraIcon className="h-8 w-8" /><span>Choose a short video</span><span className="text-xs font-normal text-slate-500">Use the existing video validation rules.</span></>}<input type="file" accept="video/mp4,video/webm,video/quicktime,video/ogg" onChange={chooseVideo} className="sr-only" /></label>}
          <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700 dark:text-slate-200">Caption or text overlay <textarea value={caption} onChange={(event) => setCaption(event.target.value)} maxLength={280} rows={3} placeholder="Share a moment from Liberia…" className="mt-1 resize-none rounded-2xl border border-slate-300 px-3 py-3 text-base outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-950" /><span className="text-right text-xs font-normal text-slate-400">{caption.length}/280</span></label>
        </>}
        {error && <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">{error}</p>}
        <div className="flex items-center justify-between gap-3"><button type="button" onClick={() => previewing ? setPreviewing(false) : onClose()} className="flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-bold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">{previewing ? <><ArrowLeftIcon className="h-4 w-4" /> Back</> : "Cancel"}</button>{!previewing && <button type="button" onClick={() => setPreviewing(true)} className="min-h-11 rounded-full border border-brand-200 px-5 text-sm font-bold text-brand-800 hover:bg-brand-50 dark:border-brand-800 dark:text-brand-200">Preview</button>}</div>
      </div>
    </section>
  </div>;
}

function StoryViewer({ stories, initialIndex, token, onClose }: { stories: CreatorStory[]; initialIndex: number; token: string | null; onClose: () => void }) {
  const [index, setIndex] = useState(initialIndex);
  const [paused, setPaused] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reported, setReported] = useState(false);
  const story = stories[index];
  const progressRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!story) return;
    if (token) void recordCreatorStoryView(token, story.id).catch(() => undefined);
    if (paused || story.mediaType === "video") return;
    const timer = window.setTimeout(() => setIndex((current) => current + 1 < stories.length ? current + 1 : 0), PHOTO_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [index, paused, story, stories.length, token]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") setIndex((current) => Math.min(stories.length - 1, current + 1));
      if (event.key === "ArrowLeft") setIndex((current) => Math.max(0, current - 1));
      if (event.key === " ") setPaused((current) => !current);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, stories.length]);

  if (!story) return null;
  async function report() { if (!token) return; await reportCreatorStory(token, story.id, "Reported by viewer").catch(() => undefined); setReported(true); setMenuOpen(false); }
  return <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950" role="dialog" aria-modal="true" aria-label={`${story.creator.name}'s story`} onMouseDown={() => setPaused(true)} onMouseUp={() => setPaused(false)} onTouchStart={() => setPaused(true)} onTouchEnd={() => setPaused(false)}>
    <div className="relative flex h-full w-full max-w-2xl flex-col overflow-hidden bg-slate-950 sm:h-[92vh] sm:rounded-[2rem]">
      <div className="relative z-10 flex gap-1 px-4 pt-4">{stories.map((item, itemIndex) => <div key={item.id} className="h-1 flex-1 overflow-hidden rounded-full bg-white/25"><div ref={itemIndex === index ? progressRef : undefined} className={`h-full origin-left bg-white ${itemIndex < index ? "w-full" : itemIndex > index ? "w-0" : "w-full"} ${itemIndex === index && !paused ? "animate-[story-progress_6s_linear]" : ""}`} /></div>)}</div>
      <div className="relative z-10 flex items-center justify-between px-4 py-4 text-white"><div className="flex items-center gap-3"><div className="h-10 w-10 overflow-hidden rounded-full bg-brand-700">{story.creator.profileImage ? <img src={story.creator.profileImage} alt="" className="h-full w-full object-cover" /> : <span className="flex h-full w-full items-center justify-center font-bold">{story.creator.name.slice(0, 1)}</span>}</div><div><p className="text-sm font-bold">{story.creator.name}</p><p className="text-xs text-white/65">{story.publishedAt ? new Date(story.publishedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "Now"}</p></div></div><div className="relative flex items-center gap-1"><button type="button" onClick={() => setMenuOpen((current) => !current)} className="flex min-h-11 min-w-11 items-center justify-center rounded-full hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white" aria-label="Story actions"><EllipsisHorizontalIcon className="h-6 w-6" /></button>{menuOpen && <div className="absolute right-0 top-12 z-20 w-44 rounded-2xl bg-white p-1 text-slate-900 shadow-xl"><button type="button" onClick={() => void report()} disabled={reported} className="flex min-h-11 w-full items-center rounded-xl px-3 text-left text-sm font-semibold hover:bg-slate-100">{reported ? "Reported" : "Report story"}</button></div>}<button type="button" onClick={onClose} className="flex min-h-11 min-w-11 items-center justify-center rounded-full hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white" aria-label="Close story viewer"><XMarkIcon className="h-6 w-6" /></button></div></div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center" onClick={(event) => { const rect = event.currentTarget.getBoundingClientRect(); setIndex((current) => event.clientX - rect.left < rect.width / 2 ? Math.max(0, current - 1) : Math.min(stories.length - 1, current + 1)); }}>
        {story.mediaType === "image" ? <img src={story.mediaUrl} alt={story.caption || `${story.creator.name}'s story`} className="h-full w-full object-contain" /> : <video src={story.mediaUrl} controls autoPlay className="h-full w-full object-contain" />}
        {story.caption && <p className="pointer-events-none absolute bottom-8 left-5 right-5 rounded-2xl bg-black/45 px-4 py-3 text-center text-base font-semibold text-white">{story.caption}</p>}
        <button type="button" onClick={(event) => { event.stopPropagation(); setIndex((current) => Math.max(0, current - 1)); }} className="absolute left-2 top-1/2 flex min-h-11 min-w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/25 text-white hover:bg-black/45" aria-label="Previous story"><ChevronLeftIcon className="h-7 w-7" /></button>
        <button type="button" onClick={(event) => { event.stopPropagation(); setIndex((current) => Math.min(stories.length - 1, current + 1)); }} className="absolute right-2 top-1/2 flex min-h-11 min-w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/25 text-white hover:bg-black/45" aria-label="Next story"><ChevronRightIcon className="h-7 w-7" /></button>
      </div>
      <div className="relative z-10 flex items-center justify-center gap-2 px-4 pb-5 pt-3 text-xs text-white/65"><CheckIcon className="h-4 w-4" /> {paused ? "Paused" : "Tap either side to navigate"}</div>
    </div>
    <style jsx>{`@keyframes story-progress { from { transform: scaleX(0); } to { transform: scaleX(1); } } @media (prefers-reduced-motion: reduce) { .animate-\[story-progress_6s_linear\] { animation: none; } }`}</style>
  </div>;
}
