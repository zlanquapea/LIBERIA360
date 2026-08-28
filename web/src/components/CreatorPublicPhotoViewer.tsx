"use client";

import { useEffect, useState, type ReactNode } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { resolveImageUrl } from "@/lib/images";
import { SafeImage } from "./SafeImage";

export function CreatorPublicPhotoViewer({
  src,
  thumbSrc,
  alt,
  label,
  className,
  fallback,
}: {
  src: string | null;
  thumbSrc?: string | null;
  alt: string;
  label: string;
  className: string;
  fallback: ReactNode;
}) {
  return <PublicPhotoViewerButton {...{ src, thumbSrc, alt, label, className, fallback }} />;
}

function PublicPhotoViewerButton({
  src,
  thumbSrc,
  alt,
  label,
  className,
  fallback,
}: {
  src: string | null;
  thumbSrc?: string | null;
  alt: string;
  label: string;
  className: string;
  fallback: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  return (
    <>
      <button
        type="button"
        disabled={!src}
        onClick={() => setOpen(true)}
        aria-label={src ? `View ${label}` : `${label} unavailable`}
        className={`group relative block overflow-hidden text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${!src ? "cursor-default" : "cursor-zoom-in"}`}
      >
        <SafeImage
          src={src ? resolveImageUrl(src) : null}
          thumbSrc={thumbSrc ? resolveImageUrl(thumbSrc) : null}
          alt={alt}
          className={className}
          fallback={fallback}
        />
        {src && (
          <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 to-transparent px-3 pb-2 pt-8 text-xs font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
            View photo
          </span>
        )}
      </button>

      {open && src && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`View ${label}`}
          className="fixed inset-0 z-[2100] flex min-h-[100dvh] items-center justify-center bg-black/95 p-4 text-white"
          onClick={() => setOpen(false)}
        >
          <button
            type="button"
            aria-label={`Close ${label} viewer`}
            onClick={() => setOpen(false)}
            className="absolute right-4 top-[calc(1rem+env(safe-area-inset-top))] flex h-11 w-11 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
          >
            <XMarkIcon aria-hidden className="h-7 w-7" />
          </button>
          <div onClick={(event) => event.stopPropagation()}>
            <SafeImage
              src={resolveImageUrl(src)}
              alt={alt}
              className="max-h-[90dvh] max-w-full object-contain"
              fallback={<p className="text-sm text-white/70">Image unavailable</p>}
            />
          </div>
        </div>
      )}
    </>
  );
}
