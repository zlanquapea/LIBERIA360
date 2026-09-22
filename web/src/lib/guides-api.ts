import { apiRequest, authHeader } from "./http";

import type { GuideSummary } from "./api";

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
