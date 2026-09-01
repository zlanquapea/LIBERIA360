import { IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

// `body` and `imageUrl` are both optional here — a message needs at
// least one of them, but that's a cross-field rule class-validator can't
// express cleanly on its own, so TripChatService.sendMessage checks it
// explicitly and throws a BadRequestException with a specific message
// instead of a generic validation error.
export class SendTripMessageDto {
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  body?: string;

  // A path already returned by POST /uploads/image — not validated as a
  // URL here for the same reason event/business photo fields aren't
  // elsewhere in this API: it's a relative upload path, not always a
  // full URL (see lib/images.ts's resolveImageUrl on the frontend).
  @IsOptional()
  @IsString()
  @MaxLength(500)
  imageUrl?: string;

  @IsOptional()
  @IsUUID()
  replyToMessageId?: string;

  // Echoed straight back on the created message — see
  // TripMessage.clientId's doc comment for what this is for.
  @IsOptional()
  @IsString()
  @MaxLength(100)
  clientId?: string;
}
