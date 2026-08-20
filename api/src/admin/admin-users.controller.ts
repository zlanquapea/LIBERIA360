import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AdminUsersService } from "./admin-users.service";
import { QueryUsersDto } from "./dto/query-users.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { SuperAdminGuard } from "../auth/guards/super-admin.guard";
import { toPublicUser } from "../users/user.serializer";

// Super-admin only — see AdminUsersService's doc comment.
@ApiTags("Admin Users")
@Controller("admin/users")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SuperAdminGuard)
export class AdminUsersController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  @Get()
  async findAll(@Query() query: QueryUsersDto) {
    const result = await this.adminUsersService.findAll({
      page: query.page ?? 1,
      limit: query.limit ?? 20,
      search: query.search,
      travelerType: query.travelerType,
      isAdmin: query.isAdmin as "true" | "false" | undefined,
    });
    return { ...result, data: result.data.map(toPublicUser) };
  }
}
