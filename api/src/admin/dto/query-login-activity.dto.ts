import { Transform, Type } from "class-transformer";
import { IsBoolean, IsInt, IsOptional, Max, Min } from "class-validator";

export class QueryLoginActivityDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  // Narrows the list to failed attempts only — the brute-force/account-
  // enumeration view, as opposed to a full sign-in history. A plain
  // `@Type(() => Boolean)` would coerce the *string* "false" to `true`
  // (any non-empty string is truthy) since query params always arrive as
  // strings — this transform only treats the literal string "true" as
  // true, everything else (including "false" and undefined) as false/
  // unset.
  @IsOptional()
  @Transform(({ value }) => value === "true" || value === true)
  @IsBoolean()
  onlyFailed?: boolean;
}
