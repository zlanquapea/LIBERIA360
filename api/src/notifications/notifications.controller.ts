import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { NotificationsService } from "./notifications.service";
import { QueryNotificationsDto } from "./dto/query-notifications.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { User } from "../users/entities/user.entity";

// Every route here is scoped to the calling user via @CurrentUser — a
// regular traveler and an admin hit the exact same endpoints; there's no
// separate "admin notifications" API, just each user's own rows (see
// Notification's doc comment for why).
@ApiTags("Notifications")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("notifications")
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  findMine(@CurrentUser() user: User, @Query() query: QueryNotificationsDto) {
    return this.notificationsService.findForUser(user.id, query);
  }

  @Get("unread-count")
  async unreadCount(@CurrentUser() user: User) {
    return { count: await this.notificationsService.getUnreadCount(user.id) };
  }

  @Patch(":id/read")
  markRead(@CurrentUser() user: User, @Param("id") id: string) {
    return this.notificationsService.markRead(user.id, id);
  }

  @Post("read-all")
  @HttpCode(HttpStatus.NO_CONTENT)
  async markAllRead(@CurrentUser() user: User): Promise<void> {
    await this.notificationsService.markAllRead(user.id);
  }
}
