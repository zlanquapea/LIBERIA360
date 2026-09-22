import { apiRequest, authHeader } from "./http";

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
