import { IsEnum } from "class-validator";
import { CollaboratorRole } from "../entities/itinerary.enums";

export class SetCollaboratorRoleDto {
  @IsEnum(CollaboratorRole)
  role: CollaboratorRole;
}
