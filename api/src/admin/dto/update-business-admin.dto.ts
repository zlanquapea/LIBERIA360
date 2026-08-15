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

export class UpdateBusinessAdminDto {
  @IsOptional() @IsString() @MaxLength(200) name?: string;
  @IsOptional() @IsEnum(BusinessType) type?: BusinessType;

  // Lets an admin reassign or clear ownership (e.g. correcting a
  // mistakenly-claimed listing) — pass null to unset.
  @IsOptional() @IsUUID() ownerUserId?: string | null;

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
