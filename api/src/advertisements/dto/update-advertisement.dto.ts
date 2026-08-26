import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from "class-validator";

// An owner editing their own ad after submitting it — no `type` here,
// same reasoning as UpdateBusinessDto excluding `type`/`placeId`: what
// category this ad was reviewed under isn't something an owner should be
// able to quietly change themselves.
export class UpdateAdvertisementDto {
  @IsOptional() @IsString() @MaxLength(200) title?: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;

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
