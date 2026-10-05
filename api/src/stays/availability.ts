/**
 * Night-by-night room counting. A stay from check-in day A to check-out
 * day B uses the nights A, A+1, ..., B-1: a guest leaving on the 12th frees
 * the room for someone arriving on the 12th.
 */

const DAY = 24 * 60 * 60 * 1000;

const toTime = (date: string) => Date.parse(`${date}T00:00:00Z`);

export function addDays(date: string, days: number): string {
  return new Date(toTime(date) + days * DAY).toISOString().slice(0, 10);
}

export function nightsBetween(checkIn: string, checkOut: string): number {
  return Math.round((toTime(checkOut) - toTime(checkIn)) / DAY);
}

/** Every night of a stay, as "YYYY-MM-DD". */
export function eachNight(checkIn: string, checkOut: string): string[] {
  const n = nightsBetween(checkIn, checkOut);
  return Array.from({ length: Math.max(0, n) }, (_, i) => addDays(checkIn, i));
}

/** Today in Liberia (GMT, no daylight saving). */
export function todayInLiberia(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export type HeldStay = {
  checkIn: string;
  checkOut: string;
  rooms: number;
};

export type Block = {
  startDate: string;
  endDate: string;
  rooms: number;
};

/** Rooms taken on each night of [from, to): booked stays plus blocks. */
export function nightlyUse(
  from: string,
  to: string,
  stays: HeldStay[],
  blocks: Block[] = [],
): { booked: number[]; blocked: number[] } {
  const nights = eachNight(from, to);
  const booked = nights.map(() => 0);
  const blocked = nights.map(() => 0);
  nights.forEach((night, i) => {
    for (const s of stays) {
      if (s.checkIn <= night && night < s.checkOut) booked[i] += s.rooms;
    }
    for (const b of blocks) {
      if (b.startDate <= night && night <= b.endDate) blocked[i] += b.rooms;
    }
  });
  return { booked, blocked };
}

/** How many rooms are still free for every night of the stay. */
export function roomsLeft(
  totalRooms: number,
  from: string,
  to: string,
  stays: HeldStay[],
  blocks: Block[] = [],
): number {
  const { booked, blocked } = nightlyUse(from, to, stays, blocks);
  if (!booked.length) return 0;
  const busiest = Math.max(...booked.map((b, i) => b + blocked[i]));
  return Math.max(0, totalRooms - busiest);
}

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** A short code a guest can read out, without look-alike characters. */
export function reservationCode(random: () => number = Math.random): string {
  return Array.from(
    { length: 6 },
    () => CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)],
  ).join("");
}
