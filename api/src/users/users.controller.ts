import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { UsersService } from "./users.service";

@ApiTags("Users")
@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /** Public — no guard. Feeds the homepage hero's "join N travelers"
   * stat, so it needs to be reachable by anonymous visitors, not just
   * logged-in users. */
  @Get("stats")
  async getStats() {
    return { totalUsers: await this.usersService.countActive() };
  }
}
