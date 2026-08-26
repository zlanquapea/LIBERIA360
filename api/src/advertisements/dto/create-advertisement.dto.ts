import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from "class-validator";
import { AdvertisementType } from "../entities/advertisement.enums";

export class CreateAdvertisementDto {
  @IsEnum(AdvertisementType)
  type: AdvertisementType;

  @IsString()
  @MaxLength(200)
  title: string;

  @IsString()
  @MaxLength(2000)
  description: string;

  // Each entry is a URL returned by POST /uploads/image — same convention
  // as Business.images.
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  images?: string[];

  @IsOptional() @IsString() @MaxLength(100) priceLabel?: string;
  @IsOptional() @IsString() @MaxLength(40) contactPhone?: string;
  @IsOptional() @IsString() @MaxLength(40) contactWhatsapp?: string;
  @IsOptional() @IsEmail() contactEmail?: string;
  @IsOptional() @IsUrl() externalLink?: string;
}
