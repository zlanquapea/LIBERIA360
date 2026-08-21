import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
} from "class-validator";
import { BusinessContentType } from "../entities/business-content.enums";

// Created as DRAFT (see BusinessContent's doc comment) — a separate
// POST .../submit call moves it into review when the owner is ready.
// `businessId` rather than an implicit "my business" — an owner can have
// more than one claimed listing (BusinessesService.findMine returns an
// array), so the caller has to say which one this post belongs to.
export class CreateBusinessContentDto {
  @IsUUID()
  businessId: string;

  @IsEnum(BusinessContentType)
  type: BusinessContentType;

  @IsString()
  @MaxLength(200)
  title: string;

  @IsString()
  @MaxLength(5000)
  body: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  images?: string[];

  @IsOptional() @IsUrl() externalLink?: string;

  @IsOptional() @IsDateString() validFrom?: string;
  @IsOptional() @IsDateString() validUntil?: string;
}
