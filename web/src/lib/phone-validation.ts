import { parsePhoneNumberFromString } from "libphonenumber-js";

const DEFAULT_COUNTRY = "LR" as const;

export function normalizePhoneInput(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = parsePhoneNumberFromString(trimmed, DEFAULT_COUNTRY);
  return parsed?.isValid() ? parsed.number : null;
}

export function phoneInputError(value: string): string | null {
  if (!value.trim()) return null;
  return normalizePhoneInput(value)
    ? null
    : "Enter a valid phone number, e.g. +231 77 123 4567 or 077 123 4567.";
}

export const PHONE_INPUT_HINT =
  "Use +231 77 123 4567 or a valid Liberia local number such as 077 123 4567.";
