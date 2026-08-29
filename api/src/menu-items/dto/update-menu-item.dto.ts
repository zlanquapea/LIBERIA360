import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";

// No `businessId` — same reasoning as UpdateCarListingDto/UpdateOfferingDto
// excluding their own parent-link field: which business a menu item
// belongs to isn't something an owner should be able to quietly reassign.
export class UpdateMenuItemDto {
  @IsOptional() @IsString() @MaxLength(150) name?: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsNumber() @Min(0) @Max(100000) price?: number;
  @IsOptional() @IsString() @MaxLength(500) image?: string;
  @IsOptional() @IsString() @MaxLength(60) category?: string;
  @IsOptional() @IsBoolean() isAvailable?: boolean;
  @IsOptional() @IsInt() @Min(0) sortOrder?: number;
}
