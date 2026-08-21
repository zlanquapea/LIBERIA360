import { IsString, MaxLength, MinLength } from "class-validator";

/** GET /itineraries/:id/invitations/search-people?q= — "People you may
 * want to invite" (Section 7). Requires 2+ characters so this can't be
 * used to page through the entire user table one letter at a time. */
export class SearchInvitableUsersDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  q: string;
}
