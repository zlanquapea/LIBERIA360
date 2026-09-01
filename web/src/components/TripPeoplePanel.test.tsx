import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TripPeoplePanel } from './TripPeoplePanel';
import { setStoredAuth, clearStoredAuth } from '@/lib/auth-storage';
import type { AuthUser, InvitationSummary } from '@/lib/types';

const OWNER: AuthUser = {
  id: 'owner-1',
  name: 'Trip Owner',
  email: 'owner@example.com',
  phone: null,
  authProvider: 'email',
  homeCounty: null,
  isAdmin: false,
  isSuperAdmin: false,
  travelerType: null,
  interests: [],
  twoFactorEnabled: false,
  emailVerified: true,
  pendingActivation: false,
  createdAt: '2026-01-01T00:00:00.000Z',
};

const COLLABORATOR: AuthUser = { ...OWNER, id: 'collab-1', name: 'Marcus Traveler', email: 'marcus@example.com' };

function pendingInvitation(overrides: Partial<InvitationSummary> = {}): InvitationSummary {
  return {
    id: 'invite-1',
    email: 'friend@example.com',
    status: 'pending',
    invitee: null,
    emailDelivered: true,
    createdAt: '2026-01-02T00:00:00.000Z',
    respondedAt: null,
    expiresAt: '2026-01-16T00:00:00.000Z',
    ...overrides,
  };
}

function mockFetch(handlers: { method: string; path: string; body: unknown; status?: number }[]) {
  const calls: { method: string; url: string; body?: unknown }[] = [];
  global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
    const method = (init?.method ?? 'GET').toUpperCase();
    calls.push({ method, url: String(url) });
    const handler = handlers.find((h) => h.method === method && String(url).includes(h.path));
    const status = handler?.status ?? 200;
    return {
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(handler?.body ?? []),
    };
  }) as unknown as typeof fetch;
  return calls;
}

describe('TripPeoplePanel', () => {
  afterEach(() => {
    clearStoredAuth();
    jest.restoreAllMocks();
  });

  // Regression test: removing a collaborator already required confirmation
  // before this fix — kept as a baseline so the sibling invitation-cancel
  // fix below doesn't accidentally regress it.
  it('asks for confirmation before removing a collaborator, and only calls the API once confirmed', async () => {
    setStoredAuth({ token: 'tok', user: OWNER });
    const calls = mockFetch([
      { method: 'GET', path: '/invitations', body: [] },
      { method: 'GET', path: '/join-requests', body: [] },
      { method: 'DELETE', path: `/collaborators/${COLLABORATOR.id}`, body: [] },
    ]);

    render(
      <TripPeoplePanel
        itineraryId="trip-1"
        admin={OWNER}
        collaborators={[COLLABORATOR]}
        isOwner
        onChange={() => undefined}
      />,
    );
    await screen.findByText('Marcus Traveler');

    await userEvent.click(screen.getByRole('button', { name: /remove marcus traveler/i }));
    expect(await screen.findByText(/remove marcus traveler from this trip/i)).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'DELETE')).toBe(false);

    await userEvent.click(screen.getByRole('button', { name: /^remove$/i }));
    await waitFor(() => expect(calls.some((c) => c.method === 'DELETE')).toBe(true));
  });

  // The actual bug report: cancelling a pending invitation's × used to fire
  // immediately with no confirmation, unlike removing a collaborator.
  it('asks for confirmation before cancelling a pending invitation, and only calls the API once confirmed', async () => {
    setStoredAuth({ token: 'tok', user: OWNER });
    const invitation = pendingInvitation();
    const calls = mockFetch([
      { method: 'GET', path: '/invitations', body: [invitation] },
      { method: 'GET', path: '/join-requests', body: [] },
      { method: 'DELETE', path: `/invitations/${invitation.id}`, body: [] },
    ]);

    render(
      <TripPeoplePanel itineraryId="trip-1" admin={OWNER} collaborators={[]} isOwner onChange={() => undefined} />,
    );
    await screen.findByText(invitation.email);

    await userEvent.click(screen.getByRole('button', { name: /cancel invitation to friend@example.com/i }));
    expect(await screen.findByText(/cancel the invitation to friend@example\.com/i)).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'DELETE')).toBe(false);

    await userEvent.click(screen.getByRole('button', { name: /^cancel invitation$/i }));
    await waitFor(() => expect(calls.some((c) => c.method === 'DELETE')).toBe(true));
  });

  it('leaves the invitation untouched when the confirmation is dismissed', async () => {
    setStoredAuth({ token: 'tok', user: OWNER });
    const invitation = pendingInvitation();
    const calls = mockFetch([
      { method: 'GET', path: '/invitations', body: [invitation] },
      { method: 'GET', path: '/join-requests', body: [] },
    ]);

    render(
      <TripPeoplePanel itineraryId="trip-1" admin={OWNER} collaborators={[]} isOwner onChange={() => undefined} />,
    );
    await screen.findByText(invitation.email);

    await userEvent.click(screen.getByRole('button', { name: /cancel invitation to friend@example.com/i }));
    await screen.findByText(/cancel the invitation to friend@example\.com/i);

    await userEvent.click(screen.getByRole('button', { name: /^keep it$/i }));

    expect(screen.queryByText(/cancel the invitation to friend@example\.com/i)).not.toBeInTheDocument();
    expect(screen.getByText(invitation.email)).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'DELETE')).toBe(false);
  });
});
