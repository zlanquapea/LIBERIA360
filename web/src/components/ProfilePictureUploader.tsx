"use client";

import { useRef, useState } from "react";
import { CameraIcon } from "@heroicons/react/24/outline";
import { useAuth } from "@/hooks/useAuth";
import { uploadImage } from "@/lib/uploads-api";
import { resolveImageUrl, resolveThumbUrl } from "@/lib/images";
import { getFriendlyErrorMessage } from "@/lib/errors";
import { ConfirmDialog } from "./ConfirmDialog";
import { SafeImage } from "./SafeImage";
import type { AuthUser } from "@/lib/types";

// Facebook-style account photo: a circular avatar with a small camera
// button overlaid at its edge. Picking a file uploads and applies it
// immediately — no separate "Save" step, since this is one dedicated
// action rather than a field bundled into a bigger form (contrast
// AccountPage's ProfileEditor, which batches several fields behind one
// Save button on purpose).
export function ProfilePictureUploader({ user }: { user: AuthUser }) {
  const { token, updateProfile } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const initial = user.name.trim().charAt(0).toUpperCase() || "?";

  async function handleFile(file: File | undefined) {
    if (!file || !token) return;
    setError(null);
    setUploading(true);
    try {
      const url = await uploadImage(token, file);
      await updateProfile({ profileImage: url });
    } catch (err) {
      setError(
        getFriendlyErrorMessage(err, {
          context: { action: "upload-profile-picture" },
        }),
      );
    } finally {
      setUploading(false);
      // Lets picking the same file again re-trigger onChange (e.g. after
      // a failed upload the user wants to retry with the same photo).
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function confirmRemove() {
    if (!token) return;
    setRemoving(true);
    setRemoveError(null);
    try {
      await updateProfile({ profileImage: null });
      setConfirmingRemove(false);
    } catch (err) {
      setRemoveError(
        getFriendlyErrorMessage(err, {
          context: { action: "remove-profile-picture" },
        }),
      );
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-1 sm:items-start">
      <div className="relative">
        <span className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-brand-700 text-xl font-semibold text-white">
          {user.profileImage ? (
            <SafeImage
              src={resolveImageUrl(user.profileImage)}
              thumbSrc={resolveThumbUrl(user.profileImage)}
              alt=""
              className="h-full w-full object-cover"
              fallback={<>{initial}</>}
            />
          ) : (
            initial
          )}
        </span>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          aria-label={
            user.profileImage ? "Change profile photo" : "Add profile photo"
          }
          className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-brand-700 text-white shadow-sm transition-colors hover:bg-brand-800 disabled:opacity-60 dark:border-slate-950"
        >
          <CameraIcon aria-hidden className="h-3.5 w-3.5" />
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="sr-only"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </div>
      {uploading && (
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          Uploading…
        </p>
      )}
      {!uploading && user.profileImage && (
        <button
          type="button"
          onClick={() => setConfirmingRemove(true)}
          className="text-[11px] font-medium text-slate-500 hover:text-flag-600 dark:text-slate-400 dark:hover:text-flag-300"
        >
          Remove photo
        </button>
      )}
      {error && (
        <p role="alert" className="text-[11px] text-flag-700 dark:text-flag-300">
          {error}
        </p>
      )}

      <ConfirmDialog
        open={confirmingRemove}
        title="Remove your profile photo?"
        description="Your account will show your initial instead."
        confirmLabel="Remove"
        loadingLabel="Removing…"
        isLoading={removing}
        error={removeError}
        onConfirm={confirmRemove}
        onCancel={() => {
          if (removing) return;
          setConfirmingRemove(false);
          setRemoveError(null);
        }}
      />
    </div>
  );
}
