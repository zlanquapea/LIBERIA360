import type { Place } from "./entities/place.entity";

/** Fields that make up a place's "practical information" — editing any of
 * them restates it, so provenance is refreshed. */
export const PRACTICAL_FIELDS = [
  "openingHours",
  "contactPhone",
  "whatsapp",
  "website",
  "estimatedCostEntry",
  "estimatedCostGuide",
  "estimatedCostTransport",
  "amenities",
  "accessibilityNotes",
  "transportNotes",
] as const;

/** An emptied notes field is stored as null, not "". */
export function normalizePracticalNotes(
  place: Pick<Place, "accessibilityNotes" | "transportNotes" | "amenities">,
  dto: {
    accessibilityNotes?: string;
    transportNotes?: string;
    amenities?: string[];
  },
): void {
  if (dto.accessibilityNotes !== undefined) {
    place.accessibilityNotes = dto.accessibilityNotes.trim() || null;
  }
  if (dto.transportNotes !== undefined) {
    place.transportNotes = dto.transportNotes.trim() || null;
  }
  if (dto.amenities !== undefined) {
    place.amenities = [...new Set(dto.amenities)] as Place["amenities"];
  }
}
