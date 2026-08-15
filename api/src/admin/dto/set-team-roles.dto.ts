import { IsBoolean } from "class-validator";

export class SetTeamRolesDto {
  @IsBoolean()
  isAdmin: boolean;

  @IsBoolean()
  isSuperAdmin: boolean;
}
