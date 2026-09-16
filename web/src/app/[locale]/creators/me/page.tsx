"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import {
  ArrowTrendingUpIcon,
  CalendarDaysIcon,
  ChartBarIcon,
  ChatBubbleLeftRightIcon,
  EyeIcon,
  PencilSquareIcon,
  PlusIcon,
  UserGroupIcon,
} from "@heroicons/react/24/outline";
import { useAuth } from "@/hooks/useAuth";
import {
  createCreatorProfile,
  getMyCreatorProfile,
  updateCreatorProfile,
  type CreatorProfileInput,
} from "@/lib/creator-api";
import { getCounties } from "@/lib/api";
import { CountySelect } from "@/components/ProfileFields";
import { BrandLoader } from "@/components/BrandLoader";
import { CreatorPhotoActionMenu } from "@/components/CreatorPhotoActionMenu";
import { CreatorPortfolioManager } from "@/components/CreatorPortfolioManager";
import { CreatorOfferingsManager } from "@/components/CreatorOfferingsManager";
import { AnalyticsSummary } from "@/components/AnalyticsSummary";
import { CREATOR_CATEGORIES } from "@/lib/creator-categories";
import { formatCreatorCategory } from "@/lib/format";
import { getCreatorAnalytics } from "@/lib/analytics-api";
import { getCreatorBookings } from "@/lib/booking-api";
import { getMyCreatorPosts } from "@/lib/creator-feed-api";
import { HttpError } from "@/lib/http";
import type {
  Booking,
  BusinessAnalytics,
  County,
  Creator,
  CreatorPost,
  CreatorAvailabilityStatus,
  CreatorCategory,
} from "@/lib/types";

function splitList(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

const FIELD_CLASS =
  "rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500";
const LABEL_CLASS =
  "flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200";

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

function compactNumber(value: number): string {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function bookingTone(status: Booking["status"]): string {
  if (status === "confirmed") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300";
  if (status === "pending") return "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300";
  if (status === "declined" || status === "cancelled") return "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300";
  return "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300";
}

function DashboardMetric({
  label,
  value,
  detail,
  icon: Icon,
  tone = "brand",
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof EyeIcon;
  tone?: "brand" | "gold" | "emerald" | "violet";
}) {
  const tones = {
    brand: "bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300",
    gold: "bg-gold-50 text-gold-700 dark:bg-gold-950/30 dark:text-gold-300",
    emerald: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300",
    violet: "bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-300",
  };
  return (
    <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <p className="truncate text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${tones[tone]}`}>
          <Icon aria-hidden className="h-5 w-5" />
        </span>
      </div>
      <p className="mt-3 truncate font-display text-2xl font-extrabold tracking-tight text-slate-950 dark:text-white">{value}</p>
      <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">{detail}</p>
    </div>
  );
}

function CreatorDashboard({
  creator,
  analytics,
  posts,
  bookings,
}: {
  creator: Creator;
  analytics: BusinessAnalytics | null;
  posts: CreatorPost[];
  bookings: Booking[];
}) {
  const totalLikes = posts.reduce((sum, post) => sum + post.likeCount, 0);
  const totalComments = posts.reduce((sum, post) => sum + post.commentCount, 0);
  const totalShares = posts.reduce((sum, post) => sum + post.shareCount, 0);
  const pendingBookings = bookings.filter((booking) => booking.status === "pending").length;
  const confirmedBookings = bookings.filter((booking) => booking.status === "confirmed").length;
  const topPost = [...posts].sort((a, b) => (b.likeCount + b.commentCount) - (a.likeCount + a.commentCount))[0];
  const completion = completionPercent(creator);

  return (
    <section id="dashboard" className="-mx-4 flex flex-col gap-5 rounded-[2rem] bg-[#081a50] px-4 py-5 text-white shadow-card sm:-mx-0 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-gold-300">Creator studio</p>
          <h2 className="mt-1 font-display text-2xl font-extrabold tracking-tight sm:text-3xl">Good to see you, {creator.name.split(" ")[0]}</h2>
          <p className="mt-1 max-w-xl text-sm leading-6 text-blue-100/75">A clear view of your audience, content performance, and booking activity.</p>
        </div>
        <ChartBarIcon aria-hidden className="hidden h-10 w-10 text-gold-300 sm:block" />
      </div>

      <nav aria-label="Creator dashboard sections" className="-mx-1 flex gap-2 overflow-x-auto pb-1">
        {["Overview", "Content", "Bookings", "Profile"].map((label, index) => (
          <a key={label} href={index === 0 ? "#dashboard" : index === 1 ? "#content" : index === 2 ? "#bookings" : "#profile"} className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold ${index === 0 ? "bg-white text-[#081a50]" : "bg-white/10 text-blue-100 hover:bg-white/20"}`}>
            {label}
          </a>
        ))}
      </nav>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <DashboardMetric label="Profile views" value={analytics ? compactNumber(analytics.totals.view) : "—"} detail="Last 30 days" icon={EyeIcon} />
        <DashboardMetric label="Contact clicks" value={analytics ? compactNumber(analytics.totals.contact_click) : "—"} detail="People reaching out" icon={ChatBubbleLeftRightIcon} tone="gold" />
        <DashboardMetric label="Followers" value={compactNumber(creator.followerCount)} detail="Your community" icon={UserGroupIcon} tone="violet" />
        <DashboardMetric label="Booking requests" value={analytics ? compactNumber(analytics.totals.booking_request) : "—"} detail={pendingBookings ? `${pendingBookings} need your reply` : "No pending requests"} icon={CalendarDaysIcon} tone="emerald" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div id="content" className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-display text-lg font-bold">Content pulse</h3>
              <p className="text-xs text-blue-100/65">How your published work is performing</p>
            </div>
            <Link href="/creators/me/create" className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-gold-400 px-3 py-2 text-xs font-bold text-[#081a50] hover:bg-gold-300"><PlusIcon aria-hidden className="h-4 w-4" />New post</Link>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-black/15 p-3"><p className="text-2xl font-extrabold">{posts.length}</p><p className="text-xs text-blue-100/65">Posts</p></div>
            <div className="rounded-xl bg-black/15 p-3"><p className="text-2xl font-extrabold">{compactNumber(totalLikes)}</p><p className="text-xs text-blue-100/65">Likes</p></div>
            <div className="rounded-xl bg-black/15 p-3"><p className="text-2xl font-extrabold">{compactNumber(totalComments + totalShares)}</p><p className="text-xs text-blue-100/65">Conversations &amp; shares</p></div>
          </div>
          {topPost ? <p className="mt-4 flex items-center gap-2 text-xs text-blue-100/75"><ArrowTrendingUpIcon aria-hidden className="h-4 w-4 text-emerald-300" />Top post: <span className="truncate font-semibold text-white">{topPost.caption || "Untitled post"}</span></p> : <p className="mt-4 text-xs text-blue-100/65">Publish your first post to start tracking performance.</p>}
        </div>
        <div id="bookings" className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-sm">
          <div className="flex items-center justify-between gap-3"><div><h3 className="font-display text-lg font-bold">Booking inbox</h3><p className="text-xs text-blue-100/65">Requests from travelers</p></div><CalendarDaysIcon aria-hidden className="h-6 w-6 text-gold-300" /></div>
          <div className="mt-4 flex items-center gap-3"><div className="flex-1 rounded-xl bg-black/15 p-3"><p className="text-2xl font-extrabold">{pendingBookings}</p><p className="text-xs text-blue-100/65">Awaiting reply</p></div><div className="flex-1 rounded-xl bg-black/15 p-3"><p className="text-2xl font-extrabold">{confirmedBookings}</p><p className="text-xs text-blue-100/65">Confirmed</p></div></div>
          <Link href="/account/bookings" className="mt-4 inline-flex items-center text-sm font-bold text-gold-300 hover:text-gold-200">Open booking inbox <span aria-hidden className="ml-1">→</span></Link>
        </div>
      </div>

      <div id="profile" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/10 p-4">
        <div><p className="font-semibold">Profile strength</p><p className="text-xs text-blue-100/65">Complete your profile to build visitor confidence.</p><div className="mt-2 h-2 w-48 overflow-hidden rounded-full bg-black/20"><div className="h-full rounded-full bg-gold-400" style={{ width: `${completion}%` }} /></div></div>
        <div className="flex items-center gap-3"><span className="text-sm font-bold text-gold-300">{completion}% complete</span><a href="#profile-editor" className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-white/20 px-3 py-2 text-xs font-bold hover:bg-white/10"><PencilSquareIcon aria-hidden className="h-4 w-4" />Edit profile</a></div>
      </div>
    </section>
  );
}

// Creator dashboard (Tech Spec §3.2, §5 Creator) — self-service "become a
// creator" form when no profile exists yet, or the full profile/portfolio/
// offerings management view once one does.
export default function MyCreatorProfilePage() {
  const { user, token, ready } = useAuth();
  const [creator, setCreator] = useState<Creator | null>(null);
  const [counties, setCounties] = useState<County[]>([]);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [category, setCategory] = useState<CreatorCategory>("other");
  const [countyId, setCountyId] = useState("");
  const [bio, setBio] = useState("");
  const [instagram, setInstagram] = useState("");
  const [tiktok, setTiktok] = useState("");
  const [youtube, setYoutube] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [website, setWebsite] = useState("");
  const [languages, setLanguages] = useState("");
  const [yearsExperience, setYearsExperience] = useState("");
  const [certifications, setCertifications] = useState("");
  const [availabilityNote, setAvailabilityNote] = useState("");
  const [availabilityStatus, setAvailabilityStatus] =
    useState<CreatorAvailabilityStatus>("accepting_requests");
  const [specialties, setSpecialties] = useState("");
  const [locationsCovered, setLocationsCovered] = useState("");
  const [contentLinks, setContentLinks] = useState("");
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [coverImage, setCoverImage] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [analytics, setAnalytics] = useState<BusinessAnalytics | null>(null);
  const [posts, setPosts] = useState<CreatorPost[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);

  useEffect(() => {
    getCounties().then(setCounties);
  }, []);

  useEffect(() => {
    if (!token || !creator) return;
    let cancelled = false;
    Promise.all([
      getCreatorAnalytics(token, creator.id).catch(() => null),
      getMyCreatorPosts(token).catch(() => []),
      getCreatorBookings(token, creator.id).catch(() => []),
    ]).then(([result, creatorPosts, creatorBookings]) => {
      if (cancelled) return;
      setAnalytics(result);
      setPosts(creatorPosts);
      setBookings(creatorBookings);
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
        setCountyId(existing.countyId ?? "");
        setBio(existing.bio ?? "");
        setInstagram(existing.instagram ?? "");
        setTiktok(existing.tiktok ?? "");
        setYoutube(existing.youtube ?? "");
        setContactEmail(existing.contactEmail ?? "");
        setContactPhone(existing.contactPhone ?? "");
        setWhatsapp(existing.whatsapp ?? "");
        setWebsite(existing.website ?? "");
        setLanguages(existing.languages.join(", "));
        setYearsExperience(existing.yearsExperience?.toString() ?? "");
        setCertifications(existing.certifications.join(", "));
        setAvailabilityNote(existing.availabilityNote ?? "");
        setAvailabilityStatus(
          existing.availabilityStatus ?? "accepting_requests",
        );
        setSpecialties(existing.specialties.join(", "));
        setLocationsCovered(existing.locationsCovered.join(", "));
        setContentLinks(existing.contentLinks.join(", "));
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
      profileImage: creator ? profileImage : profileImage ?? undefined,
      coverImage: creator ? coverImage : coverImage ?? undefined,
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
      availabilityStatus,
      specialties: splitList(specialties),
      locationsCovered: splitList(locationsCovered),
      contentLinks: splitList(contentLinks),
    };
    try {
      const result = creator
        ? await updateCreatorProfile(token, input)
        : await createCreatorProfile(token, input);
      setCreator(result);
      setSaved(true);
    } catch (err) {
      setError(
        err instanceof HttpError
          ? err.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (!ready || loadingProfile) {
    return (
      <main className="flex min-h-[70vh] flex-col items-center justify-center gap-5 px-4">
        <BrandLoader />
        <p className="text-sm font-medium tracking-wide text-slate-500 dark:text-slate-400">Loading…</p>
      </main>
    );
  }

  if (!user || !token) {
    return (
      <main className="mx-auto flex max-w-sm flex-col gap-4 px-4 py-10 text-center">
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">
          Become a creator
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Log in to set up your creator profile.
        </p>
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
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">
          {creator ? "Creator dashboard" : "Become a creator"}
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {creator
            ? "Manage your public profile, portfolio, and services."
            : "Share your work and services with LIBERIA360 travelers."}
        </p>
        {creator && (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Link
              href={`/creators/${creator.username}`}
              className="text-sm text-brand-700 hover:underline dark:text-brand-300"
            >
              View public profile →
            </Link>
            <Link
              href="/creators/me/create"
              className="inline-flex min-h-10 items-center rounded-full bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800"
            >
              Create post
            </Link>
          </div>
        )}
      </div>

      {creator && (
        <CreatorDashboard creator={creator} analytics={analytics} posts={posts} bookings={bookings} />
      )}

      {creator && (
        <div id="profile-editor" className="flex flex-col gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 p-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              Profile completion
            </span>
            <span className="text-slate-500 dark:text-slate-400">
              {completionPercent(creator)}%
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className="h-full rounded-full bg-brand-600 transition-all"
              style={{ width: `${completionPercent(creator)}%` }}
            />
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-400">
            {creator.verificationStatus === "verified"
              ? "Your account is verified — the badge shows on your public profile."
              : "Fill in photos, contact info, specialties, and add portfolio work to reach 100%."}
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">
          Basic info
        </h2>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-[auto_1fr] sm:items-end">
          <CreatorPhotoActionMenu
            token={token}
            value={profileImage}
            onChange={setProfileImage}
            label="Profile photo"
          />
          <CreatorPhotoActionMenu
            token={token}
            value={coverImage}
            onChange={setCoverImage}
            label="Cover photo"
            className="h-32 w-full sm:h-28"
          />
        </div>

        <label className={LABEL_CLASS}>
          Name
          <input
            type="text"
            required
            maxLength={150}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={FIELD_CLASS}
          />
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
          <span className="text-xs font-normal text-slate-400 dark:text-slate-400">
            Lowercase letters, numbers, dots, and underscores only.
          </span>
        </label>

        <label className={LABEL_CLASS}>
          Creator category
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as CreatorCategory)}
            className={FIELD_CLASS}
          >
            {CREATOR_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {formatCreatorCategory(c)}
              </option>
            ))}
          </select>
        </label>

        <label className={LABEL_CLASS}>
          Home county
          <CountySelect
            value={countyId}
            onChange={setCountyId}
            counties={counties}
          />
        </label>

        <label className={LABEL_CLASS}>
          Bio
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={1000}
            rows={3}
            className={FIELD_CLASS}
          />
        </label>

        <h2 className="mt-2 text-base font-semibold text-slate-900 dark:text-slate-50">
          Contact &amp; links
        </h2>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className={LABEL_CLASS}>
            Contact email
            <input
              type="email"
              maxLength={255}
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              className={FIELD_CLASS}
            />
          </label>
          <label className={LABEL_CLASS}>
            Contact phone
            <input
              type="tel"
              maxLength={40}
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              className={FIELD_CLASS}
            />
          </label>
          <label className={LABEL_CLASS}>
            WhatsApp number
            <input
              type="tel"
              maxLength={40}
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              className={FIELD_CLASS}
            />
          </label>
          <label className={LABEL_CLASS}>
            Website
            <input
              type="url"
              maxLength={300}
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://…"
              className={FIELD_CLASS}
            />
          </label>
          <label className={LABEL_CLASS}>
            Instagram handle
            <input
              type="text"
              maxLength={100}
              value={instagram}
              onChange={(e) => setInstagram(e.target.value)}
              className={FIELD_CLASS}
            />
          </label>
          <label className={LABEL_CLASS}>
            TikTok handle
            <input
              type="text"
              maxLength={100}
              value={tiktok}
              onChange={(e) => setTiktok(e.target.value)}
              className={FIELD_CLASS}
            />
          </label>
          <label className={LABEL_CLASS}>
            YouTube handle
            <input
              type="text"
              maxLength={100}
              value={youtube}
              onChange={(e) => setYoutube(e.target.value)}
              className={FIELD_CLASS}
            />
          </label>
        </div>

        <h2 className="mt-2 text-base font-semibold text-slate-900 dark:text-slate-50">
          Skills &amp; experience
        </h2>

        <label className={LABEL_CLASS}>
          Skills &amp; specialties
          <input
            type="text"
            placeholder="drone photography, weddings, wildlife"
            value={specialties}
            onChange={(e) => setSpecialties(e.target.value)}
            className={FIELD_CLASS}
          />
          <span className="text-xs font-normal text-slate-400 dark:text-slate-400">
            Comma-separated.
          </span>
        </label>

        <label className={LABEL_CLASS}>
          Languages spoken
          <input
            type="text"
            placeholder="English, Kpelle, Bassa"
            value={languages}
            onChange={(e) => setLanguages(e.target.value)}
            className={FIELD_CLASS}
          />
          <span className="text-xs font-normal text-slate-400 dark:text-slate-400">
            Comma-separated.
          </span>
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
          <input
            type="text"
            placeholder="Certified Drone Pilot, First Aid"
            value={certifications}
            onChange={(e) => setCertifications(e.target.value)}
            className={FIELD_CLASS}
          />
          <span className="text-xs font-normal text-slate-400 dark:text-slate-400">
            Comma-separated.
          </span>
        </label>

        <label className={LABEL_CLASS}>
          Areas served
          <input
            type="text"
            placeholder="Montserrado, Bomi"
            value={locationsCovered}
            onChange={(e) => setLocationsCovered(e.target.value)}
            className={FIELD_CLASS}
          />
          <span className="text-xs font-normal text-slate-400 dark:text-slate-400">
            Comma-separated.
          </span>
        </label>

        <label className={LABEL_CLASS}>
          Availability status
          <select
            value={availabilityStatus}
            onChange={(e) =>
              setAvailabilityStatus(e.target.value as CreatorAvailabilityStatus)
            }
            className={FIELD_CLASS}
          >
            <option value="accepting_requests">Accepting requests</option>
            <option value="limited">Limited availability</option>
            <option value="unavailable">Unavailable</option>
          </select>
          <span className="text-xs font-normal text-slate-400 dark:text-slate-400">
            This helps travelers decide when to send a request.
          </span>
        </label>

        <label className={LABEL_CLASS}>
          Availability note
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
          <input
            type="text"
            placeholder="https://…, https://…"
            value={contentLinks}
            onChange={(e) => setContentLinks(e.target.value)}
            className={FIELD_CLASS}
          />
          <span className="text-xs font-normal text-slate-400 dark:text-slate-400">
            Comma-separated links to your best work elsewhere.
          </span>
        </label>

        {error && (
          <p
            role="alert"
            className="rounded-lg bg-flag-500/10 px-3 py-2 text-sm text-flag-700 dark:text-flag-300"
          >
            {error}
          </p>
        )}
        {saved && !error && (
          <p className="text-sm text-emerald-700 dark:text-emerald-300">
            Saved!
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="rounded-full bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
        >
          {submitting ? "Saving…" : creator ? "Save changes" : "Create profile"}
        </button>
      </form>

      {creator && token && (
        <>
          <div className="flex flex-col gap-3 border-t border-slate-100 dark:border-slate-800 pt-6">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">
              Portfolio
            </h2>
            <CreatorPortfolioManager
              token={token}
              items={creator.portfolioItems ?? []}
              onChange={(items) =>
                setCreator({ ...creator, portfolioItems: items })
              }
            />
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-100 dark:border-slate-800 pt-6">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">
              Services &amp; experiences
            </h2>
            <CreatorOfferingsManager
              token={token}
              offerings={creator.offerings ?? []}
              onChange={(offerings) => setCreator({ ...creator, offerings })}
            />
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-100 dark:border-slate-800 pt-6">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">
              Analytics
            </h2>
            {analytics ? (
              <AnalyticsSummary
                analytics={analytics}
                metrics={["view", "contact_click"]}
              />
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Loading…
              </p>
            )}
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-100 dark:border-slate-800 pt-6">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">
              Reviews
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {creator.reviewCount > 0
                ? `${creator.reviewCount} review${creator.reviewCount === 1 ? "" : "s"} so far.`
                : "No reviews yet."}{" "}
              <Link
                href={`/creators/${creator.username}`}
                className="font-medium text-brand-700 dark:text-brand-300 hover:underline"
              >
                View on your public profile
              </Link>
              .
            </p>
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-100 dark:border-slate-800 pt-6">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">
              Inquiries &amp; bookings
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Booking requests and messages from travelers show up under{" "}
              <Link
                href="/account/bookings"
                className="font-medium text-brand-700 dark:text-brand-300 hover:underline"
              >
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
