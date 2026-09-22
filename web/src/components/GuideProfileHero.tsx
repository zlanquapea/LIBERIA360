"use client";

import { useEffect, useState } from "react";
import {
  CalendarDaysIcon,
  CheckBadgeIcon,
  ChatBubbleLeftRightIcon,
  MapPinIcon,
  StarIcon,
} from "@heroicons/react/24/solid";
import { useAuth } from "@/hooks/useAuth";
import { getMyGuideProfile, updateMyGuideProfileImage } from "@/lib/guides-api";
import { HttpError } from "@/lib/http";
import type { GuideSummary } from "@/lib/api";
import { CreatorPhotoActionMenu } from "./CreatorPhotoActionMenu";

export function GuideProfileHero({
  guide,
  name,
}: {
  guide: GuideSummary;
  name: string;
}) {
  const { token, ready } = useAuth();
  const [isOwner, setIsOwner] = useState(false);
  const [imageUrl, setImageUrl] = useState(guide.profileImageUrl);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready || !token) return;
    let cancelled = false;
    getMyGuideProfile(token)
      .then((mine) => {
        if (!cancelled) setIsOwner(mine.id === guide.id);
      })
      .catch(() => {
        if (!cancelled) setIsOwner(false);
      });
    return () => {
      cancelled = true;
    };
  }, [guide.id, ready, token]);

  async function saveImage(url: string | null) {
    if (!token) return;
    setError(null);
    try {
      const updated = await updateMyGuideProfileImage(token, url);
      setImageUrl(updated.profileImageUrl);
    } catch (err) {
      setError(
        err instanceof HttpError
          ? err.message
          : "Profile photo could not be saved.",
      );
    }
  }

  return (
    <section className="rounded-3xl bg-white p-4 shadow-sm dark:bg-slate-900 sm:p-7">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        {isOwner ? (
          <CreatorPhotoActionMenu
            token={token ?? ""}
            value={imageUrl}
            onChange={(url) => {
              void saveImage(url);
            }}
            label="Guide profile photo"
            className="h-32 w-32 shrink-0 sm:h-44 sm:w-44"
          />
        ) : (
          <div className="h-32 w-32 shrink-0 overflow-hidden rounded-full border-8 border-amber-300 bg-brand-100 dark:bg-brand-950 sm:h-44 sm:w-44">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={name}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="flex h-full items-center justify-center text-5xl font-bold text-brand-800">
                {name.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-3xl font-extrabold capitalize tracking-tight text-slate-950 dark:text-slate-50 sm:text-4xl">
              {name}
            </h1>
            {isOwner && (
              <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-700 dark:bg-brand-950/40 dark:text-brand-300">
                Your guide profile
              </span>
            )}
          </div>
          <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-amber-400 px-3 py-1.5 text-sm font-bold text-slate-950">
            <CheckBadgeIcon className="h-5 w-5" /> Verified Guide
          </span>
          <p className="mt-3 text-base text-slate-600 dark:text-slate-300">
            <MapPinIcon className="mr-1 inline h-5 w-5 text-brand-700" />
            {guide.city}, Liberia
          </p>
          <p className="mt-2 text-base font-bold text-slate-800 dark:text-slate-200">
            <StarIcon className="mr-1 inline h-5 w-5 text-amber-400" />
            {guide.rating.toFixed(1)}{" "}
            <span className="font-normal text-slate-500">
              ({guide.reviewCount} reviews)
            </span>
          </p>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Languages: {guide.languages.join(" · ")}
          </p>
          {isOwner && (
            <p className="mt-2 text-xs text-slate-500">
              Tap the three-dot menu on your photo to view, upload, or delete
              it.
            </p>
          )}
          {error && (
            <p role="alert" className="mt-2 text-sm text-red-600">
              {error}
            </p>
          )}
        </div>
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {!isOwner && (
          <a
            href={
              guide.whatsappNumber
                ? `https://wa.me/${guide.whatsappNumber.replace(/\D/g, "")}`
                : undefined
            }
            className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-brand-700 px-5 font-bold text-white ${!guide.whatsappNumber ? "pointer-events-none opacity-50" : ""}`}
          >
            <ChatBubbleLeftRightIcon className="h-5 w-5" /> Message
          </a>
        )}
        <a
          href="#experiences"
          className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-full border-2 border-brand-700 px-5 font-bold text-brand-700 ${isOwner ? "sm:col-span-2" : ""}`}
        >
          <CalendarDaysIcon className="h-5 w-5" /> View Experiences
        </a>
      </div>
    </section>
  );
}
