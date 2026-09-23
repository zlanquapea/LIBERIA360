import { apiRequest, authHeader } from "./http";
export interface ConversationParticipant {
  id: string;
  name: string;
  profileImage: string | null;
  role: string;
}
export interface ConversationMessage {
  id: string;
  conversationId: string;
  senderId: string;
  sender: { id: string; name: string; profileImage: string | null } | null;
  body: string;
  messageType: string;
  attachments: Array<Record<string, unknown>>;
  reactions: Record<string, string[]>;
  deliveredAt: string | null;
  readAt: string | null;
  editedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
}
export interface Conversation {
  id: string;
  contextType: string;
  contextId: string | null;
  title: string | null;
  avatarUrl: string | null;
  createdAt: string;
  lastMessage: ConversationMessage | null;
  unreadCount: number;
  participants: ConversationParticipant[];
}
export function listConversations(token: string) {
  return apiRequest<Conversation[]>("/conversations", {
    headers: authHeader(token),
  });
}
export function getConversation(token: string, id: string) {
  return apiRequest<Conversation>(`/conversations/${id}`, {
    headers: authHeader(token),
  });
}
export function getConversationMessages(token: string, id: string) {
  return apiRequest<ConversationMessage[]>(`/conversations/${id}/messages`, {
    headers: authHeader(token),
  });
}
export function sendConversationMessage(
  token: string,
  id: string,
  body: string,
) {
  return apiRequest<ConversationMessage>(`/conversations/${id}/messages`, {
    method: "POST",
    headers: authHeader(token),
    body: JSON.stringify({ body }),
  });
}
export function markConversationRead(token: string, id: string) {
  return apiRequest<void>(`/conversations/${id}/read`, {
    method: "POST",
    headers: authHeader(token),
  });
}
export function createGuideConversation(token: string, guideId: string) {
  return apiRequest<Conversation>(`/conversations/guide/${guideId}`, {
    method: "POST",
    headers: authHeader(token),
  });
}
export function createCreatorConversation(token: string, creatorId: string) {
  return apiRequest<Conversation>(`/conversations/creator/${creatorId}`, {
    method: "POST",
    headers: authHeader(token),
  });
}
export function toggleConversationReaction(
  token: string,
  messageId: string,
  emoji: string,
) {
  return apiRequest<ConversationMessage>(
    `/conversations/messages/${messageId}/reactions`,
    {
      method: "POST",
      headers: authHeader(token),
      body: JSON.stringify({ emoji }),
    },
  );
}
