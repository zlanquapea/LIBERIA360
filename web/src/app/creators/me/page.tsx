'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { createCreatorProfile, getMyCreatorProfile, updateCreatorProfile } from '@/lib/creator-api';
import { HttpError } from '@/lib/http';
import type { Creator } from '@/lib/types';

function splitList(value: string): string[] {
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

// "Become a creator" self-service form (Tech Spec §3.2, §5 Creator).
// Loads the signed-in user's existing profile (if any) and switches between
// create (POST /creators) and edit (PATCH /creators/me) accordingly.
export default function MyCreatorProfilePage() {
  const { user, token, ready } = useAuth();
  const [creator, setCreator] = useState<Creator | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [instagram, setInstagram] = useState('');
  const [tiktok, setTiktok] = useState('');
  const [youtube, setYoutube] = useState('');
  const [specialties, setSpecialties] = useState('');
  const [locationsCovered, setLocationsCovered] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!ready || !token) {
      if (ready) setLoadingProfile(false);
      return;
    }
    let cancelled = false;
    getMyCreatorProfile(token).then((existing) => {
      if (cancelled) return;
      setCreator(existing);
      if (existing) {
        setName(existing.name);
        setUsername(existing.username);
        setBio(existing.bio ?? '');
        setInstagram(existing.instagram ?? '');
        setTiktok(existing.tiktok ?? '');
        setYoutube(existing.youtube ?? '');
        setSpecialties(existing.specialties.join(', '));
        setLocationsCovered(existing.locationsCovered.join(', '));
      } else if (user) {
        setName(user.name);
      }
      setLoadingProfile(false);
    });
    return () => {
      cancelled = true;
    };
  }, [ready, token, user]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true);
    setError(null);
    setSaved(false);
    const input = {
      name,
      username,
      bio: bio.trim() || undefined,
      instagram: instagram.trim() || undefined,
      tiktok: tiktok.trim() || undefined,
      youtube: youtube.trim() || undefined,
      specialties: splitList(specialties),
      locationsCovered: splitList(locationsCovered),
    };
    try {
      const result = creator ? await updateCreatorProfile(token, input) : await createCreatorProfile(token, input);
      setCreator(result);
      setSaved(true);
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!ready || loadingProfile) {
    return (
      <main className="mx-auto flex max-w-sm flex-col gap-4 px-4 py-10">
        <p className="text-sm text-slate-500">Loading…</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto flex max-w-sm flex-col gap-4 px-4 py-10 text-center">
        <h1 className="text-xl font-bold text-slate-900">Become a creator</h1>
        <p className="text-sm text-slate-500">Log in to set up your creator profile.</p>
        <Link
          href="/login"
          className="mx-auto rounded-full bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-800"
        >
          Log in
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-sm flex-col gap-6 px-4 py-10">
      <div>
        <h1 className="text-xl font-bold text-slate-900">{creator ? 'Edit your creator profile' : 'Become a creator'}</h1>
        <p className="text-sm text-slate-500">
          {creator
            ? 'Update your public creator profile.'
            : 'Share your videos, photos, and guides with LIBERIA360 travelers.'}
        </p>
        {creator && (
          <Link href={`/creators/${creator.username}`} className="mt-1 inline-block text-sm text-brand-700 hover:underline">
            View public profile →
          </Link>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          Name
          <input
            type="text"
            required
            maxLength={150}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          Username
          <input
            type="text"
            required
            maxLength={50}
            pattern="[a-z0-9_.]+"
            title="Lowercase letters, numbers, dots, and underscores only"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
          />
          <span className="text-xs font-normal text-slate-400">Lowercase letters, numbers, dots, and underscores only.</span>
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          Bio
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={1000}
            rows={3}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
          />
        </label>

        <div className="grid grid-cols-1 gap-3">
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Instagram handle
            <input
              type="text"
              maxLength={100}
              value={instagram}
              onChange={(e) => setInstagram(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            TikTok handle
            <input
              type="text"
              maxLength={100}
              value={tiktok}
              onChange={(e) => setTiktok(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            YouTube handle
            <input
              type="text"
              maxLength={100}
              value={youtube}
              onChange={(e) => setYoutube(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
            />
          </label>
        </div>

        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          Specialties
          <input
            type="text"
            placeholder="waterfalls, street food, nightlife"
            value={specialties}
            onChange={(e) => setSpecialties(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
          />
          <span className="text-xs font-normal text-slate-400">Comma-separated.</span>
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          Locations covered
          <input
            type="text"
            placeholder="Montserrado, Bomi"
            value={locationsCovered}
            onChange={(e) => setLocationsCovered(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
          />
          <span className="text-xs font-normal text-slate-400">Comma-separated.</span>
        </label>

        {error && (
          <p role="alert" className="rounded-lg bg-flag-500/10 px-3 py-2 text-sm text-flag-700">
            {error}
          </p>
        )}
        {saved && !error && <p className="text-sm text-emerald-700">Saved!</p>}

        <button
          type="submit"
          disabled={submitting}
          className="rounded-full bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
        >
          {submitting ? 'Saving…' : creator ? 'Save changes' : 'Create profile'}
        </button>
      </form>
    </main>
  );
}
