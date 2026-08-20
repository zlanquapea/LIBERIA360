import { IsEnum } from "class-validator";
import { CreatorVerificationStatus } from "../../creators/entities/creator.enums";

export class SetCreatorVerificationDto {
  @IsEnum(CreatorVerificationStatus)
  status: CreatorVerificationStatus;
}
