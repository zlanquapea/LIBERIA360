import { apiRequest, HttpError } from "./http";
import { serverApiOrigin } from "./server-api-origin";

const MAX_PRESCRIPTION_FILE_SIZE_BYTES = 10 * 1024 * 1024; // matches api/src/pharmacies/pharmacies.service.ts
const ALLOWED_PRESCRIPTION_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
];

export type Pharmacy = {
  id: string;
  name: string;
  slug: string;
  address: string;
  location: string;
  telephone: string;
  logoUrl: string | null;
  coverUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  pickupEnabled: boolean;
  deliveryEnabled: boolean;
  deliveryFee: number;
  status: string;
  sponsored: boolean;
  // Only present on GET /admin/pharmacies/applications — every other read
  // omits both (Pharmacy.licenceNumber/licenceDocumentKey are `select:
  // false` columns; applications() is the one query that opts back in).
  licenceNumber?: string | null;
  licenceDocumentKey?: string | null;
  openingHours?: Array<{
    dayOfWeek: number;
    opensAt: string | null;
    closesAt: string | null;
    isClosed: boolean;
  }>;
};
export type PharmacyProduct = {
  id: string;
  pharmacyId: string;
  categoryId: string;
  name: string;
  imageUrl: string | null;
  price: number;
  prescriptionRequired: boolean;
  isVisible: boolean;
  inventory: { quantity: number } | null;
  category?: { id: string; name: string; slug: string };
};
export type PharmacyOrderItem = {
  id: string;
  orderId: string;
  productId: string | null;
  name: string;
  unitPrice: number;
  quantity: number;
  prescriptionRequired: boolean;
};
export type PharmacyOrder = {
  id: string;
  pharmacyId: string;
  status: string;
  fulfillmentMethod: string;
  productSubtotal: number;
  deliveryFee: number;
  platformFee: number;
  finalTotal: number;
  createdAt: string;
  pharmacy?: Pharmacy;
  // Present on GET /pharmacy-marketplace/orders/mine (customerOrders()) —
  // not on the createPharmacyOrder() response, which returns the bare
  // order row.
  items?: PharmacyOrderItem[];
  // Also customerOrders()-only — the linked prescription (if any) and the
  // latest review decision on it, so a "clarification_requested" review
  // is visible here rather than the order just sitting at "under_review"
  // with no explanation. See resubmitPrescription() below.
  prescriptionId?: string | null;
  latestReviewDecision?: string | null;
  latestReviewNotes?: string | null;
  // Staff-facing only (getPharmacyDashboardOrders()) — the version
  // ReviewForm must resubmit alongside its decision; see
  // PrescriptionReviewDto.prescriptionVersion.
  prescriptionVersion?: number | null;
};
const API = `${serverApiOrigin()}/api/v1`;
async function read<T>(path: string): Promise<T> {
  const r = await fetch(`${API}${path}`, { cache: "no-store" });
  if (!r.ok) throw new Error("Pharmacy service is unavailable");
  return r.json();
}
export const getPharmacies = (params: URLSearchParams) =>
  read<Pharmacy[]>(`/pharmacies?${params}`);
export const getPharmacy = (slug: string) =>
  read<Pharmacy>(`/pharmacies/${encodeURIComponent(slug)}`);
export const getPharmacyProducts = (id: string, params = "") =>
  read<PharmacyProduct[]>(
    `/pharmacies/${id}/products${params ? `?${params}` : ""}`,
  );
export const getPharmacyCategories = () =>
  read<Array<{ id: string; name: string; slug: string }>>(
    "/pharmacies/categories",
  );
export const createPharmacyOrder = (body: unknown) =>
  apiRequest<PharmacyOrder>("/pharmacy-marketplace/orders", {
    method: "POST",
    body: JSON.stringify(body),
  });
export const getMyPharmacyOrders = () =>
  apiRequest<PharmacyOrder[]>("/pharmacy-marketplace/orders/mine");
// POST /pharmacy-marketplace/prescriptions — multipart, so this bypasses
// http.ts's apiRequest (which always sets Content-Type: application/json);
// see lib/uploads-api.ts's uploadImage for the same pattern. Uploaded
// *before* checkout: the returned id is what the cart then submits as
// CreateOrderDto.prescriptionId.
function assertValidPrescriptionFile(file: File) {
  if (!ALLOWED_PRESCRIPTION_MIME_TYPES.includes(file.type)) {
    throw new HttpError(400, "Only JPEG, PNG, WebP images or a PDF are allowed.");
  }
  if (file.size > MAX_PRESCRIPTION_FILE_SIZE_BYTES) {
    throw new HttpError(400, "Prescription file is larger than 10MB.");
  }
}

export async function uploadPrescription(
  pharmacyId: string,
  file: File,
): Promise<string> {
  assertValidPrescriptionFile(file);
  const body = new FormData();
  body.append("pharmacyId", pharmacyId);
  body.append("file", file);
  // Relative, same-origin path — this runs client-side (called from
  // PharmacyShop, a "use client" component), unlike this file's read()
  // helper above which runs server-side and needs serverApiOrigin()'s
  // bare host. Same reasoning as lib/uploads-api.ts's uploadImage.
  const res = await fetch("/api/v1/pharmacy-marketplace/prescriptions", {
    method: "POST",
    credentials: "same-origin",
    body,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const message = (data as { message?: unknown } | null)?.message;
    throw new HttpError(
      res.status,
      typeof message === "string" ? message : `Upload failed with ${res.status}`,
    );
  }
  return (data as { id: string }).id;
}

// PATCH /pharmacy-marketplace/orders/:orderId/prescription — a customer's
// reply to a pharmacist's "clarification requested" review (surfaced on
// PharmacyOrder.latestReviewDecision/latestReviewNotes above), replacing
// the prescription file on the same still-under-review order.
export async function resubmitPrescription(
  orderId: string,
  file: File,
): Promise<void> {
  assertValidPrescriptionFile(file);
  const body = new FormData();
  body.append("file", file);
  const res = await fetch(
    `/api/v1/pharmacy-marketplace/orders/${encodeURIComponent(orderId)}/prescription`,
    { method: "PATCH", credentials: "same-origin", body },
  );
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    const message = (data as { message?: unknown } | null)?.message;
    throw new HttpError(
      res.status,
      typeof message === "string" ? message : `Upload failed with ${res.status}`,
    );
  }
}

// ---------------------------------------------------------------------
// Staff-facing (pharmacy-dashboard) — everything below is only reachable
// by staff assigned to the pharmacy in question (PharmaciesService's own
// assertStaff() enforces that server-side); the account/pharmacy-dashboard
// pages are the only callers.
// ---------------------------------------------------------------------

export type PharmacyProfileInput = {
  name: string;
  address: string;
  location: string;
  telephone: string;
  logoUrl?: string;
  coverUrl?: string;
  latitude?: number;
  longitude?: number;
  pickupEnabled: boolean;
  deliveryEnabled: boolean;
  deliveryFee: number;
  licenceNumber?: string;
};

export const getMyPharmacies = () => apiRequest<Pharmacy[]>("/pharmacy-dashboard");

export const createPharmacy = (body: PharmacyProfileInput) =>
  apiRequest<Pharmacy>("/pharmacy-dashboard", {
    method: "POST",
    body: JSON.stringify(body),
  });

export const savePharmacyProfile = (id: string, body: PharmacyProfileInput) =>
  apiRequest<Pharmacy>(`/pharmacy-dashboard/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });

export const assignPharmacyStaff = (
  pharmacyId: string,
  body: { email: string; role: "manager" | "pharmacist" | "employee" },
) =>
  apiRequest<unknown>(`/pharmacy-dashboard/${pharmacyId}/staff`, {
    method: "POST",
    body: JSON.stringify(body),
  });

export type PharmacyOpeningHoursEntry = {
  dayOfWeek: number;
  opensAt: string | null;
  closesAt: string | null;
  isClosed: boolean;
};

// Only reachable while staff — one() (the public storefront) requires an
// approved pharmacy, so a pending application has no other way to load
// its own hours for editing.
export const getMyPharmacyHours = (pharmacyId: string) =>
  apiRequest<PharmacyOpeningHoursEntry[]>(
    `/pharmacy-dashboard/${pharmacyId}/hours`,
  );

// The only path that can ever populate pharmacy_opening_hours — without
// setting these, a pharmacy can never match the public directory's "Open
// now" filter, which inner-joins this table server-side.
export const savePharmacyHours = (
  pharmacyId: string,
  hours: PharmacyOpeningHoursEntry[],
) =>
  apiRequest<PharmacyOpeningHoursEntry[]>(
    `/pharmacy-dashboard/${pharmacyId}/hours`,
    { method: "PATCH", body: JSON.stringify({ hours }) },
  );

// Includes hidden (isVisible: false) products — the public catalog()
// endpoint (getPharmacyProducts above) never returns those, which would
// otherwise leave staff unable to find and re-enable one they'd hidden.
export const getMyPharmacyProducts = (pharmacyId: string) =>
  apiRequest<PharmacyProduct[]>(`/pharmacy-dashboard/${pharmacyId}/products`);

export type PharmacyProductInput = {
  name: string;
  categoryId: string;
  imageUrl?: string;
  price: number;
  stockQuantity: number;
  // The stock level this form loaded before editing began — lets the API
  // apply the change as a delta instead of an absolute overwrite, so a
  // concurrent checkout decrement isn't silently undone by this save. See
  // ProductDto.previousStockQuantity on the API side.
  previousStockQuantity?: number;
  prescriptionRequired: boolean;
  isVisible?: boolean;
};

export const savePharmacyProduct = (
  pharmacyId: string,
  productId: string | undefined,
  body: PharmacyProductInput,
) =>
  apiRequest<PharmacyProduct>(
    `/pharmacy-dashboard/${pharmacyId}/products${productId ? `/${productId}` : ""}`,
    { method: productId ? "PATCH" : "POST", body: JSON.stringify(body) },
  );

export const deletePharmacyProduct = (pharmacyId: string, productId: string) =>
  apiRequest<unknown>(`/pharmacy-dashboard/${pharmacyId}/products/${productId}`, {
    method: "DELETE",
  });

export const getPharmacyDashboardOrders = (pharmacyId: string) =>
  apiRequest<PharmacyOrder[]>(`/pharmacy-dashboard/${pharmacyId}/orders`);

export const transitionPharmacyOrder = (
  pharmacyId: string,
  orderId: string,
  status: string,
) =>
  apiRequest<PharmacyOrder>(
    `/pharmacy-dashboard/${pharmacyId}/orders/${orderId}/status`,
    { method: "PATCH", body: JSON.stringify({ status }) },
  );

export const reviewPharmacyPrescription = (
  pharmacyId: string,
  prescriptionId: string,
  body: {
    decision: "accepted" | "rejected" | "clarification_requested";
    notes?: string;
    // The Prescription.version this decision was made against (from the
    // order's own prescriptionVersion, set by getPharmacyDashboardOrders())
    // — the API rejects a stale one with a 409 if it's changed since.
    prescriptionVersion: number;
  },
) =>
  apiRequest<unknown>(
    `/pharmacy-dashboard/${pharmacyId}/prescriptions/${prescriptionId}/reviews`,
    { method: "POST", body: JSON.stringify(body) },
  );

export type PharmacyStats = {
  totalOrders: number;
  completedOrders: number;
  pendingOrders: number;
  revenue: number;
  // The caller's own staff role at this pharmacy — used to hide the
  // clinical Accept/Reject/clarification controls (ReviewForm) from
  // anyone but a pharmacist, since review() rejects those from a manager
  // or employee just the same.
  role: "manager" | "pharmacist" | "employee";
};

export const getPharmacyStats = (pharmacyId: string) =>
  apiRequest<PharmacyStats>(`/pharmacy-dashboard/${pharmacyId}/statistics`);
