import { act, fireEvent, render, screen } from '@testing-library/react';
import { ConversationScreen } from './ConversationScreen';
import { sendConversationMessage } from '../lib/conversations-api';
jest.mock('../hooks/useAuth', () => ({ useAuth: () => ({ token: 'token', ready: true, user: { id: 'me' } }) }));
jest.mock('../lib/conversations-api', () => ({
  getConversation: jest.fn().mockResolvedValue({ id: 'chat', contextType: 'booking', contextId: 'booking1', title: 'Booking conversation', otherParticipant: { name: 'Emmanuel' } }),
  getConversationMessages: jest.fn().mockResolvedValue([{ id: '1', senderId: 'other', body: 'Hello', createdAt: '2026-09-26T12:00:00Z', attachments: [], reactions: {} }]),
  openConversationSocket: jest.fn(() => ({ readyState: 3, close: jest.fn() })),
  sendConversationMessage: jest.fn().mockResolvedValue({ id: '2', senderId: 'me', body: 'Thanks', createdAt: '2026-09-26T12:01:00Z', attachments: [], reactions: {} }),
}));
beforeAll(() => { Element.prototype.scrollIntoView = jest.fn(); });
it('keeps the chat within the visible viewport when the keyboard opens and closes', async () => {
  const original = Object.getOwnPropertyDescriptor(window, 'visualViewport');
  const viewport = Object.assign(new EventTarget(), { height: 800, offsetTop: 0, scale: 1 });
  Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport });
  const removeListener = jest.spyOn(viewport, 'removeEventListener');
  const { unmount } = render(<ConversationScreen conversationId="chat" />);
  try {
    await screen.findByText('Hello');
    const chat = screen.getByRole('main');
    expect(chat).toHaveStyle({ height: '800px', top: '0px' });
    act(() => {
      viewport.height = 360;
      viewport.offsetTop = 180;
      viewport.dispatchEvent(new Event('resize'));
    });
    expect(chat).toHaveStyle({ height: '360px', top: '180px' });
    expect(screen.getByText('Emmanuel')).toBeInTheDocument();
    act(() => {
      viewport.offsetTop = 220;
      viewport.dispatchEvent(new Event('scroll'));
    });
    expect(chat).toHaveStyle({ top: '220px' });
    act(() => {
      viewport.height = 800;
      viewport.offsetTop = 0;
      viewport.dispatchEvent(new Event('resize'));
    });
    expect(chat).toHaveStyle({ height: '800px', top: '0px' });
    act(() => {
      viewport.scale = 2;
      viewport.dispatchEvent(new Event('resize'));
    });
    expect(chat.style.height).toBe('');
    expect(chat.style.top).toBe('');
  } finally {
    unmount();
    expect(removeListener).toHaveBeenCalledWith('resize', expect.any(Function));
    expect(removeListener).toHaveBeenCalledWith('scroll', expect.any(Function));
    if (original) Object.defineProperty(window, 'visualViewport', original);
    else Reflect.deleteProperty(window, 'visualViewport');
  }
});
it('keeps booking context, media tools, and text sending usable', async () => {
  render(<ConversationScreen conversationId="chat" />);
  await screen.findByText('Hello');
  expect(screen.getByRole('link', { name: /My bookings/ })).toHaveAttribute('href', '/account/bookings');
  fireEvent.click(screen.getByRole('button', { name: 'Message tools' }));
  expect(screen.getByRole('button', { name: 'Add attachment' })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Record voice note' })).toBeVisible();
  fireEvent.change(screen.getByRole('textbox', { name: 'Message' }), { target: { value: 'Thanks' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
  expect(await screen.findByText('Thanks')).toBeInTheDocument();
  expect(sendConversationMessage).toHaveBeenCalledWith('token', 'chat', 'Thanks', 'file', []);
});

it('grows wrapped drafts, scrolls at the limit, and shrinks when cleared', async () => {
  render(<ConversationScreen conversationId="chat" />);
  await screen.findByText('Hello');
  const input = screen.getByRole('textbox', { name: 'Message' });
  let measuredHeight = 96;
  Object.defineProperty(input, 'scrollHeight', { configurable: true, get: () => measuredHeight });
  fireEvent.change(input, { target: { value: 'A draft wrapping across several lines' } });
  expect(input).toHaveStyle({ height: '96px', overflowY: 'hidden' });
  measuredHeight = 240;
  fireEvent.change(input, { target: { value: 'A much longer draft' } });
  expect(input).toHaveStyle({ height: '144px', overflowY: 'auto' });
  measuredHeight = 48;
  fireEvent.change(input, { target: { value: '' } });
  expect(input).toHaveStyle({ height: '48px', overflowY: 'hidden' });
});
