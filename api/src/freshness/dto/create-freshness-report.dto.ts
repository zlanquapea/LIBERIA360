import { IsEnum, IsUUID } from "class-validator";
import { FreshnessResponse } from "../entities/place-freshness-report.enums";

export class CreateFreshnessReportDto {
  @IsUUID()
  placeId: string;

  @IsEnum(FreshnessResponse)
  response: FreshnessResponse;
}
