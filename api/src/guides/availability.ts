import { BadRequestException, ConflictException } from "@nestjs/common";

export interface GuideAvailability {
  enabled: boolean;
  weekdays: number[];
  blockedDates: string[];
  version: number;
}

export const defaultAvailability: GuideAvailability = {
  enabled: false,
  weekdays: [0, 1, 2, 3, 4, 5, 6],
  blockedDates: [],
  version: 0,
};

export function assertGuideDate(
  date: string,
  availability: GuideAvailability,
  bookedDates: string[] = [],
  today = new Date().toISOString().slice(0, 10),
) {
  const parsed = new Date(date + "T00:00:00Z");
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isFinite(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== date ||
    date < today
  )
    throw new BadRequestException("Choose a valid date today or later.");
  if (
    bookedDates.includes(date) ||
    (availability.enabled &&
      (!availability.weekdays.includes(parsed.getUTCDay()) ||
        availability.blockedDates.includes(date)))
  )
    throw new ConflictException(
      "The guide is unavailable on this date. Choose another date.",
    );
}
