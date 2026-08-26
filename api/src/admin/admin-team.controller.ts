import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import { AdminTeamService } from "./admin-team.service";
import { SetTeamRolesDto } from "./dto/set-team-roles.dto";
import { CreateAdminDto } from "./dto/create-admin.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { SuperAdminGuard } from "../auth/guards/super-admin.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { User } from "../users/entities/user.entity";
import { toPublicUser } from "../users/user.serializer";
import { getRequestInfo } from "../common/request-info";
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

  @Post()
  async createAdmin(
    @CurrentUser() actingUser: User,
    @Body() dto: CreateAdminDto,
    @Req() req: Request,
  ) {
    const created = await this.adminTeamService.createAdmin(
      actingUser.id,
      actingUser.name,
      dto,
      getRequestInfo(req),
    );
    return toPublicUser(created);
  }

  @Patch(":userId")
  async setRoles(
    @CurrentUser() actingUser: User,
    @Param("userId") userId: string,
    @Body() dto: SetTeamRolesDto,
    @Req() req: Request,
  ) {
    const updated = await this.adminTeamService.setRoles(
      actingUser.id,
      userId,
      dto,
      getRequestInfo(req),
    );
    return toPublicUser(updated);
  }
}
