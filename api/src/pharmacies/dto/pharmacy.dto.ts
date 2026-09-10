import { Transform, Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
  ValidateNested,
} from "class-validator";
import {
  FulfillmentMethod,
  PharmacyOrderStatus,
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
  @IsOptional() @IsString() logoUrl?: string;
  @IsOptional() @IsString() coverUrl?: string;
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
  @IsOptional() @IsString() prescriptionId?: string;
  @IsOptional() @IsBoolean() consentToPrescriptionProcessing?: boolean;
}
export class StatusDto {
  @IsEnum(PharmacyOrderStatus) status: PharmacyOrderStatus;
}
export class PrescriptionReviewDto {
  @IsEnum(PrescriptionDecision) decision: PrescriptionDecision;
  @IsOptional() @IsString() @Length(2, 1000) notes?: string;
}
export class VerificationDto {
  @IsEnum(PharmacyStatus) decision: PharmacyStatus;
  @IsOptional() @IsString() @Length(2, 1000) notes?: string;
}
