import { apiRequest } from "./http";
import { serverApiOrigin } from "./server-api-origin";

export type ClinicStatus = "pending" | "approved" | "rejected" | "suspended";
export type ClinicStaffRole = "admin" | "doctor" | "front_desk";
export type DoctorVerificationStatus = "pending" | "verified" | "rejected";
export type EPrescriptionStatus =
  | "issued"
  | "sent"
  | "preparing"
  | "ready"
  | "ordered"
  | "dispensed"
  | "cancelled";

export type PublicDoctor = {
  id: string;
  fullName: string;
  specialty: string;
  licenceNumber: string;
  photoUrl: string | null;
  bio: string | null;
  verified: boolean;
};
export type PharmacySummary = {
  id: string;
  name: string;
  slug: string;
  address: string;
  location: string;
  telephone: string;
  approved: boolean;
};
export type PublicClinic = {
  id: string;
  name: string;
  slug: string;
  address: string;
  location: string;
  telephone: string;
  about: string | null;
  logoUrl: string | null;
  coverUrl: string | null;
  pharmacy: PharmacySummary | null;
  doctors: PublicDoctor[];
};
export type MyClinic = {
  id: string;
  name: string;
  slug: string;
  address: string;
  location: string;
  telephone: string;
  about: string | null;
  logoUrl: string | null;
  coverUrl: string | null;
  licenceNumber: string | null;
  status: ClinicStatus;
  statusNotes: string | null;
  pharmacyId: string | null;
  pharmacy: PharmacySummary | null;
  myRole: ClinicStaffRole;
  canPrescribe: boolean;
  mtnMomoNumber: string | null;
  orangeMoneyNumber: string | null;
};
export type ClinicProfileInput = {
  name: string;
  address: string;
  location: string;
  telephone: string;
  about?: string | null;
  logoUrl?: string | null;
  coverUrl?: string | null;
  licenceNumber?: string;
  pharmacyId?: string | null;
  mtnMomoNumber?: string | null;
  orangeMoneyNumber?: string | null;
};
export type DoctorProfile = {
  id: string;
  fullName: string;
  specialty: string;
  licenceNumber: string;
  bio: string | null;
  photoUrl: string | null;
  verificationStatus: DoctorVerificationStatus;
  verificationNotes: string | null;
  verifiedAt: string | null;
  consultFee: number | null;
  consultClinicId: string | null;
  availableNow: boolean;
};
export type ClinicStaffMember = {
  userId: string;
  name: string;
  email: string;
  role: ClinicStaffRole;
  active: boolean;
  doctor: {
    fullName: string;
    specialty: string;
    verificationStatus: DoctorVerificationStatus;
  } | null;
};
export type CatalogHit = {
  id: string;
  name: string;
  price: number;
  prescriptionRequired: boolean;
  stock: number;
};
export type PrescriptionItem = {
  id: string;
  medicine: string;
  strength: string | null;
  dosage: string;
  durationDays: number | null;
  quantity: number;
  instructions: string | null;
  productId: string | null;
};
export type EPrescription = {
  id: string;
  code: string;
  status: EPrescriptionStatus;
  expired: boolean;
  issuedAt: string;
  expiresAt: string;
  dispensedAt: string | null;
  clinic: { id: string; name: string; slug: string; address: string; telephone: string } | null;
  doctor: PublicDoctor | null;
  pharmacy: PharmacySummary | null;
  pharmacyOrderId: string | null;
  patientName: string;
  patientAge: number | null;
  patientPhone: string | null;
  hasPatientAccount: boolean;
  notesForPharmacist: string | null;
  cancelledReason: string | null;
  itemCount: number;
  items: PrescriptionItem[];
  full: boolean;
  qrDataUrl?: string | null;
  // Counter views: why it can't be filled here, if so.
  problem?: string | null;
  // Verify page: pharmacies the signed-in viewer works at.
  myPharmacies?: Array<{ id: string; name: string }>;
};
export type PrescriptionItemInput = {
  medicine: string;
  strength?: string;
  dosage: string;
  durationDays?: number;
  quantity: number;
  instructions?: string;
  productId?: string;
};
export type IssuePrescriptionInput = {
  consultationId?: string;
  patientUserId?: string;
  patientName: string;
  patientPhone?: string;
  patientAge?: number;
  items: PrescriptionItemInput[];
  notesForPharmacist?: string;
  sendToPharmacy?: boolean;
};
export type OrderDraft = {
  prescriptionId: string;
  code: string;
  doctorName: string | null;
  clinicName: string | null;
  pharmacyId: string;
  pharmacySlug: string;
  lines: Array<{
    medicine: string;
    dosage: string;
    quantity: number;
    product: CatalogHit | null;
  }>;
};

// ── Public (server components) ────────────────────────────────────────
const API = `${serverApiOrigin()}/api/v1`;
async function read<T>(path: string): Promise<T> {
  const r = await fetch(`${API}${path}`, { cache: "no-store" });
  if (r.status === 404) throw new Error("not_found");
  if (!r.ok) throw new Error("Clinic service is unavailable");
  return (await r.json()) as T;
}
export const getClinics = () => read<PublicClinic[]>("/clinics");
export const getClinic = (slug: string) =>
  read<PublicClinic>(`/clinics/${encodeURIComponent(slug)}`);

// ── Clinic dashboard ──────────────────────────────────────────────────
const json = (method: string, body?: unknown): RequestInit => ({
  method,
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});
export const getMyClinics = () => apiRequest<MyClinic[]>("/clinic-dashboard");
export const getMyClinic = (id: string) =>
  apiRequest<MyClinic>(`/clinic-dashboard/${id}`);
export const createClinic = (body: ClinicProfileInput) =>
  apiRequest<MyClinic>("/clinic-dashboard", json("POST", body));
export const updateClinic = (id: string, body: ClinicProfileInput) =>
  apiRequest<MyClinic>(`/clinic-dashboard/${id}`, json("PATCH", body));
export const getAttachablePharmacies = () =>
  apiRequest<PharmacySummary[]>("/clinic-dashboard/attachable-pharmacies");
export const getDoctorProfile = () =>
  apiRequest<DoctorProfile | null>("/clinic-dashboard/doctor-profile");
export const saveDoctorProfile = (body: {
  fullName: string;
  specialty: string;
  licenceNumber: string;
  bio?: string | null;
  photoUrl?: string | null;
}) => apiRequest<DoctorProfile>("/clinic-dashboard/doctor-profile", json("PUT", body));
export const getClinicStaff = (id: string) =>
  apiRequest<ClinicStaffMember[]>(`/clinic-dashboard/${id}/staff`);
export const assignClinicStaff = (id: string, email: string, role: ClinicStaffRole) =>
  apiRequest<ClinicStaffMember[]>(`/clinic-dashboard/${id}/staff`, json("POST", { email, role }));
export const removeClinicStaff = (id: string, userId: string) =>
  apiRequest<ClinicStaffMember[]>(`/clinic-dashboard/${id}/staff/${userId}`, json("DELETE"));
export const lookupPatient = (id: string, contact: string) =>
  apiRequest<{ id: string; name: string } | null>(
    `/clinic-dashboard/${id}/patients/lookup`,
    json("POST", { contact }),
  );
export const searchClinicCatalog = (id: string, q: string) =>
  apiRequest<CatalogHit[]>(`/clinic-dashboard/${id}/catalog?q=${encodeURIComponent(q)}`);
export const getClinicPrescriptions = (id: string) =>
  apiRequest<EPrescription[]>(`/clinic-dashboard/${id}/prescriptions`);
export const getClinicPrescription = (id: string, rxId: string) =>
  apiRequest<EPrescription>(`/clinic-dashboard/${id}/prescriptions/${rxId}`);
export const issuePrescription = (id: string, body: IssuePrescriptionInput) =>
  apiRequest<EPrescription>(`/clinic-dashboard/${id}/prescriptions`, json("POST", body));
export const cancelPrescription = (id: string, rxId: string, reason: string) =>
  apiRequest<EPrescription>(
    `/clinic-dashboard/${id}/prescriptions/${rxId}/cancel`,
    json("POST", { reason }),
  );

// ── Patient & QR ──────────────────────────────────────────────────────
export const verifyPrescription = (code: string, token: string | null) =>
  apiRequest<EPrescription>(
    `/e-prescriptions/verify/${encodeURIComponent(code)}${token ? `?t=${encodeURIComponent(token)}` : ""}`,
  );
export const getMyPrescriptions = () => apiRequest<EPrescription[]>("/e-prescriptions/mine");
export const sendPrescription = (rxId: string, pharmacyId: string) =>
  apiRequest<EPrescription>(`/e-prescriptions/${rxId}/send`, json("POST", { pharmacyId }));
export const getOrderDraft = (rxId: string, pharmacyId: string) =>
  apiRequest<OrderDraft>(
    `/e-prescriptions/${rxId}/order-draft?pharmacyId=${encodeURIComponent(pharmacyId)}`,
  );
export const getPharmacyOptions = () =>
  apiRequest<Array<{ id: string; name: string; slug: string; location: string }>>(
    "/pharmacies",
  );

// ── Pharmacy counter ─────────────────────────────────────────────────
const counter = (pharmacyId: string) => `/pharmacy-dashboard/${pharmacyId}/e-prescriptions`;
export const getPrescriptionQueue = (pharmacyId: string) =>
  apiRequest<EPrescription[]>(counter(pharmacyId));
export const lookupCounterPrescription = (pharmacyId: string, code: string) =>
  apiRequest<EPrescription>(`${counter(pharmacyId)}/lookup`, json("POST", { code }));
export const setCounterStatus = (
  pharmacyId: string,
  rxId: string,
  status: "preparing" | "ready",
) => apiRequest<EPrescription>(`${counter(pharmacyId)}/${rxId}/status`, json("PATCH", { status }));
export const returnPrescription = (pharmacyId: string, rxId: string, reason?: string) =>
  apiRequest<EPrescription>(`${counter(pharmacyId)}/${rxId}/return`, json("POST", { reason }));
export const dispensePrescription = (pharmacyId: string, rxId: string) =>
  apiRequest<EPrescription>(`${counter(pharmacyId)}/${rxId}/dispense`, json("POST"));

// ── Admin ────────────────────────────────────────────────────────────
export type ClinicApplication = MyClinic & { createdAt: string };
export type DoctorApplication = DoctorProfile & {
  createdAt: string;
  user: { name: string; email: string } | null;
  clinics: Array<{ name: string; role: ClinicStaffRole }>;
};
export const getClinicApplications = () => apiRequest<ClinicApplication[]>("/admin/clinics");
export const verifyClinic = (id: string, decision: ClinicStatus, notes?: string) =>
  apiRequest(`/admin/clinics/${id}/verification`, json("PATCH", { decision, notes }));
export const getDoctorApplications = () =>
  apiRequest<DoctorApplication[]>("/admin/clinics/doctors");
export const verifyDoctor = (id: string, decision: DoctorVerificationStatus, notes?: string) =>
  apiRequest(`/admin/clinics/doctors/${id}/verification`, json("PATCH", { decision, notes }));
