import { IsDateString, IsUUID } from "class-validator";

export class CreateSponsoredPlacementDto {
  @IsUUID()
  placeId: string;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;
}
