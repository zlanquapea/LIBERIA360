"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  ChatBubbleLeftRightIcon,
  CheckCircleIcon,
  PencilSquareIcon,
  PlusIcon,
  StarIcon,
} from "@heroicons/react/24/solid";
import { useAuth } from "@/hooks/useAuth";
import { HttpError } from "@/lib/http";
import type { ExperienceSummary, GuideSummary } from "@/lib/api";
import {
  createGuideExperience,
  createGuideReview,
  getGuideMessages,
  getGuideReviews,
  getMyGuideExperiences,
  getMyGuideProfile,
  openGuideChat,
  sendGuideMessage,
  updateGuideExperience,
  updateMyGuideProfile,
  type GuideChatEvent,
  type GuideMessage,
  type GuideReviewSummary,
} from "@/lib/guides-api";

const guideTypes = [
  ["tour_guide", "Tour guide"],
  ["cultural_host", "Cultural host"],
  ["nature_guide", "Nature guide"],
  ["adventure_guide", "Adventure guide"],
  ["food_host", "Food host"],
] as const;
const categories = ["city", "culture", "nature", "food"] as const;

function Stars({
  value,
  onChange,
}: {
  value: number;
  onChange?: (value: number) => void;
}) {
  return (
    <div
      className="flex items-center gap-1"
      role={onChange ? "radiogroup" : undefined}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type={onChange ? "button" : undefined}
          onClick={() => onChange?.(star)}
          className={onChange ? "transition hover:scale-110" : "cursor-default"}
          aria-label={
            onChange ? `${star} star${star === 1 ? "" : "s"}` : undefined
          }
        >
          <StarIcon
            className={`h-5 w-5 ${star <= value ? "text-amber-400" : "text-slate-200"}`}
          />
        </button>
      ))}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  multiline = false,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  type?: string;
}) {
  const className =
    "w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100";
  return (
    <label className="block text-sm font-semibold text-slate-700">
      {label}
      {multiline ? (
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          rows={4}
          className={`${className} mt-1.5 resize-y font-normal`}
        />
      ) : (
        <input
          value={value}
          type={type}
          onChange={(event) => onChange(event.target.value)}
          className={`${className} mt-1.5 font-normal`}
        />
      )}
    </label>
  );
}

export function GuideProfileTools({
  guide,
  initialExperiences,
}: {
  guide: GuideSummary;
  initialExperiences: ExperienceSummary[];
}) {
  const { user, token, ready } = useAuth();
  const [isOwner, setIsOwner] = useState(false);
  const [reviews, setReviews] = useState<GuideReviewSummary[]>([]);
  const [messages, setMessages] = useState<GuideMessage[]>([]);
  const [myExperiences, setMyExperiences] =
    useState<ExperienceSummary[]>(initialExperiences);
  const [activeVisitorId, setActiveVisitorId] = useState<string>();
  const [message, setMessage] = useState("");
  const [reviewText, setReviewText] = useState("");
  const [reviewRating, setReviewRating] = useState(5);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [chatStatus, setChatStatus] = useState<
    "offline" | "connecting" | "connected" | "reconnecting"
  >("offline");
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [showExperienceForm, setShowExperienceForm] = useState(false);
  const [profile, setProfile] = useState({
    guideType: guide.guideType,
    bio: guide.bio,
    city: guide.city,
    languages: guide.languages.join(", "),
    whatsappNumber: guide.whatsappNumber ?? "",
    slug: guide.slug,
  });
  const [experience, setExperience] = useState({
    title: "",
    description: "",
    category: "city",
    county: guide.county?.name ?? guide.city,
    durationMinutes: "120",
    groupType: "small_group",
    maxGroupSize: "8",
    priceUsd: "25",
    priceLrd: "",
    meetingPointText: guide.city,
    includes: "",
    cancellationPolicy:
      "Free cancellation up to 24 hours before the experience.",
    coverImageUrl: "",
  });

  useEffect(() => {
    getGuideReviews(guide.id)
      .then(setReviews)
      .catch(() => undefined);
  }, [guide.id]);

  useEffect(() => {
    if (!ready || !token) {
      setChatStatus("offline");
      return;
    }
    let stopped = false;
    let reconnectAttempt = 0;
    const connect = () => {
      if (stopped) return;
      setChatStatus(reconnectAttempt === 0 ? "connecting" : "reconnecting");
      const socket = openGuideChat(token, guide.id, (event: GuideChatEvent) => {
        if (event.type === "guide.chat.ready") {
          reconnectAttempt = 0;
          setChatStatus("connected");
        } else if (event.type === "guide.message.created") {
          setMessages((current) =>
            current.some((item) => item.id === event.message.id)
              ? current
              : [...current, event.message],
          );
          setActiveVisitorId((current) => current ?? event.message.visitorId);
        } else if (event.type === "guide.chat.error") {
          setError(event.message);
        }
      });
      socketRef.current = socket;
      socket.addEventListener("close", () => {
        if (stopped) return;
        setChatStatus("reconnecting");
        reconnectAttempt += 1;
        const delay = Math.min(
          1000 * 2 ** Math.min(reconnectAttempt, 4),
          15000,
        );
        reconnectTimerRef.current = setTimeout(connect, delay);
      });
      socket.addEventListener("error", () => setChatStatus("reconnecting"));
    };
    connect();
    return () => {
      stopped = true;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [guide.id, ready, token]);

  useEffect(() => {
    if (!ready || !token) return;
    getMyGuideProfile(token)
      .then((mine) => {
        const owner = mine.id === guide.id;
        setIsOwner(owner);
        if (owner) {
          setProfile({
            guideType: mine.guideType,
            bio: mine.bio,
            city: mine.city,
            languages: mine.languages.join(", "),
            whatsappNumber: mine.whatsappNumber ?? "",
            slug: mine.slug,
          });
          getMyGuideExperiences(token)
            .then(setMyExperiences)
            .catch(() => undefined);
          getGuideMessages(token, guide.id)
            .then((items) => {
              setMessages(items);
              setActiveVisitorId(items[0]?.visitorId);
            })
            .catch(() => undefined);
        } else {
          getGuideMessages(token, guide.id)
            .then((items) => {
              setMessages(items);
              setActiveVisitorId(items[0]?.visitorId);
            })
            .catch(() => undefined);
        }
      })
      .catch(() => setIsOwner(false));
  }, [guide.id, ready, token]);

  const visitors = useMemo(
    () =>
      Array.from(
        new Map(messages.map((item) => [item.visitorId, item])).values(),
      ),
    [messages],
  );
  const conversation = messages.filter(
    (item) => !activeVisitorId || item.visitorId === activeVisitorId,
  );

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    if (!token) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await updateMyGuideProfile(token, {
        ...profile,
        languages: profile.languages
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      });
      setNotice("Your guide profile has been updated.");
      setEditingProfile(false);
    } catch (err) {
      setError(
        err instanceof HttpError
          ? err.message
          : "Profile could not be updated.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function publishExperience(event: FormEvent) {
    event.preventDefault();
    if (!token) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const created = await createGuideExperience(token, {
        ...experience,
        durationMinutes: Number(experience.durationMinutes),
        maxGroupSize: Number(experience.maxGroupSize),
        priceUsd: Number(experience.priceUsd),
        priceLrd: experience.priceLrd ? Number(experience.priceLrd) : undefined,
        includes: experience.includes
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        status: "published",
      });
      setMyExperiences((current) => [created, ...current]);
      setExperience((current) => ({
        ...current,
        title: "",
        description: "",
        includes: "",
      }));
      setShowExperienceForm(false);
      setNotice("Your experience is now published.");
    } catch (err) {
      setError(
        err instanceof HttpError
          ? err.message
          : "Experience could not be published.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function sendMessage(event: FormEvent) {
    event.preventDefault();
    if (!token || !message.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const body = message.trim();
      const socket = socketRef.current;
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(
          JSON.stringify({
            type: "guide.message.send",
            guideId: guide.id,
            body,
            visitorId: isOwner ? activeVisitorId : undefined,
          }),
        );
      } else {
        const created = await sendGuideMessage(
          token,
          guide.id,
          body,
          isOwner ? activeVisitorId : undefined,
        );
        setMessages((current) => [...current, created]);
        if (!activeVisitorId) setActiveVisitorId(created.visitorId);
      }
      setMessage("");
    } catch (err) {
      setError(
        err instanceof HttpError ? err.message : "Message could not be sent.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function submitReview(event: FormEvent) {
    event.preventDefault();
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      const created = await createGuideReview(token, guide.id, {
        rating: reviewRating,
        comment: reviewText.trim() || undefined,
      });
      setReviews((current) => [created, ...current]);
      setReviewText("");
      setNotice("Thanks for sharing your guide experience.");
    } catch (err) {
      setError(
        err instanceof HttpError ? err.message : "Review could not be posted.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-8 space-y-6">
      {notice && (
        <p
          role="status"
          className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800"
        >
          {notice}
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700"
        >
          {error}
        </p>
      )}

      {isOwner ? (
        <section className="rounded-3xl border border-teal-100 bg-gradient-to-br from-teal-50 to-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-teal-700">
                Guide studio
              </p>
              <h2 className="mt-1 text-2xl font-extrabold text-slate-950">
                Shape your public presence
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Keep your details fresh and publish experiences travelers can
                book.
              </p>
            </div>
            <PencilSquareIcon className="h-7 w-7 shrink-0 text-teal-700" />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setEditingProfile((value) => !value)}
              className="rounded-full bg-teal-700 px-4 py-2 text-sm font-bold text-white hover:bg-teal-800"
            >
              Edit profile
            </button>
            <button
              type="button"
              onClick={() => setShowExperienceForm((value) => !value)}
              className="inline-flex items-center gap-1 rounded-full border border-teal-700 px-4 py-2 text-sm font-bold text-teal-800"
            >
              <PlusIcon className="h-4 w-4" /> Add experience
            </button>
          </div>
          {editingProfile && (
            <form
              onSubmit={saveProfile}
              className="mt-5 grid gap-3 border-t border-teal-100 pt-5 sm:grid-cols-2"
            >
              <label className="text-sm font-semibold text-slate-700">
                Guide type
                <select
                  value={profile.guideType}
                  onChange={(event) =>
                    setProfile({ ...profile, guideType: event.target.value })
                  }
                  className="mt-1.5 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal"
                >
                  <option value="tour_guide">Tour guide</option>
                  {guideTypes.slice(1).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <Field
                label="Public URL slug"
                value={profile.slug}
                onChange={(value) => setProfile({ ...profile, slug: value })}
              />
              <Field
                label="City"
                value={profile.city}
                onChange={(value) => setProfile({ ...profile, city: value })}
              />
              <Field
                label="Languages (comma separated)"
                value={profile.languages}
                onChange={(value) =>
                  setProfile({ ...profile, languages: value })
                }
              />
              <Field
                label="WhatsApp number"
                value={profile.whatsappNumber}
                onChange={(value) =>
                  setProfile({ ...profile, whatsappNumber: value })
                }
              />
              <div className="sm:col-span-2">
                <Field
                  label="About you"
                  value={profile.bio}
                  onChange={(value) => setProfile({ ...profile, bio: value })}
                  multiline
                />
              </div>
              <button
                disabled={saving}
                className="rounded-full bg-teal-700 px-5 py-3 text-sm font-bold text-white disabled:opacity-60 sm:col-span-2"
              >
                {saving ? "Saving…" : "Save profile details"}
              </button>
            </form>
          )}
          {showExperienceForm && (
            <form
              onSubmit={publishExperience}
              className="mt-5 grid gap-3 border-t border-teal-100 pt-5 sm:grid-cols-2"
            >
              <div className="sm:col-span-2">
                <Field
                  label="Experience title"
                  value={experience.title}
                  onChange={(value) =>
                    setExperience({ ...experience, title: value })
                  }
                />
              </div>
              <div className="sm:col-span-2">
                <Field
                  label="Description"
                  value={experience.description}
                  onChange={(value) =>
                    setExperience({ ...experience, description: value })
                  }
                  multiline
                />
              </div>
              <label className="text-sm font-semibold text-slate-700">
                Category
                <select
                  value={experience.category}
                  onChange={(event) =>
                    setExperience({
                      ...experience,
                      category: event.target.value,
                    })
                  }
                  className="mt-1.5 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal"
                >
                  {categories.map((value) => (
                    <option key={value} value={value}>
                      {value[0].toUpperCase() + value.slice(1)}
                    </option>
                  ))}
                </select>
              </label>
              <Field
                label="County"
                value={experience.county}
                onChange={(value) =>
                  setExperience({ ...experience, county: value })
                }
              />
              <Field
                label="Duration (minutes)"
                value={experience.durationMinutes}
                onChange={(value) =>
                  setExperience({ ...experience, durationMinutes: value })
                }
                type="number"
              />
              <Field
                label="Max group size"
                value={experience.maxGroupSize}
                onChange={(value) =>
                  setExperience({ ...experience, maxGroupSize: value })
                }
                type="number"
              />
              <Field
                label="Price (USD)"
                value={experience.priceUsd}
                onChange={(value) =>
                  setExperience({ ...experience, priceUsd: value })
                }
                type="number"
              />
              <Field
                label="Meeting point"
                value={experience.meetingPointText}
                onChange={(value) =>
                  setExperience({ ...experience, meetingPointText: value })
                }
              />
              <div className="sm:col-span-2">
                <Field
                  label="What's included (comma separated)"
                  value={experience.includes}
                  onChange={(value) =>
                    setExperience({ ...experience, includes: value })
                  }
                />
              </div>
              <button
                disabled={saving}
                className="rounded-full bg-amber-500 px-5 py-3 text-sm font-bold text-slate-950 disabled:opacity-60 sm:col-span-2"
              >
                {saving ? "Publishing…" : "Publish experience"}
              </button>
            </form>
          )}
          {myExperiences.length > 0 && (
            <div className="mt-5 space-y-2 border-t border-teal-100 pt-5">
              <p className="text-sm font-bold text-slate-800">
                Your experiences
              </p>
              {myExperiences.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 rounded-2xl bg-white px-3 py-3 text-sm shadow-sm"
                >
                  <span className="font-semibold">{item.title}</span>
                  <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700">
                    {item.status ?? "published"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : (
        <section className="rounded-3xl bg-gradient-to-br from-teal-800 to-teal-950 p-5 text-white shadow-lg">
          <div className="flex items-start gap-3">
            <ChatBubbleLeftRightIcon className="h-7 w-7 shrink-0 text-amber-300" />
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-teal-100">
                Connect directly
              </p>
              <h2 className="mt-1 text-2xl font-extrabold">
                Ask {guide.slug.replaceAll("-", " ")} a question
              </h2>
              <p className="mt-1 text-sm text-teal-100">
                Plan with a local before you book an experience.
              </p>
              {token && (
                <p className="mt-2 text-xs font-bold text-teal-200">
                  {chatStatus === "connected"
                    ? "Live chat connected"
                    : chatStatus === "reconnecting"
                      ? "Reconnecting… messages will fall back to standard delivery"
                      : "Connecting to live chat…"}
                </p>
              )}
            </div>
          </div>
          {token ? (
            <form onSubmit={sendMessage} className="mt-4 flex gap-2">
              <input
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Write a message…"
                className="min-w-0 flex-1 rounded-full border-0 px-4 py-3 text-sm text-slate-900 outline-none"
              />
              <button
                disabled={saving || !message.trim()}
                className="rounded-full bg-amber-400 px-4 py-3 text-sm font-extrabold text-slate-950 disabled:opacity-60"
              >
                Send
              </button>
            </form>
          ) : (
            <Link
              href="/login"
              className="mt-4 inline-flex rounded-full bg-amber-400 px-4 py-3 text-sm font-extrabold text-slate-950"
            >
              Log in to message
            </Link>
          )}
        </section>
      )}

      {isOwner && messages.length > 0 && (
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-teal-700">
                Inbox
              </p>
              <h2 className="text-xl font-extrabold">Traveler conversations</h2>
            </div>
            <ChatBubbleLeftRightIcon className="h-6 w-6 text-teal-700" />
          </div>
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {visitors.map((item) => (
              <button
                key={item.visitorId}
                type="button"
                onClick={() => setActiveVisitorId(item.visitorId)}
                className={`shrink-0 rounded-full px-3 py-2 text-xs font-bold ${activeVisitorId === item.visitorId ? "bg-teal-700 text-white" : "bg-slate-100 text-slate-700"}`}
              >
                {item.sender?.name ?? "Traveler"}
              </button>
            ))}
          </div>
          <div className="mt-4 max-h-64 space-y-2 overflow-y-auto rounded-2xl bg-slate-50 p-3">
            {conversation.map((item) => (
              <div
                key={item.id}
                className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${item.senderId === user?.id ? "ml-auto bg-teal-700 text-white" : "bg-white text-slate-800 shadow-sm"}`}
              >
                {item.body}
              </div>
            ))}
          </div>
          {activeVisitorId && token && (
            <form onSubmit={sendMessage} className="mt-3 flex gap-2">
              <input
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Reply to traveler…"
                className="min-w-0 flex-1 rounded-full border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-teal-600"
              />
              <button
                disabled={saving || !message.trim()}
                className="rounded-full bg-teal-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
              >
                Reply
              </button>
            </form>
          )}
        </section>
      )}

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-teal-700">
              Community voice
            </p>
            <h2 className="text-2xl font-extrabold">Traveler reviews</h2>
          </div>
          <div className="text-right">
            <p className="text-2xl font-black text-slate-950">
              {guide.rating.toFixed(1)}
            </p>
            <p className="text-xs text-slate-500">
              {guide.reviewCount} reviews
            </p>
          </div>
        </div>
        <div className="mt-4 space-y-3">
          {reviews.length === 0 ? (
            <p className="rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-500">
              No reviews yet. Be the first to share your experience.
            </p>
          ) : (
            reviews.map((review) => (
              <article
                key={review.id}
                className="rounded-2xl border border-slate-100 bg-slate-50 p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-bold text-slate-900">
                    {review.reviewer?.name ?? "Traveler"}
                  </p>
                  <Stars value={review.rating} />
                </div>
                {review.comment && (
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {review.comment}
                  </p>
                )}
                <p className="mt-2 text-xs text-slate-400">
                  {new Date(review.createdAt).toLocaleDateString()}
                </p>
              </article>
            ))
          )}
        </div>
        {!isOwner &&
          (token ? (
            <form
              onSubmit={submitReview}
              className="mt-5 space-y-3 border-t border-slate-100 pt-5"
            >
              <p className="text-sm font-bold text-slate-800">
                Share your experience
              </p>
              <Stars value={reviewRating} onChange={setReviewRating} />
              <textarea
                value={reviewText}
                onChange={(event) => setReviewText(event.target.value)}
                rows={3}
                maxLength={3000}
                placeholder="What should other travelers know?"
                className="w-full rounded-2xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-teal-600"
              />
              <button
                disabled={saving}
                className="rounded-full bg-teal-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
              >
                Post review
              </button>
            </form>
          ) : (
            <p className="mt-5 text-sm text-slate-500">
              <Link href="/login" className="font-bold text-teal-700">
                Log in
              </Link>{" "}
              to write a review.
            </p>
          ))}
      </section>
    </div>
  );
}
