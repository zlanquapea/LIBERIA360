import { IsEnum } from "class-validator";
import { EventRsvpStatus } from "../entities/event.enums";

export class SetEventRsvpDto {
  @IsEnum(EventRsvpStatus)
  status: EventRsvpStatus;
}
