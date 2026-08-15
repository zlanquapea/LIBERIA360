import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MaxLength,
} from "class-validator";
import { ActivityDifficulty } from "../../activities/entities/activity.enums";

// placeId is deliberately not editable here — re-parenting an activity to a
// different place is an edge case not worth supporting; delete/recreate
// covers it if ever needed.
export class UpdateActivityDto {
  @IsOptional() @IsString() @MaxLength(200) name?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() @MaxLength(100) duration?: string;
  @IsOptional() @IsNumber() @Min(0) price?: number;
  @IsOptional() @IsEnum(ActivityDifficulty) difficulty?: ActivityDifficulty;
  @IsOptional() @IsString() @MaxLength(50) ageRange?: string;
  @IsOptional() @IsBoolean() guideRequired?: boolean;
}
