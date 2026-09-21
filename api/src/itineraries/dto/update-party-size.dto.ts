import { IsInt, Max, Min } from "class-validator";

export class UpdatePartySizeDto {
  @IsInt()
  @Min(1)
  @Max(50)
  partySize: number;
}
