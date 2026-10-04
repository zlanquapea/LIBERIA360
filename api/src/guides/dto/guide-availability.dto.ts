import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsInt,
  Matches,
  Max,
  Min,
} from "class-validator";

export class GuideAvailabilityDto {
  @IsBoolean()
  enabled: boolean;

  @IsArray()
  @ArrayMaxSize(7)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  weekdays: number[];

  @IsArray()
  @ArrayMaxSize(365)
  @ArrayUnique()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { each: true })
  blockedDates: string[];

  @IsInt()
  @Min(0)
  version: number;
}
