import { IsBoolean, IsEmail, IsString, Length } from "class-validator";

export class CreateAdminDto {
  @IsString()
  @Length(1, 150)
  name: string;

  @IsEmail()
  email: string;

  @IsBoolean()
  isSuperAdmin: boolean;
}
