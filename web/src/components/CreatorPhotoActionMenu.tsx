"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import {
  ArrowUpTrayIcon,
  EllipsisVerticalIcon,
  EyeIcon,
  TrashIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { uploadImage } from "@/lib/uploads-api";
import { resolveImageUrl } from "@/lib/images";
import { HttpError } from "@/lib/http";
import { SafeImage } from "./SafeImage";

export function CreatorPhotoActionMenu({
  token,
  value,
  onChange,
  label,
  className = "h-28 w-28",
}: {
  token: string;
  value: string | null;
  onChange: (url: string | null) => void;
  label: string;
  className?: string;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!viewerOpen) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setViewerOpen(false);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [viewerOpen]);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const uploadedUrl = await uploadImage(token, file);
      onChange(uploadedUrl);
      setMenuOpen(false);
    } catch (err) {
      setError(
        err instanceof HttpError
          ? err.message
          : "Photo upload failed. Please try again.",
      );
    } finally {
      setUploading(false);
    }
  }

  function handleDelete() {
    onChange(null);
    setMenuOpen(false);
    setViewerOpen(false);
    setError(null);
  }

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
          {label}
        </p>
        <div className="relative">
          <button
            type="button"
            aria-label={`${label} actions`}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm hover:border-brand-300 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:text-brand-200"
          >
            <EllipsisVerticalIcon aria-hidden className="h-5 w-5" />
          </button>
          {menuOpen && (
            <div
              role="menu"
              aria-label={`${label} menu`}
              className="absolute right-0 top-11 z-30 w-56 overflow-hidden rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-900"
            >
              <button
                type="button"
                role="menuitem"
                disabled={!value}
                onClick={() => {
                  setViewerOpen(true);
                  setMenuOpen(false);
                }}
                className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-45 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <EyeIcon aria-hidden className="h-5 w-5 text-brand-700 dark:text-brand-300" />
                View {label.toLowerCase()}
              </button>
              <button
                type="button"
                role="menuitem"
                disabled={uploading}
                onClick={() => inputRef.current?.click()}
                className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-45 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <ArrowUpTrayIcon aria-hidden className="h-5 w-5 text-brand-700 dark:text-brand-300" />
                {uploading ? "Uploading…" : "Upload photo"}
              </button>
              <button
                type="button"
                role="menuitem"
                disabled={!value || uploading}
                onClick={handleDelete}
                className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-medium text-flag-700 hover:bg-flag-50 disabled:cursor-not-allowed disabled:opacity-45 dark:text-flag-300 dark:hover:bg-flag-950/30"
              >
                <TrashIcon aria-hidden className="h-5 w-5" />
                Delete photo
              </button>
            </div>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={() => setMenuOpen((open) => !open)}
        aria-label={`${label} actions`}
        className={`group relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 text-left shadow-sm transition hover:border-brand-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-slate-700 dark:bg-slate-800 ${className}`}
      >
        {value ? (
          <SafeImage
            src={resolveImageUrl(value)}
            alt={`${label} preview`}
            className="h-full w-full object-cover"
            fallback={
              <span className="flex h-full w-full items-center justify-center px-3 text-center text-xs text-slate-500 dark:text-slate-400">
                Image unavailable
              </span>
            }
          />
        ) : (
          <span className="flex h-full w-full flex-col items-center justify-center gap-1 px-3 text-center text-xs font-medium text-slate-500 dark:text-slate-400">
            <ArrowUpTrayIcon aria-hidden className="h-6 w-6 text-brand-600 dark:text-brand-300" />
            Add {label.toLowerCase()}
          </span>
        )}
        <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-3 pb-2 pt-7 text-xs font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
          Manage photo
        </span>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        disabled={uploading}
        onChange={handleFileChange}
        className="sr-only"
      />

      {error && (
        <p role="alert" className="max-w-56 text-xs text-flag-700 dark:text-flag-300">
          {error}
        </p>
      )}

      {viewerOpen && value && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`View ${label.toLowerCase()}`}
          className="fixed inset-0 z-[2100] flex min-h-[100dvh] items-center justify-center bg-black/95 p-4 text-white"
          onClick={() => setViewerOpen(false)}
        >
          <button
            type="button"
            aria-label={`Close ${label.toLowerCase()} viewer`}
            onClick={() => setViewerOpen(false)}
            className="absolute right-4 top-[calc(1rem+env(safe-area-inset-top))] flex h-11 w-11 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
          >
            <XMarkIcon aria-hidden className="h-7 w-7" />
          </button>
          <div onClick={(event) => event.stopPropagation()}>
            <SafeImage
              src={resolveImageUrl(value)}
              alt={label}
              className="max-h-[90dvh] max-w-full object-contain"
              fallback={
                <p className="text-sm text-white/70">Image unavailable</p>
              }
            />
          </div>
        </div>
      )}
    </div>
  );
}
