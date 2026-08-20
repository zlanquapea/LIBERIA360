import {
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MaxLength,
} from "class-validator";

export class CreateOfferingDto {
  @IsString()
  @MaxLength(150)
  title: string;

  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsNumber() @Min(0) priceFrom?: number;
  @IsOptional() @IsString() @MaxLength(100) durationLabel?: string;
  @IsOptional() @IsString() @MaxLength(150) location?: string;
}
