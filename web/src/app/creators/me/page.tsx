'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '@/hooks/useAuth';
import {
  createCreatorProfile,
  getMyCreatorProfile,
  updateCreatorProfile,
  type CreatorProfileInput,
} from '@/lib/creator-api';
import { getCounties } from '@/lib/api';
import { CountySelect } from '@/components/ProfileFields';
import { SingleImageUploader } from '@/components/SingleImageUploader';
import { CreatorPortfolioManager } from '@/components/CreatorPortfolioManager';
import { CreatorOfferingsManager } from '@/components/CreatorOfferingsManager';
import { AnalyticsSummary } from '@/components/AnalyticsSummary';
import { CREATOR_CATEGORIES } from '@/lib/creator-categories';
import { formatCreatorCategory } from '@/lib/format';
import { getCreatorAnalytics } from '@/lib/analytics-api';
import { HttpError } from '@/lib/http';
import type { BusinessAnalytics, County, Creator, CreatorCategory } from '@/lib/types';

function splitList(value: string): string[] {
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

const FIELD_CLASS =
  'rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500';
const LABEL_CLASS = 'flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200';

// How much of a profile is filled in, for the completion bar — a fixed
// checklist of fields that start empty (unlike `category`, which always
// has a value via its default, so completing it isn't a meaningful signal).
function completionPercent(creator: Creator): number {
  const checks = [
    Boolean(creator.profileImage),
    Boolean(creator.coverImage),
    Boolean(creator.bio),
    Boolean(creator.countyId),
    Boolean(creator.contactEmail || creator.contactPhone || creator.whatsapp),
    creator.specialties.length > 0,
    creator.languages.length > 0,
    creator.yearsExperience !== null,
    creator.certifications.length > 0,
    Boolean(creator.availabilityNote),
    (creator.portfolioItems?.length ?? 0) > 0,
    (creator.offerings?.length ?? 0) > 0,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

// Creator dashboard (Tech Spec §3.2, §5 Creator) — self-service "become a
// creator" form when no profile exists yet, or the full profile/portfolio/
// offerings management view once one does.
export default function MyCreatorProfilePage() {
  const { user, token, ready } = useAuth();
  const [creator, setCreator] = useState<Creator | null>(null);
  const [counties, setCounties] = useState<County[]>([]);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [category, setCategory] = useState<CreatorCategory>('other');
  const [countyId, setCountyId] = useState('');
  const [bio, setBio] = useState('');
  const [instagram, setInstagram] = useState('');
  const [tiktok, setTiktok] = useState('');
  const [youtube, setYoutube] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [website, setWebsite] = useState('');
  const [languages, setLanguages] = useState('');
  const [yearsExperience, setYearsExperience] = useState('');
  const [certifications, setCertifications] = useState('');
  const [availabilityNote, setAvailabilityNote] = useState('');
  const [specialties, setSpecialties] = useState('');
  const [locationsCovered, setLocationsCovered] = useState('');
  const [contentLinks, setContentLinks] = useState('');
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [coverImage, setCoverImage] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [analytics, setAnalytics] = useState<BusinessAnalytics | null>(null);

  useEffect(() => {
    getCounties().then(setCounties);
  }, []);

  useEffect(() => {
    if (!token || !creator) return;
    let cancelled = false;
    getCreatorAnalytics(token, creator.id).then((result) => {
      if (!cancelled) setAnalytics(result);
    });
    return () => {
      cancelled = true;
    };
  }, [token, creator]);

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
        setCategory(existing.category);
        setCountyId(existing.countyId ?? '');
        setBio(existing.bio ?? '');
        setInstagram(existing.instagram ?? '');
        setTiktok(existing.tiktok ?? '');
        setYoutube(existing.youtube ?? '');
        setContactEmail(existing.contactEmail ?? '');
        setContactPhone(existing.contactPhone ?? '');
        setWhatsapp(existing.whatsapp ?? '');
        setWebsite(existing.website ?? '');
        setLanguages(existing.languages.join(', '));
        setYearsExperience(existing.yearsExperience?.toString() ?? '');
        setCertifications(existing.certifications.join(', '));
        setAvailabilityNote(existing.availabilityNote ?? '');
        setSpecialties(existing.specialties.join(', '));
        setLocationsCovered(existing.locationsCovered.join(', '));
        setContentLinks(existing.contentLinks.join(', '));
        setProfileImage(existing.profileImage);
        setCoverImage(existing.coverImage);
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
    const input: CreatorProfileInput = {
      name,
      username,
      category,
      countyId: countyId || undefined,
      bio: bio.trim() || undefined,
      profileImage: profileImage || undefined,
      coverImage: coverImage || undefined,
      instagram: instagram.trim() || undefined,
      tiktok: tiktok.trim() || undefined,
      youtube: youtube.trim() || undefined,
      contactEmail: contactEmail.trim() || undefined,
      contactPhone: contactPhone.trim() || undefined,
      whatsapp: whatsapp.trim() || undefined,
      website: website.trim() || undefined,
      languages: splitList(languages),
      yearsExperience: yearsExperience ? Number(yearsExperience) : undefined,
      certifications: splitList(certifications),
      availabilityNote: availabilityNote.trim() || undefined,
      specialties: splitList(specialties),
      locationsCovered: splitList(locationsCovered),
      contentLinks: splitList(contentLinks),
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
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>
      </main>
    );
  }

  if (!user || !token) {
    return (
      <main className="mx-auto flex max-w-sm flex-col gap-4 px-4 py-10 text-center">
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">Become a creator</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Log in to set up your creator profile.</p>
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
    <main className="mx-auto flex max-w-xl flex-col gap-8 px-4 py-10">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">{creator ? 'Creator dashboard' : 'Become a creator'}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {creator
            ? 'Manage your public profile, portfolio, and services.'
            : 'Share your work and services with LIBERIA360 travelers.'}
        </p>
        {creator && (
          <Link href={`/creators/${creator.username}`} className="mt-1 inline-block text-sm text-brand-700 hover:underline">
            View public profile →
          </Link>
        )}
      </div>

      {creator && (
        <div className="flex flex-col gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 p-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">Profile completion</span>
            <span className="text-slate-500 dark:text-slate-400">{completionPercent(creator)}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${completionPercent(creator)}%` }} />
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            {creator.verificationStatus === 'verified'
              ? 'Your account is verified — the badge shows on your public profile.'
              : 'Fill in photos, contact info, specialties, and add portfolio work to reach 100%.'}
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">Basic info</h2>

        <div className="flex gap-4">
          <SingleImageUploader token={token} value={profileImage} onChange={setProfileImage} label="Profile picture" />
          <SingleImageUploader token={token} value={coverImage} onChange={setCoverImage} label="Cover image" className="h-28 w-44" />
        </div>

        <label className={LABEL_CLASS}>
          Name
          <input type="text" required maxLength={150} value={name} onChange={(e) => setName(e.target.value)} className={FIELD_CLASS} />
        </label>

        <label className={LABEL_CLASS}>
          Username
          <input
            type="text"
            required
            maxLength={50}
            pattern="[a-z0-9_.]+"
            title="Lowercase letters, numbers, dots, and underscores only"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className={FIELD_CLASS}
          />
          <span className="text-xs font-normal text-slate-400 dark:text-slate-500">Lowercase letters, numbers, dots, and underscores only.</span>
        </label>

        <label className={LABEL_CLASS}>
          Creator category
          <select value={category} onChange={(e) => setCategory(e.target.value as CreatorCategory)} className={FIELD_CLASS}>
            {CREATOR_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {formatCreatorCategory(c)}
              </option>
            ))}
          </select>
        </label>

        <label className={LABEL_CLASS}>
          Home county
          <CountySelect value={countyId} onChange={setCountyId} counties={counties} />
        </label>

        <label className={LABEL_CLASS}>
          Bio
          <textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={1000} rows={3} className={FIELD_CLASS} />
        </label>

        <h2 className="mt-2 text-base font-semibold text-slate-900 dark:text-slate-50">Contact &amp; links</h2>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className={LABEL_CLASS}>
            Contact email
            <input type="email" maxLength={255} value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className={FIELD_CLASS} />
          </label>
          <label className={LABEL_CLASS}>
            Contact phone
            <input type="tel" maxLength={40} value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className={FIELD_CLASS} />
          </label>
          <label className={LABEL_CLASS}>
            WhatsApp number
            <input type="tel" maxLength={40} value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} className={FIELD_CLASS} />
          </label>
          <label className={LABEL_CLASS}>
            Website
            <input type="url" maxLength={300} value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://…" className={FIELD_CLASS} />
          </label>
          <label className={LABEL_CLASS}>
            Instagram handle
            <input type="text" maxLength={100} value={instagram} onChange={(e) => setInstagram(e.target.value)} className={FIELD_CLASS} />
          </label>
          <label className={LABEL_CLASS}>
            TikTok handle
            <input type="text" maxLength={100} value={tiktok} onChange={(e) => setTiktok(e.target.value)} className={FIELD_CLASS} />
          </label>
          <label className={LABEL_CLASS}>
            YouTube handle
            <input type="text" maxLength={100} value={youtube} onChange={(e) => setYoutube(e.target.value)} className={FIELD_CLASS} />
          </label>
        </div>

        <h2 className="mt-2 text-base font-semibold text-slate-900 dark:text-slate-50">Skills &amp; experience</h2>

        <label className={LABEL_CLASS}>
          Skills &amp; specialties
          <input type="text" placeholder="drone photography, weddings, wildlife" value={specialties} onChange={(e) => setSpecialties(e.target.value)} className={FIELD_CLASS} />
          <span className="text-xs font-normal text-slate-400 dark:text-slate-500">Comma-separated.</span>
        </label>

        <label className={LABEL_CLASS}>
          Languages spoken
          <input type="text" placeholder="English, Kpelle, Bassa" value={languages} onChange={(e) => setLanguages(e.target.value)} className={FIELD_CLASS} />
          <span className="text-xs font-normal text-slate-400 dark:text-slate-500">Comma-separated.</span>
        </label>

        <label className={LABEL_CLASS}>
          Years of experience
          <input
            type="number"
            min={0}
            max={80}
            value={yearsExperience}
            onChange={(e) => setYearsExperience(e.target.value)}
            className={FIELD_CLASS}
          />
        </label>

        <label className={LABEL_CLASS}>
          Certifications &amp; credentials
          <input type="text" placeholder="Certified Drone Pilot, First Aid" value={certifications} onChange={(e) => setCertifications(e.target.value)} className={FIELD_CLASS} />
          <span className="text-xs font-normal text-slate-400 dark:text-slate-500">Comma-separated.</span>
        </label>

        <label className={LABEL_CLASS}>
          Areas served
          <input type="text" placeholder="Montserrado, Bomi" value={locationsCovered} onChange={(e) => setLocationsCovered(e.target.value)} className={FIELD_CLASS} />
          <span className="text-xs font-normal text-slate-400 dark:text-slate-500">Comma-separated.</span>
        </label>

        <label className={LABEL_CLASS}>
          Availability
          <textarea
            value={availabilityNote}
            onChange={(e) => setAvailabilityNote(e.target.value)}
            placeholder="e.g. Weekends only, booked through December"
            maxLength={500}
            rows={2}
            className={FIELD_CLASS}
          />
        </label>

        <label className={LABEL_CLASS}>
          Featured content links
          <input type="text" placeholder="https://…, https://…" value={contentLinks} onChange={(e) => setContentLinks(e.target.value)} className={FIELD_CLASS} />
          <span className="text-xs font-normal text-slate-400 dark:text-slate-500">Comma-separated links to your best work elsewhere.</span>
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

      {creator && token && (
        <>
          <div className="flex flex-col gap-3 border-t border-slate-100 dark:border-slate-800 pt-6">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">Portfolio</h2>
            <CreatorPortfolioManager
              token={token}
              items={creator.portfolioItems ?? []}
              onChange={(items) => setCreator({ ...creator, portfolioItems: items })}
            />
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-100 dark:border-slate-800 pt-6">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">Services &amp; experiences</h2>
            <CreatorOfferingsManager
              token={token}
              offerings={creator.offerings ?? []}
              onChange={(offerings) => setCreator({ ...creator, offerings })}
            />
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-100 dark:border-slate-800 pt-6">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">Analytics</h2>
            {analytics ? (
              <AnalyticsSummary analytics={analytics} metrics={['view', 'contact_click']} />
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>
            )}
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-100 dark:border-slate-800 pt-6">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">Reviews</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {creator.reviewCount > 0
                ? `${creator.reviewCount} review${creator.reviewCount === 1 ? '' : 's'} so far.`
                : 'No reviews yet.'}{' '}
              <Link href={`/creators/${creator.username}`} className="font-medium text-brand-700 hover:underline">
                View on your public profile
              </Link>
              .
            </p>
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-100 dark:border-slate-800 pt-6">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">Inquiries &amp; bookings</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Booking requests and messages from travelers show up under{' '}
              <Link href="/account/bookings" className="font-medium text-brand-700 hover:underline">
                My Bookings
              </Link>
              .
            </p>
          </div>
        </>
      )}
    </main>
  );
}
