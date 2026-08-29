import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from "class-validator";

export class AssistantHistoryMessageDto {
  @IsIn(["user", "assistant"])
  role!: "user" | "assistant";

  @IsString()
  @MinLength(1)
  @MaxLength(800)
  content!: string;
}

export class AskAssistantDto {
  @IsString()
  @MinLength(2)
  @MaxLength(600)
  message!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @ValidateNested({ each: true })
  @Type(() => AssistantHistoryMessageDto)
  history?: AssistantHistoryMessageDto[];

  @IsOptional()
  @IsString()
  @MaxLength(160)
  currentPath?: string;
}
