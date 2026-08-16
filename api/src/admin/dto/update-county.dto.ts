import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";

// Safety & practical-info panel fields only — name/slug/rolloutStage/icon
// aren't editable through this endpoint (they're seed-owned, not
// admin-owned, unlike this content).
export class UpdateCountyDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  emergencyNumber?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(300, { each: true })
  safetyTips?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  localCustoms?: string;
}
