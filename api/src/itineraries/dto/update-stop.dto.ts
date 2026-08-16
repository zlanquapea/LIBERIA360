import { IsOptional, IsString, MaxLength } from "class-validator";

export class UpdateStopDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;
}
