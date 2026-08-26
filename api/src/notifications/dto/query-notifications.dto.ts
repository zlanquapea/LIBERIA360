import { Transform, Type } from "class-transformer";
import { IsBoolean, IsInt, IsOptional, Max, Min } from "class-validator";

export class QueryNotificationsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;

  // Narrows the list to unread notifications only — same string-coercion
  // guard as QueryLoginActivityDto's onlyFailed: a query param always
  // arrives as a string, so only the literal "true" should count.
  @IsOptional()
  @Transform(({ value }) => value === "true" || value === true)
  @IsBoolean()
  unreadOnly?: boolean;
}
