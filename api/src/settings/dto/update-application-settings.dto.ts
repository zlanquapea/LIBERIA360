import { IsInt, IsOptional, Max, Min } from "class-validator";

// Every field optional — a PATCH-style partial update, same convention
// as SetTeamRolesDto/UpdatePlaceDto. Bounds are generous but real: a
// threshold of 0 would flag every single report/attempt, and an
// unbounded one could silently disable moderation/alerting entirely.
export class UpdateApplicationSettingsDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  freshnessFlagThreshold?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  freshnessWindowDays?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  reportFlagThreshold?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  reportWindowDays?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  failedLoginAlertThreshold1h?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10000)
  failedLoginAlertThreshold24h?: number;
}
