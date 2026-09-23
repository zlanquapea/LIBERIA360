import { apiRequest, authHeader, HttpError } from "./http";
export interface ConversationAttachment {
  url: string;
  thumbnailUrl?: string | null;
  contentType: string;
  kind: "image" | "video" | "audio" | "file";
  name?: string;
  size?: number;
}
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
  attachments: ConversationAttachment[];
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
  otherParticipant: ConversationParticipant | null;
}
export type ConversationRealtimeEvent =
  | { type: "conversation.ready"; conversationId: string; userId: string }
  | { type: "conversation.message.created"; message: ConversationMessage }
  | {
      type: "conversation.receipt";
      status: "delivered" | "read";
      messageId: string;
      conversationId: string;
      deliveredAt: string | null;
      readAt: string | null;
    }
  | {
      type: "conversation.typing.start" | "conversation.typing.stop";
      conversationId: string;
      userId: string;
    }
  | { type: "conversation.error"; message: string };
export type ConversationRealtimeClientEvent =
  | {
      type: "conversation.message.send";
      body?: string;
      messageType?: string;
      attachments?: ConversationAttachment[];
    }
  | { type: "conversation.typing.start" }
  | { type: "conversation.typing.stop" }
  | { type: "conversation.read" };
export function openConversationSocket(token: string, conversationId: string) {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const url = `${protocol}//${window.location.host}/api/v1/conversations/realtime?conversationId=${encodeURIComponent(conversationId)}`;
  return new WebSocket(url, token ? [`bearer.${token}`] : undefined);
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
  messageType = "text",
  attachments: ConversationAttachment[] = [],
) {
  return apiRequest<ConversationMessage>(`/conversations/${id}/messages`, {
    method: "POST",
    headers: authHeader(token),
    body: JSON.stringify({ body, messageType, attachments }),
  });
}
const MAX_MESSAGE_MEDIA_BYTES = 50 * 1024 * 1024;
const MESSAGE_MEDIA_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/ogg",
  "audio/webm",
  "audio/ogg",
  "audio/mpeg",
  "audio/mp4",
  "audio/wav",
  "audio/x-m4a",
];
export async function uploadMessageMedia(
  token: string,
  file: File,
): Promise<ConversationAttachment> {
  void token;
  if (!MESSAGE_MEDIA_TYPES.includes(file.type))
    throw new HttpError(
      400,
      "This image, video, or audio format is not supported.",
    );
  if (file.size > MAX_MESSAGE_MEDIA_BYTES)
    throw new HttpError(400, "Message media must be smaller than 50MB.");
  const form = new FormData();
  form.append("file", file);
  const response = await fetch("/api/v1/uploads/message-media", {
    method: "POST",
    credentials: "same-origin",
    body: form,
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = (data as { message?: unknown } | null)?.message;
    throw new HttpError(
      response.status,
      typeof message === "string" ? message : "Media upload failed.",
    );
  }
  const result = data as {
    url: string;
    thumbnailUrl: string | null;
    contentType: string;
    kind: ConversationAttachment["kind"];
    size: number;
  };
  return { ...result, name: file.name, size: file.size };
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
export function createContextConversation(
  token: string,
  contextType: string,
  contextId: string,
) {
  return apiRequest<Conversation>(
    `/conversations/context/${encodeURIComponent(contextType)}/${encodeURIComponent(contextId)}`,
    {
      method: "POST",
      headers: authHeader(token),
    },
  );
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
