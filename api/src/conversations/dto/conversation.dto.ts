import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from "class-validator";

export class CreateConversationDto {
  @IsUUID()
  participantId: string;
  @IsOptional() @IsString() @MaxLength(60) contextType?: string;
  @IsOptional() @IsUUID() contextId?: string;
  @IsOptional() @IsString() @MaxLength(180) title?: string;
  @IsOptional() @IsString() @MaxLength(500) avatarUrl?: string;
}

export class SendConversationMessageDto {
  @IsString() @MaxLength(4000) body: string;
  @IsOptional()
  @IsIn(["text", "image", "file", "voice", "location"])
  messageType?: string;
  @IsOptional() @IsArray() attachments?: Array<Record<string, unknown>>;
}

export class UpdateConversationMessageDto {
  @IsString() @MinLength(1) @MaxLength(4000) body: string;
}

export class ToggleConversationReactionDto {
  @IsString() @MinLength(1) @MaxLength(12) emoji: string;
}
