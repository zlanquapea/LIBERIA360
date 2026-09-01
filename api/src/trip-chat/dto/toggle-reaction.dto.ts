import { IsNotEmpty, IsString, MaxLength } from "class-validator";

// Validated against TripChatService.ALLOWED_REACTIONS in the service,
// not here — class-validator's decorators check shape, not membership in
// a list the service already owns.
export class ToggleReactionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(16)
  emoji: string;
}
