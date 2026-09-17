import { IsOptional, IsString, MaxLength } from "class-validator";

// SearchService.suggest() treats anything under 2 characters as empty
// (see MIN_QUERY_LENGTH) — this just bounds the length of what a client
// could send at all, matching the debounced input's own expectations.
export class SuggestQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}
