/** A three-letter code for a destination, like an airport's: the first
 * three letters of its first word ("Kpatawee Waterfall" → "KPA"). */
export function destinationCode(name: string | null | undefined): string {
  const letters = (name ?? '').normalize('NFD').replace(/[^A-Za-z]/g, ' ').trim().split(/\s+/)[0] ?? '';
  return (letters.slice(0, 3) || 'LBR').toUpperCase().padEnd(3, 'X');
}

/** Whole days a trip spans, counting both ends; null without both dates. */
export function tripDays(startDate: string | null, endDate: string | null): number | null {
  if (!startDate || !endDate) return null;
  const days = Math.round((Date.parse(endDate) - Date.parse(startDate)) / 86_400_000) + 1;
  return days > 0 ? days : null;
}

/** "17 OCT", in Liberia time so server and browser agree. */
export function passDate(date: string, locale = 'en-US'): string {
  const d = new Date(date);
  const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale, { timeZone: 'Africa/Monrovia', ...o }).format(d);
  return `${fmt({ day: 'numeric' })} ${fmt({ month: 'short' }).toUpperCase().replace('.', '')}`;
}

/** Bar widths (1–3) for a decorative barcode that's the same every time
 * for a given trip and different between trips. */
export function barcodeBars(seed: string, count = 34): number[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  const bars: number[] = [];
  for (let i = 0; i < count; i++) {
    h = Math.imul(h ^ (h >>> 15), 2246822507) ^ i;
    bars.push(1 + (Math.abs(h) % 3));
  }
  return bars;
}
