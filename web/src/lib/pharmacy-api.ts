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
export async function uploadPrescription(
  pharmacyId: string,
  file: File,
): Promise<string> {
  if (!ALLOWED_PRESCRIPTION_MIME_TYPES.includes(file.type)) {
    throw new HttpError(400, "Only JPEG, PNG, WebP images or a PDF are allowed.");
  }
  if (file.size > MAX_PRESCRIPTION_FILE_SIZE_BYTES) {
    throw new HttpError(400, "Prescription file is larger than 10MB.");
  }
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
