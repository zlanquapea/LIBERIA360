import { IsEnum } from "class-validator";
import { VerificationStatus } from "../../places/entities/place.enums";

export class SetVerificationDto {
  @IsEnum(VerificationStatus)
  status: VerificationStatus;
}
