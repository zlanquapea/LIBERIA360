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
