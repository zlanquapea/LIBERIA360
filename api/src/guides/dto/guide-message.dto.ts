import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class SendGuideMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  body: string;

  @IsOptional()
  @IsString()
  visitorId?: string;
}
