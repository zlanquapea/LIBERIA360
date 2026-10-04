import { apiRequest } from "./http";
export type PackingItem = {
  id: string;
  name: string;
  category: string;
  quantity: number;
  packed: boolean;
};
export type TripPackingList = { version: number; items: PackingItem[] };
export const getTripPacking = (id: string) =>
  apiRequest<TripPackingList>(`/itineraries/${id}/packing`, {
    cache: "no-store",
  });
export const saveTripPacking = (id: string, data: TripPackingList) =>
  apiRequest<TripPackingList>(`/itineraries/${id}/packing`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
export const PACKING_STARTERS: Record<
  string,
  Array<{ name: string; category: string }>
> = {
  Essentials: [
    { name: "ID and booking details", category: "essentials" },
    { name: "Phone charger", category: "gear" },
    { name: "Reusable water bottle", category: "gear" },
    { name: "Change of clothes", category: "clothing" },
    { name: "Toiletries", category: "toiletries" },
  ],
  Beach: [
    { name: "Swimwear", category: "clothing" },
    { name: "Beach towel", category: "gear" },
    { name: "Sun hat", category: "clothing" },
    { name: "Waterproof pouch", category: "gear" },
  ],
  Outdoors: [
    { name: "Walking shoes", category: "clothing" },
    { name: "Rain jacket", category: "clothing" },
    { name: "Day bag", category: "gear" },
    { name: "Reusable water bottle", category: "gear" },
  ],
};
export function addPackingStarter(
  items: PackingItem[],
  starter: string,
): PackingItem[] {
  const names = new Set(items.map((item) => item.name.trim().toLowerCase()));
  return [
    ...items,
    ...(PACKING_STARTERS[starter] ?? [])
      .filter((item) => !names.has(item.name.toLowerCase()))
      .map((item) => ({
        ...item,
        id: crypto.randomUUID(),
        quantity: 1,
        packed: false,
      })),
  ];
}
