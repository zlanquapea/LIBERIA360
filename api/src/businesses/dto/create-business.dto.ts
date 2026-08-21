import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import { BusinessType } from "../entities/business.enums";

export class CreateBusinessDto {
  @IsUUID()
  placeId: string;

  @IsString()
  @MaxLength(200)
  name: string;

  @IsEnum(BusinessType)
  type: BusinessType;

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

  @IsOptional() @IsUrl() logoImage?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  videos?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  openingHours?: string;

  @IsOptional() @IsNumber() @Min(0) @Max(1000000) priceRangeMin?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(1000000) priceRangeMax?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  servicesOffered?: string[];
}
