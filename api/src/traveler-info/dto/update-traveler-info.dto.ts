import {
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export class UpdateTravelerInfoDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1000)
  usdToLrdRate?: number;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  visaInfo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  entryRequirements?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  currentSeasonNote?: string;
}
