"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { BrandLoader } from "@/components/BrandLoader";
import { getMySupportTickets } from "@/lib/support-api";
import { getFriendlyErrorMessage } from "@/lib/errors";
import type { SupportTicket, SupportTicketCategory, SupportTicketStatus } from "@/lib/types";

const label = (value: string) =>
  value.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
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
const OPEN_STATUSES: SupportTicketStatus[] = ["open", "in_progress", "waiting_for_customer"];

// The ticket list only — creating a ticket now lives at its own
// /account/support/new page (see that file for why) so a customer
// checking on old requests never has to scroll past a form to get to
// them, and one submitting a new request never has to scroll past a
// list of old ones to find the form.
export default function CustomerSupportPage() {
  const { token, ready } = useAuth();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (token)
      getMySupportTickets(token)
        .then(setTickets)
        .catch((e) => setError(getFriendlyErrorMessage(e)));
  }, [token]);

  const openCount = useMemo(
    () => tickets.filter((t) => OPEN_STATUSES.includes(t.status)).length,
    [tickets],
  );

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
        <h1 className="text-2xl font-bold">Customer Support</h1>
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
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Customer Support
          </h1>
          <p className="text-sm text-slate-500">
            Track every request you&apos;ve sent us, in one place.
          </p>
        </div>
        <Link
          href="/account/support/new"
          className="shrink-0 rounded-full bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800"
        >
          New ticket
        </Link>
      </header>

      {error && (
        <p
          role="alert"
          className="rounded-xl bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </p>
      )}

      {tickets.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Open</p>
            <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{openCount}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Resolved</p>
            <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
              {tickets.length - openCount}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total</p>
            <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{tickets.length}</p>
          </div>
        </div>
      )}

      <section>
        {tickets.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-8 text-center text-slate-500">
            <p>You have not submitted a support ticket yet.</p>
            <Link
              href="/account/support/new"
              className="mt-3 inline-block rounded-full bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-800"
            >
              Submit your first ticket
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {tickets.map((ticket) => (
              <Link
                key={ticket.id}
                href={`/account/support/${ticket.id}`}
                className="block rounded-2xl border border-slate-200 bg-white p-4 hover:border-brand-400 dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex justify-between gap-3">
                  <div>
                    <p className="font-semibold">{ticket.subject}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {ticket.reference} · {categoryLabel[ticket.category]} ·{" "}
                      {new Date(ticket.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <span className="h-fit rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700 dark:bg-brand-950 dark:text-brand-300">
                    {label(ticket.status)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
