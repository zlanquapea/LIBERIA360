import { IsDateString, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateCarListingBlockedDateDto {
  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
