import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export class CreateMenuItemDto {
  @IsUUID()
  businessId: string;

  @IsString()
  @MaxLength(150)
  name: string;

  @IsOptional() @IsString() @MaxLength(2000) description?: string;

  @IsNumber()
  @Min(0)
  @Max(100000)
  price: number;

  @IsOptional() @IsString() @MaxLength(500) image?: string;
  @IsOptional() @IsString() @MaxLength(60) category?: string;
  @IsOptional() @IsBoolean() isAvailable?: boolean;
  @IsOptional() @IsInt() @Min(0) sortOrder?: number;
}
