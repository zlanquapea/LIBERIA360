import { fireEvent, render, screen } from '@testing-library/react';
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
