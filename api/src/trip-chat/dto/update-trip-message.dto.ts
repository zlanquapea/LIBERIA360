import { IsNotEmpty, IsString, MaxLength } from "class-validator";

// Text-only, same as BookingMessage's edit — see
// TripChatService.updateMessage for why an image-only message can't be
// edited this way (there's no text to edit into something else).
export class UpdateTripMessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  body: string;
}
