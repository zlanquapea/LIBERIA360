import {
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js";
import { BadRequestException } from "@nestjs/common";
import { registerDecorator, type ValidationOptions } from "class-validator";

export const DEFAULT_PHONE_COUNTRY: CountryCode = "LR";

export function parseAndNormalizePhone(
  value: string | null | undefined,
  defaultCountry: CountryCode = DEFAULT_PHONE_COUNTRY,
): string | null {
  if (value == null || value.trim() === "") return null;
  const parsed = parsePhoneNumberFromString(value.trim(), defaultCountry);
  if (!parsed || !parsed.isValid()) return null;
  return parsed.number;
}

export function normalizePhoneOrThrow(
  value: string | null | undefined,
  fieldName = "Phone number",
): string | null {
  const normalized = parseAndNormalizePhone(value);
  if (value != null && value.trim() !== "" && !normalized) {
    throw new BadRequestException(
      `${fieldName} must be a valid phone number, for example +231 77 123 4567`,
    );
  }
  return normalized;
}

export function IsValidPhoneNumber(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: "isValidPhoneNumber",
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          return (
            value === undefined ||
            value === null ||
            (typeof value === "string" &&
              (value.trim() === "" || parseAndNormalizePhone(value) !== null))
          );
        },
        defaultMessage() {
          return "Phone number must be valid and include a country code or use a valid Liberia local format";
        },
      },
    });
  };
}
