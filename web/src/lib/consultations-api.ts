import { apiRequest } from "./http";
import type { PublicDoctor } from "./clinic-api";

export type ConsultationStatus = "requested" | "active" | "completed" | "declined" | "cancelled";
export type ConsultPaymentMethod = "mtn_momo" | "orange_money";
export type ConsultPaymentStatus =
  | "awaiting_verification"
  | "paid"
  | "failed"
  | "refund_due"
  | "refunded";
export type ConsultationOutcome = "advice" | "prescription" | "visit_clinic" | "emergency";

export type ConsultDoctor = PublicDoctor & {
  fee: number;
  availableNow: boolean;
  clinic: { id: string; name: string; slug: string; location: string };
  paymentMethods: Array<{ method: ConsultPaymentMethod; label: string; account: string | null }>;
};

export type Consultation = {
  id: string;
  status: ConsultationStatus;
  createdAt: string;
  acceptedAt: string | null;
  completedAt: string | null;
  patientName: string;
  patientAge: number | null;
  reason: string;
  symptomsSince: string | null;
  fee: number;
  paymentMethod: ConsultPaymentMethod;
  paymentReference: string;
  paymentAccount: string | null;
  paymentStatus: ConsultPaymentStatus;
  outcome: ConsultationOutcome | null;
  summary: string | null;
  declineReason: string | null;
  ePrescriptionId: string | null;
  ePrescriptionCode: string | null;
  doctor: PublicDoctor | null;
  clinic: { id: string; name: string; slug: string; telephone: string; address: string } | null;
  viewerRole: "patient" | "doctor";
  unreadMessages: number;
};

export type ConsultationMessage = {
  id: string;
  body: string | null;
  fromDoctor: boolean;
  mine: boolean;
  voice: { seconds: number | null; mimeType: string } | null;
  createdAt: string;
  readAt: string | null;
};

export type RequestConsultationInput = {
  doctorId: string;
  patientName?: string;
  patientAge?: number;
  reason: string;
  symptomsSince?: string;
  redFlags: string[];
  noRedFlagsConfirmed: boolean;
  paymentMethod: ConsultPaymentMethod;
  paymentReference: string;
};

const json = (method: string, body?: unknown): RequestInit => ({
  method,
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

export const getConsultDoctors = () => apiRequest<ConsultDoctor[]>("/consultations/doctors");
export const getConsultDoctor = (id: string) =>
  apiRequest<ConsultDoctor>(`/consultations/doctors/${id}`);
export const requestConsultation = (body: RequestConsultationInput) =>
  apiRequest<Consultation>("/consultations", json("POST", body));
export const getMyConsultations = () => apiRequest<Consultation[]>("/consultations/mine");
export const getConsultationInbox = () => apiRequest<Consultation[]>("/consultations/inbox");
export const getConsultation = (id: string) => apiRequest<Consultation>(`/consultations/${id}`);
export const cancelConsultation = (id: string) =>
  apiRequest<Consultation>(`/consultations/${id}/cancel`, json("POST"));
export const resendConsultationPayment = (id: string, paymentReference: string) =>
  apiRequest<Consultation>(`/consultations/${id}/payment`, json("POST", { paymentReference }));
export const verifyConsultationPayment = (id: string, received: boolean) =>
  apiRequest<Consultation>(`/consultations/${id}/payment`, json("PATCH", { received }));
export const declineConsultation = (id: string, reason: string) =>
  apiRequest<Consultation>(`/consultations/${id}/decline`, json("POST", { reason }));
export const completeConsultation = (id: string, outcome: ConsultationOutcome, summary: string) =>
  apiRequest<Consultation>(`/consultations/${id}/complete`, json("POST", { outcome, summary }));
export const markConsultationRefunded = (id: string) =>
  apiRequest<Consultation>(`/consultations/${id}/refunded`, json("PATCH"));
export const getConsultationMessages = (id: string) =>
  apiRequest<ConsultationMessage[]>(`/consultations/${id}/messages`);
export const sendConsultationMessage = (id: string, body: string) =>
  apiRequest<ConsultationMessage>(`/consultations/${id}/messages`, json("POST", { body }));
export async function sendVoiceNote(id: string, blob: Blob, seconds: number) {
  const form = new FormData();
  const ext = blob.type.includes("ogg") ? "ogg" : blob.type.includes("mp4") ? "m4a" : "webm";
  form.append("file", blob, `voice.${ext}`);
  form.append("seconds", String(Math.max(1, Math.min(180, Math.round(seconds)))));
  return apiRequest<ConsultationMessage>(`/consultations/${id}/voice`, { method: "POST", body: form });
}
export const voiceNoteUrl = (messageId: string) =>
  `/api/v1/consultations/messages/${messageId}/voice`;
export const saveConsultSettings = (body: {
  consultFee: number | null;
  consultClinicId: string | null;
  availableNow: boolean;
}) => apiRequest(`/clinic-dashboard/doctor-profile/consults`, json("PUT", body));
