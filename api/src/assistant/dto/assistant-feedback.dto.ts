import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";
import { AssistantFeedbackType } from "../entities/assistant-feedback.entity";

export class CreateAssistantFeedbackDto {
  @IsIn([
    AssistantFeedbackType.HELPFUL,
    AssistantFeedbackType.NOT_HELPFUL,
    AssistantFeedbackType.INCORRECT,
    AssistantFeedbackType.UNANSWERED,
  ])
  type!: AssistantFeedbackType;

  @IsString()
  @MinLength(2)
  @MaxLength(600)
  question!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(1600)
  answer!: string;

  @IsIn(["ai", "knowledge"])
  source!: "ai" | "knowledge";

  @IsOptional()
  @IsString()
  @MaxLength(160)
  currentPath?: string;

  @IsOptional()
  @IsString()
  @MaxLength(600)
  details?: string;
}
