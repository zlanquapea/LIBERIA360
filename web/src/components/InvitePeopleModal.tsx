'use client';

import { useEffect, useState } from 'react';
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { createInvitations, searchInvitablePeople } from '@/lib/invitations-api';
import { HttpError } from '@/lib/http';
import type { InvitableUser } from '@/lib/types';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// "Invite People" (Section 7): search-and-pick platform users, plus
// invite-by-email for anyone who isn't on the platform yet — both in one
// flow, sent together as a single batch (allow multiple invitations in
// one flow).
export function InvitePeopleModal({
  itineraryId,
  token,
  onClose,
  onInvited,
}: {
  itineraryId: string;
  token: string;
  onClose: () => void;
  onInvited: () => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<InvitableUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedPeople, setSelectedPeople] = useState<Map<string, InvitableUser>>(new Map());
  const [emailInput, setEmailInput] = useState('');
  const [emailQueue, setEmailQueue] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Same 300ms debounce idiom as CreatorFilters/BusinessFilters.
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    const id = setTimeout(() => {
      searchInvitablePeople(token, itineraryId, query.trim())
        .then(setResults)
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(id);
  }, [query, token, itineraryId]);

  function togglePerson(person: InvitableUser) {
    setSelectedPeople((prev) => {
      const next = new Map(prev);
      if (next.has(person.id)) next.delete(person.id);
      else next.set(person.id, person);
      return next;
    });
  }

  function queueEmail() {
    const email = emailInput.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) {
      setError('Enter a valid email address.');
      return;
    }
    if (emailQueue.includes(email)) {
      setEmailInput('');
      return;
    }
    setEmailQueue((prev) => [...prev, email]);
    setEmailInput('');
    setError(null);
  }

  function removeQueuedEmail(email: string) {
    setEmailQueue((prev) => prev.filter((e) => e !== email));
  }

  const totalInvitees = selectedPeople.size + emailQueue.length;

  async function sendInvitations() {
    if (totalInvitees === 0) return;
    setSending(true);
    setError(null);
    try {
      await createInvitations(token, itineraryId, [
        ...Array.from(selectedPeople.keys()).map((userId) => ({ userId })),
        ...emailQueue.map((email) => ({ email })),
      ]);
      onInvited();
      onClose();
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Could not send invitations.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Invite people to this trip"
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-md flex-col gap-4 overflow-y-auto rounded-2xl bg-white p-5 shadow-xl dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-50">Invite people</h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
          >
            <XMarkIcon aria-hidden className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">People on LIBERIA360</p>
          <div className="relative">
            <MagnifyingGlassIcon
              aria-hidden
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or email…"
              className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-800"
            />
          </div>

          {selectedPeople.size > 0 && (
            <ul className="flex flex-wrap gap-1.5">
              {Array.from(selectedPeople.values()).map((p) => (
                <li
                  key={p.id}
                  className="flex items-center gap-1 rounded-full bg-brand-700 px-2.5 py-1 text-xs font-medium text-white"
                >
                  {p.name}
                  <button
                    type="button"
                    aria-label={`Remove ${p.name}`}
                    onClick={() => togglePerson(p)}
                    className="text-brand-100 hover:text-white"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}

          {searching && <p className="text-xs text-slate-400 dark:text-slate-400">Searching…</p>}

          {!searching && query.trim().length >= 2 && (
            <ul className="flex max-h-40 flex-col gap-1 overflow-y-auto">
              {results.length === 0 ? (
                <li className="px-1 py-2 text-xs text-slate-400 dark:text-slate-400">No matches — try inviting by email below.</li>
              ) : (
                results.map((person) => {
                  const isSelected = selectedPeople.has(person.id);
                  return (
                    <li key={person.id}>
                      <button
                        type="button"
                        onClick={() => togglePerson(person)}
                        aria-pressed={isSelected}
                        className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm transition-colors ${
                          isSelected
                            ? 'bg-brand-50 text-brand-800 dark:bg-brand-900/30 dark:text-brand-200'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                      >
                        <span
                          aria-hidden
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-200"
                        >
                          {person.name.trim().charAt(0).toUpperCase() || '?'}
                        </span>
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate font-medium text-slate-800 dark:text-slate-100">{person.name}</span>
                          <span className="truncate text-xs text-slate-400 dark:text-slate-400">{person.maskedEmail}</span>
                        </span>
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          )}
        </div>

        <div className="flex flex-col gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Invite someone by email</p>
          <p className="text-xs text-slate-400 dark:text-slate-400">
            They don&apos;t need an account yet — we&apos;ll email them an invitation, and they can join once they create one.
          </p>
          <div className="flex gap-2">
            <input
              type="email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  queueEmail();
                }
              }}
              placeholder="name@example.com"
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-800"
            />
            <button
              type="button"
              onClick={queueEmail}
              disabled={!emailInput.trim()}
              className="shrink-0 rounded-full border border-brand-700 px-3 py-2 text-xs font-semibold text-brand-700 hover:bg-brand-50 disabled:opacity-50 dark:text-brand-300 dark:hover:bg-brand-900/20"
            >
              Add
            </button>
          </div>

          {emailQueue.length > 0 && (
            <ul className="flex flex-wrap gap-1.5">
              {emailQueue.map((email) => (
                <li
                  key={email}
                  className="flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  {email}
                  <button
                    type="button"
                    aria-label={`Remove ${email}`}
                    onClick={() => removeQueuedEmail(email)}
                    className="text-slate-400 hover:text-flag-700 dark:hover:text-flag-300"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {error && <p role="alert" className="text-xs text-flag-700 dark:text-flag-300">{error}</p>}

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={sendInvitations}
            disabled={sending || totalInvitees === 0}
            className="rounded-full bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
          >
            {sending
              ? 'Sending…'
              : totalInvitees > 0
                ? `Send ${totalInvitees} invitation${totalInvitees === 1 ? '' : 's'}`
                : 'Send invitations'}
          </button>
        </div>
      </div>
    </div>
  );
}
