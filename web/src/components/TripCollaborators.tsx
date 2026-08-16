'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { inviteCollaborator, removeCollaborator } from '@/lib/itinerary-api';
import { HttpError } from '@/lib/http';
import type { AuthUser } from '@/lib/types';

// Wanderlog/TripIt-style collaborative trip planning: the owner invites
// other users by email, and everyone listed here can view and edit the
// trip's stops right alongside the owner.
export function TripCollaborators({
  itineraryId,
  collaborators,
  isOwner,
  onChange,
}: {
  itineraryId: string;
  collaborators: AuthUser[];
  isOwner: boolean;
  onChange: () => void;
}) {
  const { user, token } = useAuth();
  const [email, setEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function invite() {
    if (!token || !email.trim()) return;
    setInviting(true);
    setError(null);
    try {
      await inviteCollaborator(token, itineraryId, email.trim());
      setEmail('');
      onChange();
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Could not invite this person.');
    } finally {
      setInviting(false);
    }
  }

  async function remove(userId: string) {
    if (!token) return;
    await removeCollaborator(token, itineraryId, userId);
    onChange();
  }

  return (
    <section className="flex flex-col gap-2 rounded-xl border border-slate-200 p-3">
      <p className="text-sm font-medium text-slate-700">Planning together</p>

      {collaborators.length === 0 ? (
        <p className="text-xs text-slate-500">Just you so far — invite someone to plan this trip together.</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {collaborators.map((c) => (
            <li
              key={c.id}
              className="flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700"
            >
              {c.name}
              {(isOwner || c.id === user?.id) && (
                <button
                  type="button"
                  onClick={() => remove(c.id)}
                  aria-label={`Remove ${c.name}`}
                  className="text-slate-400 hover:text-flag-700"
                >
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {isOwner && (
        <div className="flex gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                invite();
              }
            }}
            placeholder="Invite by email"
            className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
          />
          <button
            type="button"
            disabled={inviting || !email.trim()}
            onClick={invite}
            className="shrink-0 rounded-full bg-brand-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
          >
            {inviting ? 'Inviting…' : 'Invite'}
          </button>
        </div>
      )}
      {error && <p className="text-xs text-flag-700">{error}</p>}
    </section>
  );
}
