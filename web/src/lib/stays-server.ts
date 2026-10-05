import { serverApiOrigin } from './server-api-origin';
import type { PublicStay } from './stays-api';
import { businessHasRooms } from './stays';

/** A property's rooms for server-rendered pages; null when it has none. */
export async function getStayForBusiness(business: { id: string; type: string }): Promise<PublicStay | null> {
  if (!businessHasRooms(business.type)) return null;
  try {
    const res = await fetch(`${serverApiOrigin()}/api/v1/stays/${business.id}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const stay = (await res.json()) as PublicStay;
    return stay.roomTypes.length ? stay : null;
  } catch {
    return null;
  }
}
