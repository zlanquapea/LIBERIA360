import { Transform, Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
  ValidateIf,
  ValidateNested,
} from "class-validator";
import {
  FulfillmentMethod,
  PharmacyOrderStatus,
  PharmacyStaffRole,
  PharmacyStatus,
  PrescriptionDecision,
} from "../entities/pharmacy.enums";

export class PharmacyQueryDto {
  @IsOptional() @IsString() @Length(0, 100) search?: string;
  @IsOptional() @IsString() @Length(0, 80) location?: string;
  @IsOptional()
  @Transform(({ value }) => value === "true")
  @IsBoolean()
  openNow?: boolean;
  @IsOptional()
  @Transform(({ value }) => value === "true")
  @IsBoolean()
  delivery?: boolean;
  @IsOptional()
  @Transform(({ value }) => value === "true")
  @IsBoolean()
  pickup?: boolean;
}
export class ProductQueryDto {
  @IsOptional() @IsString() @Length(0, 100) search?: string;
  @IsOptional() @IsUUID() categoryId?: string;
}
export class PharmacyProfileDto {
  @IsString() @Length(2, 160) name: string;
  @IsString() @Length(5, 240) address: string;
  @IsString() @Length(2, 80) location: string;
  @IsString() @Length(5, 40) telephone: string;
  // string | null (not just an optional string): omitting the field means
  // "leave unchanged" (see saveProfile()'s `!== undefined` checks below),
  // but a caller that already has a logo/cover/coordinates on file needs a
  // way to actually remove one — sending "" doesn't validate as a URL/
  // number and sending nothing at all would just leave the old value in
  // place. @IsOptional() short-circuits the type/range checks for both
  // undefined *and* null, so an explicit null still reaches saveProfile().
  @IsOptional() @IsString() logoUrl?: string | null;
  @IsOptional() @IsString() coverUrl?: string | null;
  // Matches the Pharmacy entity's decimal(9,6) columns — plenty of
  // precision for a street address, and rules out a caller passing degrees
  // as a huge/garbage number. Without these, an approved pharmacy has no
  // way to ever appear on PharmacyMap (see its own filter on both being
  // non-null) — every marketplace pharmacy was permanently map-invisible.
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number | null;
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number | null;
  @IsBoolean() pickupEnabled: boolean;
  @IsBoolean() deliveryEnabled: boolean;
  @Type(() => Number) @IsNumber() @Min(0) deliveryFee: number;
  @IsOptional() @IsString() @Length(2, 100) licenceNumber?: string;
}
export class ProductDto {
  @IsString() @Length(2, 180) name: string;
  @IsUUID() categoryId: string;
  @IsOptional() @IsString() imageUrl?: string;
  @Type(() => Number) @IsNumber() @Min(0) price: number;
  @Type(() => Number) @IsInt() @Min(0) @Max(100000) stockQuantity: number;
  // The stock level the editing form actually loaded, before the staff
  // member made any changes — required (by saveProduct(), not by
  // decorator, since it's meaningless on a create) so an edit can be
  // applied as a *delta* off the currently-stored quantity instead of
  // blindly overwriting it. Without this, stock a customer's concurrent
  // checkout decremented while the form sat open silently comes back the
  // moment the form is saved, since it always resubmits the count it
  // first loaded.
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100000)
  previousStockQuantity?: number;
  @IsBoolean() prescriptionRequired: boolean;
  @IsOptional() @IsBoolean() isVisible?: boolean;
}
export class CartItemDto {
  @IsUUID() productId: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) quantity: number;
}
export class UploadPrescriptionDto {
  @IsUUID() pharmacyId: string;
}
export class CreateOrderDto {
  @IsUUID() pharmacyId: string;
  @IsEnum(FulfillmentMethod) fulfillmentMethod: FulfillmentMethod;
  @IsOptional() @IsString() @Length(5, 500) deliveryAddress?: string;
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CartItemDto)
  items: CartItemDto[];
  @IsOptional() @IsUUID() prescriptionId?: string;
  @IsOptional() @IsBoolean() consentToPrescriptionProcessing?: boolean;
}
export class StatusDto {
  @IsEnum(PharmacyOrderStatus) status: PharmacyOrderStatus;
}
export class PrescriptionReviewDto {
  @IsEnum(PrescriptionDecision) decision: PrescriptionDecision;
  @IsOptional() @IsString() @Length(2, 1000) notes?: string;
  // The Prescription.version the caller actually inspected (surfaced on
  // each order by pharmacyOrders()) — required, not optional: without it a
  // pharmacist who opened the file, then had the customer resubmit before
  // clicking Accept/Reject, would have their decision silently applied to
  // bytes they never looked at. review() rejects a stale value with a 409
  // asking the caller to reload and re-review the latest submission.
  @Type(() => Number) @IsInt() @Min(1) prescriptionVersion: number;
}
export class VerificationDto {
  @IsEnum(PharmacyStatus) decision: PharmacyStatus;
  @IsOptional() @IsString() @Length(2, 1000) notes?: string;
}
export class AssignStaffDto {
  // By email, not userId — a manager knows a colleague's email, not their
  // account id; the same lookup-by-email pattern trip invitations use.
  @IsEmail() email: string;
  @IsEnum(PharmacyStaffRole) role: PharmacyStaffRole;
}
export class OpeningHoursEntryDto {
  @Type(() => Number) @IsInt() @Min(0) @Max(6) dayOfWeek: number;
  // Required whenever the day is open — an entry with isClosed: false and
  // no times used to pass validation and persist with null opens_at/
  // closes_at, a day the directory's openNow filter can never match (and
  // the dashboard's `??` fallback rendering masked the underlying nulls,
  // so re-saving never repaired it). Closed days still omit both freely.
  @ValidateIf((o: OpeningHoursEntryDto) => !o.isClosed)
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d(:00)?$/, {
    message: "opensAt must be in HH:MM (24-hour) format",
  })
  opensAt?: string;
  @ValidateIf((o: OpeningHoursEntryDto) => !o.isClosed)
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d(:00)?$/, {
    message: "closesAt must be in HH:MM (24-hour) format",
  })
  closesAt?: string;
  @IsBoolean() isClosed: boolean;
}
export class SaveOpeningHoursDto {
  // One entry per day actually submitted — a day omitted here is left
  // untouched rather than assumed closed, so a partial update (e.g.
  // correcting just Sunday) can't accidentally wipe the other six days.
  @IsArray()
  @ArrayMaxSize(7)
  @ValidateNested({ each: true })
  @Type(() => OpeningHoursEntryDto)
  hours: OpeningHoursEntryDto[];
}
