import { apiRequest } from "./http";
import { serverApiOrigin } from "./server-api-origin";

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
