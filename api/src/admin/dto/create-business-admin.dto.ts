import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
  MaxLength,
} from "class-validator";
import { BusinessType } from "../../businesses/entities/business.enums";

// Admin-seeded business record (Business Plan §9.2 — "seed the catalog
// directly via outreach before relying on self-service claiming").
// ownerUserId is optional: an unowned shell record can be claimed later by
// the real business owner via the existing POST /businesses/:id/claim.
export class CreateBusinessAdminDto {
  @IsUUID()
  placeId: string;

  @IsString()
  @MaxLength(200)
  name: string;

  @IsEnum(BusinessType)
  type: BusinessType;

  @IsOptional()
  @IsUUID()
  ownerUserId?: string;

  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @IsOptional() @IsString() @MaxLength(40) whatsapp?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsUrl() website?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  socialLinks?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  images?: string[];
}
