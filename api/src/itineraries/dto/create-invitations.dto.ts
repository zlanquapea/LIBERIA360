import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsOptional,
  IsUUID,
  ValidateNested,
} from "class-validator";

/** Exactly one of the two — a pick from the "people on the platform"
 * search (userId) or a bare address for someone who isn't on the
 * platform yet (email). Validated in the service, not here: which one is
 * required depends on the other being absent, which class-validator's
 * per-field decorators can't express directly against a sibling field. */
export class InviteeDto {
  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}

/** POST /itineraries/:id/invitations — one call, many invitees (Section
 * 7's "allow multiple invitations in one flow"). */
export class CreateInvitationsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => InviteeDto)
  invitees: InviteeDto[];
}
