import { apiRequest, authHeader } from "./http";
import type { ExperienceSummary, GuideSummary } from "./api";

export function getMyGuideProfile(token: string) {
  return apiRequest<GuideSummary>("/guides/me", { headers: authHeader(token) });
}

export function updateMyGuideProfileImage(
  token: string,
  profileImageUrl: string | null,
) {
  return apiRequest<GuideSummary>("/guides/me", {
    method: "PATCH",
    headers: authHeader(token),
    body: JSON.stringify({ profileImageUrl }),
  });
}

export interface UpdateGuideProfileInput {
  guideType: string;
  bio: string;
  city: string;
  countyId?: string | null;
  languages: string[];
  ltaLicenseNumber?: string | null;
  whatsappNumber?: string | null;
  slug: string;
}

export function updateMyGuideProfile(
  token: string,
  input: UpdateGuideProfileInput,
) {
  return apiRequest<GuideSummary>("/guides/me/details", {
    method: "PATCH",
    headers: authHeader(token),
    body: JSON.stringify(input),
  });
}

export interface PendingGuideApplication {
  id: string;
  userId: string;
  guideType: string;
  bio: string;
  city: string;
  county: { name?: string } | null;
  languages: string[];
  ltaLicenseNumber: string | null;
  whatsappNumber: string | null;
  slug: string;
  profileImageUrl: string | null;
  verificationDocumentKey: string | null;
  verificationStatus: string;
  createdAt: string;
}

export function getPendingGuideApplications(token: string) {
  return apiRequest<PendingGuideApplication[]>("/admin/guides/pending", {
    headers: authHeader(token),
  });
}

export function setGuideVerification(
  token: string,
  guideId: string,
  status: "verified" | "rejected",
  reason?: string,
) {
  return apiRequest<PendingGuideApplication>(
    `/admin/guides/${guideId}/verification`,
    {
      method: "PATCH",
      headers: authHeader(token),
      body: JSON.stringify({ status, reason }),
    },
  );
}

export interface GuideBookingInput {
  requestedDate: string;
  groupSize: number;
  note?: string;
}

export function requestGuideBooking(
  token: string,
  experienceId: string,
  input: GuideBookingInput,
) {
  return apiRequest(`/experiences/${experienceId}/book`, {
    method: "POST",
    headers: authHeader(token),
    body: JSON.stringify(input),
  });
}

export interface GuideApplicationInput {
  guideType: string;
  bio: string;
  city: string;
  countyId?: string;
  languages: string[];
  ltaLicenseNumber?: string;
  whatsappNumber?: string;
  slug: string;
}

export function applyAsGuide(token: string, input: GuideApplicationInput) {
  return apiRequest("/guides/apply", {
    method: "POST",
    headers: authHeader(token),
    body: JSON.stringify(input),
  });
}

export interface GuideBookingSummary {
  id: string;
  requestedDate: string;
  groupSize: number;
  status: string;
  paymentStatus: string;
  priceUsdSnapshot: number;
  experience: { id: string; title: string; guide: { slug: string } };
}

export function getMyGuideBookings(token: string) {
  return apiRequest<GuideBookingSummary[]>("/guide-bookings/mine", {
    headers: authHeader(token),
  });
}

export function uploadGuideVerificationDocument(token: string, file: File) {
  const body = new FormData();
  body.append("document", file);
  return apiRequest("/guides/me/verification-document", {
    method: "POST",
    headers: authHeader(token),
    body,
  });
}

export interface GuideReviewSummary {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  reviewer: { id: string; name: string } | null;
}

export function getGuideReviews(guideId: string) {
  return apiRequest<GuideReviewSummary[]>(`/guides/${guideId}/reviews`);
}

export function createGuideReview(
  token: string,
  guideId: string,
  input: { rating: number; comment?: string },
) {
  return apiRequest<GuideReviewSummary>(`/guides/${guideId}/reviews`, {
    method: "POST",
    headers: authHeader(token),
    body: JSON.stringify(input),
  });
}

export interface GuideMessage {
  id: string;
  guideId: string;
  visitorId: string;
  senderId: string;
  body: string;
  readAt: string | null;
  createdAt: string;
  sender: { id: string; name: string } | null;
}

export type GuideChatEvent =
  | { type: "guide.chat.ready"; guideId: string; userId: string }
  | { type: "guide.message.created"; message: GuideMessage }
  | { type: "guide.chat.error"; message: string };

export function openGuideChat(
  token: string,
  guideId: string,
  onEvent: (event: GuideChatEvent) => void,
) {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const url = `${protocol}//${window.location.host}/api/v1/guides/chat?guideId=${encodeURIComponent(guideId)}`;
  const socket =
    token === "cookie-session"
      ? new WebSocket(url)
      : new WebSocket(url, [`bearer.${token}`]);
  socket.addEventListener("message", (event) => {
    try {
      onEvent(JSON.parse(event.data as string) as GuideChatEvent);
    } catch {
      // Ignore malformed server frames; the REST fallback remains available.
    }
  });
  return socket;
}

export function getGuideMessages(token: string, guideId: string) {
  return apiRequest<GuideMessage[]>(`/guides/${guideId}/messages`, {
    headers: authHeader(token),
  });
}

export function sendGuideMessage(
  token: string,
  guideId: string,
  body: string,
  visitorId?: string,
) {
  return apiRequest<GuideMessage>(`/guides/${guideId}/messages`, {
    method: "POST",
    headers: authHeader(token),
    body: JSON.stringify({ body, visitorId }),
  });
}

export function getMyGuideExperiences(token: string) {
  return apiRequest<ExperienceSummary[]>("/guides/me/experiences", {
    headers: authHeader(token),
  });
}

export function createGuideExperience(
  token: string,
  input: Record<string, unknown>,
) {
  return apiRequest<ExperienceSummary>("/experiences", {
    method: "POST",
    headers: authHeader(token),
    body: JSON.stringify(input),
  });
}

export function updateGuideExperience(
  token: string,
  experienceId: string,
  input: Record<string, unknown>,
) {
  return apiRequest<ExperienceSummary>(`/experiences/${experienceId}`, {
    method: "PATCH",
    headers: authHeader(token),
    body: JSON.stringify(input),
  });
}
