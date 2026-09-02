"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { useAuth } from "@/hooks/useAuth";
import { BrandLoader } from "@/components/BrandLoader";
import { SupportHelpNav } from "@/components/SupportHelpNav";
import { createSupportTicket } from "@/lib/support-api";
import { uploadImage } from "@/lib/uploads-api";
import { getFriendlyErrorMessage } from "@/lib/errors";
import type { SupportTicketCategory } from "@/lib/types";

const categories: SupportTicketCategory[] = [
  "account",
  "booking",
  "payment",
  "listing",
  "technical",
  "safety",
  "feedback",
  "other",
];
const categoryLabel: Record<SupportTicketCategory, string> = {
  account: "Account, login, or profile",
  booking: "Booking or reservation",
  payment: "Payment or event ticket",
  listing: "Business, place, or car listing",
  technical: "Technical problem",
  safety: "Safety or suspicious activity",
  feedback: "Feedback or suggestion",
  other: "Advertisement or other issue",
};

// A dedicated page for the one thing "New ticket" used to interrupt a
// scroll of past tickets to do: this used to be a form that toggled open
// on top of /account/support's list, so creating a ticket and reviewing
// old ones competed for the same screen. Splitting it out means the list
// page stays a list, and this page can give the how-to-ask-well guidance
// room to breathe without pushing the ticket list further down.
export default function NewSupportTicketPage() {
  const router = useRouter();
  const { token, ready } = useAuth();
  const [category, setCategory] = useState<SupportTicketCategory>("technical");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [attachments, setAttachments] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function addFiles(files: FileList | null) {
    if (!token || !files) return;
    setBusy(true);
    try {
      const urls = await Promise.all(
        Array.from(files)
          .slice(0, 5 - attachments.length)
          .map((f) => uploadImage(token, f)),
      );
      setAttachments((old) => [...old, ...urls]);
    } catch (e) {
      setError(getFriendlyErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setBusy(true);
    setError("");
    try {
      const ticket = await createSupportTicket(token, {
        category,
        subject,
        description,
        attachments,
      });
      // Straight into the new thread — that's where the customer will
      // watch for a reply, not back on the list they just came from.
      router.push(`/account/support/${ticket.id}`);
    } catch (err) {
      setError(getFriendlyErrorMessage(err));
      setBusy(false);
    }
  }

  if (!ready)
    return (
      <main className="flex min-h-[70vh] flex-col items-center justify-center gap-5 px-4">
        <BrandLoader />
        <p className="text-sm font-medium tracking-wide text-slate-500 dark:text-slate-400">Loading…</p>
      </main>
    );
  if (!token)
    return (
      <main className="mx-auto max-w-md p-8 text-center">
        <h1 className="text-2xl font-bold">Submit a ticket</h1>
        <p className="mt-3 text-slate-500">
          Please{" "}
          <Link className="text-brand-700 underline" href="/login">
            log in
          </Link>{" "}
          to contact support.
        </p>
      </main>
    );
  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <Link
        href="/account/support"
        className="flex w-fit items-center gap-1 text-sm font-semibold text-brand-700"
      >
        <ArrowLeftIcon aria-hidden className="h-4 w-4" /> My support requests
      </Link>

      <SupportHelpNav />

      <header>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          Submit a ticket
        </h1>
        <p className="text-sm text-slate-500">
          Report a problem and a support agent will follow up here.
        </p>
      </header>

      {error && (
        <p
          role="alert"
          className="rounded-xl bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </p>
      )}

      <section className="rounded-2xl border border-brand-200 bg-brand-50/70 p-4 dark:border-brand-900/60 dark:bg-brand-950/20">
        <h2 className="font-bold text-slate-900 dark:text-white">Before you submit</h2>
        <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">Choose the closest category, include the affected listing, booking, advertisement, account, or ticket reference, and describe what happened. Add a screenshot when useful. Never include your password, verification code, or full payment credentials.</p>
        <div className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-2 dark:text-slate-300">
          <p><strong>Bookings:</strong> choose Booking and include dates or request details.</p>
          <p><strong>Businesses:</strong> choose Listing and include the business or place name.</p>
          <p><strong>Advertisements:</strong> choose Other and include the ad title or link.</p>
          <p><strong>Accounts:</strong> choose Account and include the affected screen.</p>
          <p><strong>Event tickets:</strong> choose Payment and include the event or ticket reference. Do not share the QR payload.</p>
        </div>
      </section>

      <form
        onSubmit={submit}
        className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
      >
        <label className="block text-sm font-semibold">
          Issue category
          <select
            value={category}
            onChange={(e) =>
              setCategory(e.target.value as SupportTicketCategory)
            }
            className="mt-1 w-full rounded-xl border p-3 dark:bg-slate-950"
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {categoryLabel[c]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-semibold">
          Subject
          <input
            required
            minLength={3}
            maxLength={180}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="mt-1 w-full rounded-xl border p-3 dark:bg-slate-950"
          />
        </label>
        <label className="block text-sm font-semibold">
          What happened?
          <textarea
            required
            minLength={10}
            rows={6}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1 w-full rounded-xl border p-3 dark:bg-slate-950"
          />
        </label>
        <label className="block text-sm font-semibold">
          Screenshots (up to 5)
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => void addFiles(e.target.files)}
            className="mt-2 block text-sm"
          />
        </label>
        {attachments.length > 0 && (
          <div className="flex gap-2">
            {attachments.map((url, i) => (
              <img
                key={url}
                src={url}
                alt={`Attachment ${i + 1}`}
                className="h-16 w-16 rounded-lg object-cover"
              />
            ))}
          </div>
        )}
        <div className="flex items-center gap-3">
          <button
            disabled={busy}
            className="rounded-full bg-brand-700 px-5 py-2.5 font-semibold text-white disabled:opacity-50"
          >
            {busy ? "Submitting…" : "Submit ticket"}
          </button>
          <Link
            href="/account/support"
            className="text-sm font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          >
            Cancel
          </Link>
        </div>
      </form>
    </main>
  );
}
