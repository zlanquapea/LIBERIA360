import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from "@nestjs/common";
import { AdminTeamService } from "./admin-team.service";
import { SetTeamRolesDto } from "./dto/set-team-roles.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { SuperAdminGuard } from "../auth/guards/super-admin.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { User } from "../users/entities/user.entity";
import { toPublicUser } from "../users/user.serializer";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";

@ApiTags("Admin Team")
@Controller("admin/team")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SuperAdminGuard)
export class AdminTeamController {
  constructor(private readonly adminTeamService: AdminTeamService) {}

  @Get()
  async findTeam() {
    const team = await this.adminTeamService.findTeam();
    return team.map(toPublicUser);
  }

  @Get("search")
  async search(@Query("email") email: string) {
    return toPublicUser(await this.adminTeamService.search(email));
  }

  @Patch(":userId")
  async setRoles(
    @CurrentUser() actingUser: User,
    @Param("userId") userId: string,
    @Body() dto: SetTeamRolesDto,
  ) {
    const updated = await this.adminTeamService.setRoles(
      actingUser.id,
      userId,
      dto,
    );
    return toPublicUser(updated);
  }
}
