import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import { Type } from "class-transformer";

export class SafetyReportDto {
  @IsIn(["creator_post", "conversation_message"]) targetType:
    "creator_post" | "conversation_message";
  @IsUUID() targetId: string;
  @IsIn(["spam", "harassment", "fraud", "inappropriate", "other"])
  reason: string;
  @IsOptional() @IsString() @MaxLength(1000) details?: string;
}
export class SafetyQueueDto {
  @IsOptional() @IsIn(["open", "reviewed"]) status?: "open" | "reviewed" =
    "open";
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  page?: number = 1;
}
export class ReviewSafetyReportDto {
  @IsIn(["dismiss", "hide"]) action: "dismiss" | "hide";
}
