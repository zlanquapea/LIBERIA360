import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MaxLength,
} from "class-validator";
import { ActivityDifficulty } from "../../activities/entities/activity.enums";

export class CreateActivityDto {
  @IsUUID()
  placeId: string;

  @IsString()
  @MaxLength(200)
  name: string;

  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() @MaxLength(100) duration?: string;
  @IsOptional() @IsNumber() @Min(0) price?: number;
  @IsOptional() @IsEnum(ActivityDifficulty) difficulty?: ActivityDifficulty;
  @IsOptional() @IsString() @MaxLength(50) ageRange?: string;
  @IsOptional() @IsBoolean() guideRequired?: boolean;
}
