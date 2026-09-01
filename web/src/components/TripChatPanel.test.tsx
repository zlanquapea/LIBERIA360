import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TripChatPanel } from './TripChatPanel';
import { setStoredAuth, clearStoredAuth } from '@/lib/auth-storage';
import type { AuthUser, TripMessage } from '@/lib/types';

const ME: AuthUser = {
  id: 'member-1',
  name: 'Trip Member',
  email: 'member@example.com',
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

const OTHER: AuthUser = { ...ME, id: 'member-2', name: 'Other Member' };

function tripMessage(overrides: Partial<TripMessage> = {}): TripMessage {
  return {
    id: 'm1',
    itineraryId: 'trip-1',
    type: 'user',
    sender: ME,
    body: 'Hello trip!',
    imageUrl: null,
    clientId: null,
    replyTo: null,
    reactions: [],
    createdAt: '2026-01-02T00:00:00.000Z',
    editedAt: null,
    deletedAt: null,
    status: 'sent',
    ...overrides,
  };
}

// Same routing convention as BookingMessageThread.test.tsx's mockFetch, but
// tolerant of a non-JSON (FormData) request body — TripChatPanel's image
// flow calls uploadImage(), which posts multipart, not JSON.
function mockFetch(handlers: { method: string; path: string; body: unknown; status?: number; delayMs?: number }[]) {
  const calls: { method: string; url: string; body?: unknown }[] = [];
  global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
    const method = (init?.method ?? 'GET').toUpperCase();
    let body: unknown;
    if (typeof init?.body === 'string') {
      try {
        body = JSON.parse(init.body);
      } catch {
        body = init.body;
      }
    }
    calls.push({ method, url, body });
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

// TripChatPanel polls on an interval and fires delivered/read beacons on
// every poll — give every test a catch-all for those so an un-asserted
// background call never causes an "unhandled" surprise or a console error.
function baseHandlers(messages: TripMessage[] = []) {
  return [
    { method: 'GET', path: '/messages', body: messages },
    { method: 'POST', path: '/delivered', body: null },
    { method: 'POST', path: '/read', body: null },
  ];
}

describe('TripChatPanel', () => {
  beforeAll(() => {
    // jsdom has no createObjectURL/revokeObjectURL — TripChatPanel calls it
    // for the composer's local image preview when a file is picked.
    URL.createObjectURL = jest.fn(() => 'blob:mock-preview');
    URL.revokeObjectURL = jest.fn();
  });

  afterEach(() => {
    clearStoredAuth();
    jest.restoreAllMocks();
  });

  it('shows a friendly empty state when there are no messages', async () => {
    setStoredAuth({ token: 'tok', user: ME });
    mockFetch(baseHandlers([]));

    render(<TripChatPanel itineraryId="trip-1" />);

    expect(await screen.findByText(/say hello/i)).toBeInTheDocument();
  });

  it("renders another member's message with their name and no status row", async () => {
    setStoredAuth({ token: 'tok', user: ME });
    mockFetch(baseHandlers([tripMessage({ id: 'm1', sender: OTHER, body: 'Hi everyone' })]));

    render(<TripChatPanel itineraryId="trip-1" />);

    await screen.findByText('Hi everyone');
    expect(screen.getByText('Other Member')).toBeInTheDocument();
    expect(screen.queryByText('Sent')).not.toBeInTheDocument();
    expect(screen.queryByText('Delivered')).not.toBeInTheDocument();
    expect(screen.queryByText('Read')).not.toBeInTheDocument();
  });

  it('renders a centered system message without bubble chrome', async () => {
    setStoredAuth({ token: 'tok', user: ME });
    mockFetch(
      baseHandlers([
        tripMessage({ id: 'sys-1', type: 'system', sender: null, body: 'Other Member joined the trip.' }),
      ]),
    );

    render(<TripChatPanel itineraryId="trip-1" />);

    expect(await screen.findByText('Other Member joined the trip.')).toBeInTheDocument();
  });

  it('marks the thread delivered and read once messages load', async () => {
    setStoredAuth({ token: 'tok', user: ME });
    const calls = mockFetch(baseHandlers([tripMessage({ sender: OTHER })]));

    render(<TripChatPanel itineraryId="trip-1" />);
    await screen.findByText('Hello trip!');

    await waitFor(() => expect(calls.some((c) => c.method === 'POST' && c.url.includes('/delivered'))).toBe(true));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST' && c.url.includes('/read'))).toBe(true));
  });

  it('sends a text message optimistically, showing "Sending…" then the resolved status', async () => {
    setStoredAuth({ token: 'tok', user: ME });
    const sent = tripMessage({ id: 'm-new', body: 'What time do we leave?' });
    mockFetch([...baseHandlers([]), { method: 'POST', path: '/messages', body: sent, delayMs: 30 }]);

    render(<TripChatPanel itineraryId="trip-1" />);
    await screen.findByText(/say hello/i);

    await userEvent.type(screen.getByPlaceholderText(/message the trip/i), 'What time do we leave?');
    await userEvent.click(screen.getByRole('button', { name: /send message/i }));

    expect(await screen.findByText('Sending…')).toBeInTheDocument();
    // The pending bubble already renders the same text optimistically, so
    // the resolved "Sent" status label (only shown once the POST returns)
    // is the real signal that the optimistic bubble has been replaced.
    await screen.findByText('Sent');
    expect(screen.queryByText('Sending…')).not.toBeInTheDocument();
    expect(screen.getByText('What time do we leave?')).toBeInTheDocument();
  });

  it('includes the replied-to message id when sending a reply', async () => {
    setStoredAuth({ token: 'tok', user: ME });
    const original = tripMessage({ id: 'm1', sender: OTHER, body: 'Pack sunscreen' });
    const reply = tripMessage({ id: 'm2', body: 'Will do!', replyTo: { id: 'm1', senderName: 'Other Member', body: 'Pack sunscreen', imageUrl: null, deleted: false } });
    const calls = mockFetch([...baseHandlers([original]), { method: 'POST', path: '/messages', body: reply }]);

    render(<TripChatPanel itineraryId="trip-1" />);
    await screen.findByText('Pack sunscreen');

    await userEvent.click(screen.getByRole('button', { name: /reply/i }));
    expect(await screen.findByText(/replying to/i)).toBeInTheDocument();

    await userEvent.type(screen.getByPlaceholderText(/message the trip/i), 'Will do!');
    await userEvent.click(screen.getByRole('button', { name: /send message/i }));

    await waitFor(() => expect(screen.getByText('Will do!')).toBeInTheDocument());
    const postCall = calls.find((c) => c.method === 'POST' && c.url.includes('/messages'));
    expect(postCall?.body).toMatchObject({ body: 'Will do!', replyToMessageId: 'm1' });
  });

  it('shows the quoted parent above a reply', async () => {
    setStoredAuth({ token: 'tok', user: ME });
    mockFetch(
      baseHandlers([
        tripMessage({
          id: 'm2',
          sender: OTHER,
          body: 'Will do!',
          replyTo: { id: 'm1', senderName: 'Trip Member', body: 'Pack sunscreen', imageUrl: null, deleted: false },
        }),
      ]),
    );

    render(<TripChatPanel itineraryId="trip-1" />);

    await screen.findByText('Will do!');
    expect(screen.getByText(/pack sunscreen/i)).toBeInTheDocument();
  });

  it('only shows Edit/Delete controls and a status row under your own messages', async () => {
    setStoredAuth({ token: 'tok', user: ME });
    mockFetch(
      baseHandlers([
        tripMessage({ id: 'm1', body: 'Mine', sender: ME, status: 'read' }),
        tripMessage({ id: 'm2', body: 'Theirs', sender: OTHER }),
      ]),
    );

    render(<TripChatPanel itineraryId="trip-1" />);
    await screen.findByText('Mine');
    await screen.findByText('Theirs');

    expect(screen.getAllByRole('button', { name: /^edit$/i })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: /^delete$/i })).toHaveLength(1);
    expect(screen.getByText('Read')).toBeInTheDocument();
  });

  it('edits an own message inline and shows an "(edited)" marker afterward', async () => {
    setStoredAuth({ token: 'tok', user: ME });
    const edited = tripMessage({ id: 'm1', body: 'Corrected plan', editedAt: '2026-01-02T02:00:00.000Z' });
    const calls = mockFetch([
      ...baseHandlers([tripMessage({ id: 'm1', body: 'Original plan' })]),
      { method: 'PATCH', path: '/messages/m1', body: edited },
    ]);

    render(<TripChatPanel itineraryId="trip-1" />);
    await screen.findByText('Original plan');

    await userEvent.click(screen.getByRole('button', { name: /^edit$/i }));
    const textbox = screen.getByDisplayValue('Original plan');
    await userEvent.clear(textbox);
    await userEvent.type(textbox, 'Corrected plan');
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await screen.findByText('Corrected plan');
    expect(screen.getByText('(edited)')).toBeInTheDocument();
    const patchCall = calls.find((c) => c.method === 'PATCH' && c.url.includes('/messages/m1'));
    expect(patchCall?.body).toEqual({ body: 'Corrected plan' });
  });

  it('deletes an own message after confirming, showing a "deleted" placeholder', async () => {
    setStoredAuth({ token: 'tok', user: ME });
    const calls = mockFetch([
      ...baseHandlers([tripMessage({ id: 'm1', body: 'Oops wrong trip' })]),
      { method: 'DELETE', path: '/messages/m1', body: tripMessage({ id: 'm1', body: null, deletedAt: '2026-01-02T03:00:00.000Z' }) },
    ]);

    render(<TripChatPanel itineraryId="trip-1" />);
    await screen.findByText('Oops wrong trip');

    await userEvent.click(screen.getByRole('button', { name: /^delete$/i }));
    await userEvent.click(await screen.findByRole('button', { name: /delete message/i }));

    await screen.findByText(/this message was deleted/i);
    expect(screen.queryByText('Oops wrong trip')).not.toBeInTheDocument();
    expect(calls.some((c) => c.method === 'DELETE' && c.url.includes('/messages/m1'))).toBe(true);
  });

  it('toggles a reaction from the picker and reflects the updated count', async () => {
    setStoredAuth({ token: 'tok', user: ME });
    const reacted = tripMessage({ id: 'm1', sender: OTHER, reactions: [{ emoji: '👍', count: 1, userIds: [ME.id] }] });
    const calls = mockFetch([
      ...baseHandlers([tripMessage({ id: 'm1', sender: OTHER })]),
      { method: 'POST', path: '/messages/m1/reactions', body: reacted },
    ]);

    render(<TripChatPanel itineraryId="trip-1" />);
    await screen.findByText('Hello trip!');

    await userEvent.click(screen.getByRole('button', { name: /react/i }));
    await userEvent.click(await screen.findByText('👍'));

    await waitFor(() => expect(screen.getByText('1')).toBeInTheDocument());
    const reactCall = calls.find((c) => c.method === 'POST' && c.url.includes('/reactions'));
    expect(reactCall?.body).toEqual({ emoji: '👍' });
  });

  it('lets a failed send be retried, and clears the failure once it succeeds', async () => {
    setStoredAuth({ token: 'tok', user: ME });
    let attempt = 0;
    global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
      const method = (init?.method ?? 'GET').toUpperCase();
      if (method === 'GET' && String(url).includes('/messages')) {
        return { ok: true, status: 200, json: () => Promise.resolve([]) };
      }
      if (method === 'POST' && (String(url).includes('/delivered') || String(url).includes('/read'))) {
        return { ok: true, status: 204, json: () => Promise.resolve(null) };
      }
      if (method === 'POST' && String(url).endsWith('/messages')) {
        attempt += 1;
        if (attempt === 1) {
          return { ok: false, status: 500, json: () => Promise.resolve({ message: 'Server error' }) };
        }
        return { ok: true, status: 201, json: () => Promise.resolve(tripMessage({ id: 'm-retry', body: 'Retry me' })) };
      }
      return { ok: true, status: 200, json: () => Promise.resolve(null) };
    }) as unknown as typeof fetch;

    render(<TripChatPanel itineraryId="trip-1" />);
    await screen.findByText(/say hello/i);

    await userEvent.type(screen.getByPlaceholderText(/message the trip/i), 'Retry me');
    await userEvent.click(screen.getByRole('button', { name: /send message/i }));

    expect(await screen.findByText('Server error')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /^retry$/i }));

    await waitFor(() => expect(screen.queryByText('Server error')).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('Retry me')).toBeInTheDocument());
  });

  it('uploads and sends an attached image', async () => {
    setStoredAuth({ token: 'tok', user: ME });
    const sent = tripMessage({ id: 'm-img', body: undefined, imageUrl: '/uploads/photo.jpg' });
    const calls: { method: string; url: string }[] = [];
    global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
      const method = (init?.method ?? 'GET').toUpperCase();
      calls.push({ method, url: String(url) });
      if (method === 'GET' && String(url).includes('/messages')) {
        return { ok: true, status: 200, json: () => Promise.resolve([]) };
      }
      if (method === 'POST' && (String(url).includes('/delivered') || String(url).includes('/read'))) {
        return { ok: true, status: 204, json: () => Promise.resolve(null) };
      }
      if (method === 'POST' && String(url).includes('/uploads/image')) {
        return { ok: true, status: 201, json: () => Promise.resolve({ url: '/uploads/photo.jpg' }) };
      }
      if (method === 'POST' && String(url).endsWith('/messages')) {
        return { ok: true, status: 201, json: () => Promise.resolve(sent) };
      }
      return { ok: true, status: 200, json: () => Promise.resolve(null) };
    }) as unknown as typeof fetch;

    render(<TripChatPanel itineraryId="trip-1" />);
    await screen.findByText(/say hello/i);

    const file = new File(['fake-bytes'], 'photo.jpg', { type: 'image/jpeg' });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await userEvent.upload(fileInput, file);
    await screen.findByText(/photo attached/i);

    await userEvent.click(screen.getByRole('button', { name: /send message/i }));

    await waitFor(() => expect(calls.some((c) => c.method === 'POST' && c.url.includes('/uploads/image'))).toBe(true));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST' && c.url.endsWith('/messages'))).toBe(true));
  });

  // Regression test for the reported bug: scrolling up to read earlier
  // messages used to get undone by the next poll (every 3s), which
  // force-scrolled back to the bottom regardless of where the reader was.
  it('does not yank the scroll position back to the bottom when a poll brings new messages while scrolled up', async () => {
    jest.useFakeTimers();
    try {
      setStoredAuth({ token: 'tok', user: ME });
      const firstBatch = [tripMessage({ id: 'm1', sender: OTHER, body: 'First message' })];
      const secondBatch = [...firstBatch, tripMessage({ id: 'm2', sender: OTHER, body: 'Second message' })];
      let getCount = 0;
      global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
        const method = (init?.method ?? 'GET').toUpperCase();
        if (method === 'GET' && String(url).includes('/messages')) {
          getCount += 1;
          return { ok: true, status: 200, json: () => Promise.resolve(getCount === 1 ? firstBatch : secondBatch) };
        }
        return { ok: true, status: 200, json: () => Promise.resolve(null) };
      }) as unknown as typeof fetch;

      render(<TripChatPanel itineraryId="trip-1" />);
      // Advance past the initial load's own scrollToBottom (queued via
      // requestAnimationFrame) so it can't fire later, mid-assertion, once
      // the "scrolled up" geometry below is in place.
      await act(async () => {
        await jest.advanceTimersByTimeAsync(50);
      });
      expect(screen.getByText('First message')).toBeInTheDocument();

      // Simulate having scrolled up to read history, well above the bottom.
      const scrollEl = document.querySelector('.overflow-y-auto') as HTMLElement;
      Object.defineProperty(scrollEl, 'scrollHeight', { value: 1000, configurable: true });
      Object.defineProperty(scrollEl, 'clientHeight', { value: 300, configurable: true });
      Object.defineProperty(scrollEl, 'scrollTop', { value: 0, writable: true, configurable: true });

      // Let the next poll (3s later) bring in the new message.
      await act(async () => {
        await jest.advanceTimersByTimeAsync(3000);
      });
      expect(screen.getByText('Second message')).toBeInTheDocument();

      // The reader's position must be untouched — no forced scroll-to-bottom.
      expect(scrollEl.scrollTop).toBe(0);
      // Instead, a "New messages" pill offers to jump down on request.
      const jumpButton = screen.getByRole('button', { name: /new messages/i });
      expect(jumpButton).toBeInTheDocument();

      await userEvent.setup({ advanceTimers: jest.advanceTimersByTime }).click(jumpButton);
      await act(async () => {
        await jest.advanceTimersByTimeAsync(50);
      });
      expect(scrollEl.scrollTop).toBe(1000);
      expect(screen.queryByRole('button', { name: /new messages/i })).not.toBeInTheDocument();
    } finally {
      jest.useRealTimers();
    }
  });
});
