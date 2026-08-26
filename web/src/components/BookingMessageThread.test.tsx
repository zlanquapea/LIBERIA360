import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BookingMessageThread from './BookingMessageThread';
import { setStoredAuth, clearStoredAuth } from '@/lib/auth-storage';
import type { AuthUser, BookingMessage } from '@/lib/types';

const ME: AuthUser = {
  id: 'guest-1',
  name: 'Guest User',
  email: 'guest@example.com',
  phone: null,
  authProvider: 'email',
  homeCounty: null,
  isAdmin: false,
  isSuperAdmin: false,
  travelerType: null,
  interests: [],
  twoFactorEnabled: false,
  emailVerified: true,
  createdAt: '2026-01-01T00:00:00.000Z',
};

const OTHER: AuthUser = { ...ME, id: 'owner-1', name: 'Business Owner' };

function message(overrides: Partial<BookingMessage>): BookingMessage {
  return {
    id: 'm1',
    bookingId: 'booking-1',
    sender: ME,
    senderUserId: ME.id,
    body: 'Hello',
    createdAt: '2026-01-02T00:00:00.000Z',
    readAt: null,
    editedAt: null,
    deletedAt: null,
    ...overrides,
  };
}

// Routes a mocked fetch by method + path suffix so each test only needs to
// describe the responses it actually cares about, in the same spirit as
// ReportButton.test.tsx's single-call mockFetchOnce but for a component
// that makes several distinct calls (list, mark-read, send). `delayMs` lets
// a test observe a transient optimistic state (e.g. "Sending…") that would
// otherwise resolve before the next assertion runs.
function mockFetch(handlers: { method: string; path: string; body: unknown; status?: number; delayMs?: number }[]) {
  const calls: { method: string; url: string; body?: unknown }[] = [];
  global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
    const method = (init?.method ?? 'GET').toUpperCase();
    calls.push({ method, url, body: init?.body ? JSON.parse(init.body as string) : undefined });
    const handler = handlers.find((h) => h.method === method && url.includes(h.path));
    if (handler?.delayMs) await new Promise((resolve) => setTimeout(resolve, handler.delayMs));
    const status = handler?.status ?? 200;
    return {
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(handler?.body ?? null),
    };
  }) as unknown as typeof fetch;
  return calls;
}

describe('BookingMessageThread', () => {
  afterEach(() => {
    clearStoredAuth();
    jest.restoreAllMocks();
  });

  it('shows a friendly empty state when there are no messages', async () => {
    setStoredAuth({ token: 'tok', user: ME });
    mockFetch([{ method: 'GET', path: '/messages', body: [] }]);

    render(<BookingMessageThread bookingId="booking-1" />);

    expect(await screen.findByText(/say hello/i)).toBeInTheDocument();
  });

  it('labels an own message "Delivered" until it has been read, then "Viewed"', async () => {
    setStoredAuth({ token: 'tok', user: ME });
    mockFetch([
      {
        method: 'GET',
        path: '/messages',
        body: [
          message({ id: 'm1', body: 'Not read yet', readAt: null }),
          message({ id: 'm2', body: 'Already seen', readAt: '2026-01-02T01:00:00.000Z' }),
        ],
      },
    ]);

    render(<BookingMessageThread bookingId="booking-1" />);

    await screen.findByText('Not read yet');
    expect(screen.getByText('Already seen')).toBeInTheDocument();
    expect(screen.getByText('Delivered')).toBeInTheDocument();
    expect(screen.getByText('Viewed')).toBeInTheDocument();
  });

  it("doesn't show a status label under the other participant's messages", async () => {
    setStoredAuth({ token: 'tok', user: ME });
    mockFetch([
      { method: 'GET', path: '/messages', body: [message({ id: 'm1', senderUserId: OTHER.id, sender: OTHER })] },
    ]);

    render(<BookingMessageThread bookingId="booking-1" />);

    await screen.findByText('Hello');
    expect(screen.queryByText('Delivered')).not.toBeInTheDocument();
    expect(screen.queryByText('Viewed')).not.toBeInTheDocument();
  });

  it('marks the other participant\'s unread messages as read on load', async () => {
    setStoredAuth({ token: 'tok', user: ME });
    const calls = mockFetch([
      { method: 'GET', path: '/messages', body: [message({ id: 'm1', senderUserId: OTHER.id, sender: OTHER, readAt: null })] },
      { method: 'PATCH', path: '/messages/read', body: { success: true } },
    ]);

    render(<BookingMessageThread bookingId="booking-1" />);
    await screen.findByText('Hello');

    await waitFor(() => expect(calls.some((c) => c.method === 'PATCH' && c.url.includes('/messages/read'))).toBe(true));
  });

  it('shows an optimistic "Sending…" bubble that resolves to "Delivered"', async () => {
    setStoredAuth({ token: 'tok', user: ME });
    const sentMessage = message({ id: 'm-new', body: 'What time is check-in?' });
    mockFetch([
      { method: 'GET', path: '/messages', body: [] },
      { method: 'POST', path: '/messages', body: sentMessage, delayMs: 30 },
    ]);

    render(<BookingMessageThread bookingId="booking-1" />);
    await screen.findByText(/say hello/i);

    await userEvent.type(screen.getByPlaceholderText(/write a message/i), 'What time is check-in?');
    await userEvent.click(screen.getByRole('button', { name: /send message/i }));

    expect(await screen.findByText('Sending…')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Delivered')).toBeInTheDocument());
    expect(screen.queryByText('Sending…')).not.toBeInTheDocument();
  });

  it('only shows Edit/Delete controls under your own messages', async () => {
    setStoredAuth({ token: 'tok', user: ME });
    mockFetch([
      {
        method: 'GET',
        path: '/messages',
        body: [
          message({ id: 'm1', body: 'Mine', senderUserId: ME.id, sender: ME, readAt: '2026-01-02T01:00:00.000Z' }),
          message({ id: 'm2', body: 'Theirs', senderUserId: OTHER.id, sender: OTHER }),
        ],
      },
    ]);

    render(<BookingMessageThread bookingId="booking-1" />);
    await screen.findByText('Mine');
    await screen.findByText('Theirs');

    expect(screen.getAllByRole('button', { name: /^edit$/i })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: /^delete$/i })).toHaveLength(1);
  });

  it('edits an own message inline and shows an "(edited)" marker afterward', async () => {
    setStoredAuth({ token: 'tok', user: ME });
    const edited = message({ id: 'm1', body: 'Corrected text', editedAt: '2026-01-02T02:00:00.000Z' });
    const calls = mockFetch([
      { method: 'GET', path: '/messages', body: [message({ id: 'm1', body: 'Original text' })] },
      { method: 'PATCH', path: '/messages/m1', body: edited },
    ]);

    render(<BookingMessageThread bookingId="booking-1" />);
    await screen.findByText('Original text');

    await userEvent.click(screen.getByRole('button', { name: /^edit$/i }));
    const textbox = screen.getByDisplayValue('Original text');
    await userEvent.clear(textbox);
    await userEvent.type(textbox, 'Corrected text');
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await screen.findByText('Corrected text');
    expect(screen.getByText('(edited)')).toBeInTheDocument();
    const patchCall = calls.find((c) => c.method === 'PATCH' && c.url.includes('/messages/m1'));
    expect(patchCall?.body).toEqual({ body: 'Corrected text' });
  });

  it('deletes an own message after confirming, showing a "deleted" placeholder', async () => {
    setStoredAuth({ token: 'tok', user: ME });
    const calls = mockFetch([
      { method: 'GET', path: '/messages', body: [message({ id: 'm1', body: 'Oops, wrong booking' })] },
      { method: 'DELETE', path: '/messages/m1', body: { success: true } },
    ]);

    render(<BookingMessageThread bookingId="booking-1" />);
    await screen.findByText('Oops, wrong booking');

    await userEvent.click(screen.getByRole('button', { name: /^delete$/i }));
    await userEvent.click(await screen.findByRole('button', { name: /delete message/i }));

    await screen.findByText(/this message was deleted/i);
    expect(screen.queryByText('Oops, wrong booking')).not.toBeInTheDocument();
    expect(calls.some((c) => c.method === 'DELETE' && c.url.includes('/messages/m1'))).toBe(true);
  });
});
