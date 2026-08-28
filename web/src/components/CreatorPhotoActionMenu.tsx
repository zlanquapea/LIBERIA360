"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import {
  ArrowUpTrayIcon,
  EllipsisVerticalIcon,
  EyeIcon,
  MagnifyingGlassMinusIcon,
  MagnifyingGlassPlusIcon,
  TrashIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { uploadImage } from "@/lib/uploads-api";
import { resolveImageUrl } from "@/lib/images";
import { HttpError } from "@/lib/http";
import { SafeImage } from "./SafeImage";

function readImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("This image could not be read."));
    };
    image.src = objectUrl;
  });
}

async function cropImage(
  file: File,
  aspectRatio: number,
  zoom: number,
  positionX: number,
  positionY: number,
): Promise<File> {
  const image = await readImage(file);
  const sourceWidth = image.naturalWidth;
  const sourceHeight = image.naturalHeight;
  const sourceAspect = sourceWidth / sourceHeight;
  let cropWidth = sourceWidth;
  let cropHeight = sourceHeight;

  if (sourceAspect > aspectRatio) {
    cropWidth = sourceHeight * aspectRatio;
  } else {
    cropHeight = sourceWidth / aspectRatio;
  }

  cropWidth = Math.min(sourceWidth, cropWidth / zoom);
  cropHeight = Math.min(sourceHeight, cropHeight / zoom);
  const left = (sourceWidth - cropWidth) * (positionX / 100);
  const top = (sourceHeight - cropHeight) * (positionY / 100);
  const outputWidth = Math.min(1600, Math.max(800, Math.round(cropWidth)));
  const outputHeight = Math.max(1, Math.round(outputWidth / aspectRatio));
  const canvas = document.createElement("canvas");
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Your browser could not prepare this image.");
  context.imageSmoothingQuality = "high";
  context.drawImage(
    image,
    left,
    top,
    cropWidth,
    cropHeight,
    0,
    0,
    outputWidth,
    outputHeight,
  );

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.9),
  );
  if (!blob) throw new Error("Your browser could not prepare this image.");
  return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}-cropped.jpg`, {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}

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
  const [cropOpen, setCropOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [positionX, setPositionX] = useState(50);
  const [positionY, setPositionY] = useState(50);
  const inputRef = useRef<HTMLInputElement>(null);
  const isProfilePhoto = label.toLowerCase().includes("profile");
  const cropAspectRatio = isProfilePhoto ? 1 : 3.2;

  useEffect(() => {
    if (!viewerOpen && !cropOpen) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !uploading) {
        setViewerOpen(false);
        setCropOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [viewerOpen, cropOpen, uploading]);

  useEffect(() => {
    return () => {
      if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
    };
  }, [pendingPreviewUrl]);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError(null);
    setPendingFile(file);
    setPendingPreviewUrl(URL.createObjectURL(file));
    setZoom(1);
    setPositionX(50);
    setPositionY(50);
    setCropOpen(true);
    setMenuOpen(false);
  }

  function cancelCrop() {
    if (uploading) return;
    setCropOpen(false);
    setPendingFile(null);
    setPendingPreviewUrl(null);
  }

  async function confirmCropAndUpload() {
    if (!pendingFile) return;
    setError(null);
    setUploading(true);
    try {
      const croppedFile = await cropImage(
        pendingFile,
        cropAspectRatio,
        zoom,
        positionX,
        positionY,
      );
      const uploadedUrl = await uploadImage(token, croppedFile);
      onChange(uploadedUrl);
      setCropOpen(false);
      setPendingFile(null);
      setPendingPreviewUrl(null);
    } catch (err) {
      setError(
        err instanceof HttpError
          ? err.message
          : err instanceof Error
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
              fallback={<p className="text-sm text-white/70">Image unavailable</p>}
            />
          </div>
        </div>
      )}

      {cropOpen && pendingPreviewUrl && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={`${label.replaceAll(" ", "-")}-crop-title`}
          className="fixed inset-0 z-[2200] flex min-h-[100dvh] items-center justify-center overflow-y-auto bg-slate-950/90 p-4 text-white backdrop-blur-sm sm:p-6"
        >
          <div className="w-full max-w-xl rounded-[2rem] border border-white/10 bg-slate-900 p-4 shadow-2xl sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-gold-300">
                  Preview before upload
                </p>
                <h2 id={`${label.replaceAll(" ", "-")}-crop-title`} className="mt-1 text-xl font-bold">
                  Adjust {label.toLowerCase()}
                </h2>
                <p className="mt-1 text-sm leading-5 text-white/65">
                  Move the sliders to frame the part of the photo you want people to see.
                </p>
              </div>
              <button
                type="button"
                aria-label="Close photo crop preview"
                onClick={cancelCrop}
                disabled={uploading}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-50"
              >
                <XMarkIcon aria-hidden className="h-6 w-6" />
              </button>
            </div>

            <div
              className={`mx-auto mt-5 w-full max-w-lg overflow-hidden rounded-2xl bg-black ring-1 ring-white/10 ${isProfilePhoto ? "aspect-square" : "aspect-[16/6]"}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={pendingPreviewUrl}
                alt={`${label} crop preview`}
                className="h-full w-full object-cover"
                style={{
                  objectPosition: `${positionX}% ${positionY}%`,
                  transform: `scale(${zoom})`,
                }}
              />
            </div>

            <div className="mt-5 space-y-4">
              <label className="block text-sm font-medium text-white/85">
                <span className="mb-2 flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-2"><MagnifyingGlassMinusIcon aria-hidden className="h-4 w-4" /> Zoom</span>
                  <span className="text-xs text-white/55">{zoom.toFixed(1)}×</span>
                </span>
                <input
                  type="range"
                  min="1"
                  max="3"
                  step="0.1"
                  value={zoom}
                  onChange={(event) => setZoom(Number(event.target.value))}
                  className="w-full accent-brand-500"
                  aria-label="Zoom photo"
                />
                <MagnifyingGlassPlusIcon aria-hidden className="ml-auto mt-1 h-4 w-4" />
              </label>
              <label className="block text-sm font-medium text-white/85">
                <span className="mb-2 flex justify-between gap-3"><span>Horizontal position</span><span className="text-xs text-white/55">{Math.round(positionX)}%</span></span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={positionX}
                  onChange={(event) => setPositionX(Number(event.target.value))}
                  className="w-full accent-brand-500"
                  aria-label="Horizontal photo position"
                />
              </label>
              <label className="block text-sm font-medium text-white/85">
                <span className="mb-2 flex justify-between gap-3"><span>Vertical position</span><span className="text-xs text-white/55">{Math.round(positionY)}%</span></span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={positionY}
                  onChange={(event) => setPositionY(Number(event.target.value))}
                  className="w-full accent-brand-500"
                  aria-label="Vertical photo position"
                />
              </label>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={cancelCrop}
                disabled={uploading}
                className="min-h-11 rounded-full border border-white/20 px-5 text-sm font-semibold text-white/80 hover:bg-white/10 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmCropAndUpload}
                disabled={uploading}
                className="min-h-11 rounded-full bg-brand-500 px-5 text-sm font-bold text-white hover:bg-brand-400 disabled:opacity-60"
              >
                {uploading ? "Cropping & uploading…" : "Crop & upload"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
