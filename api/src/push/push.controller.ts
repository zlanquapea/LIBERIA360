import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from "@nestjs/common";
import { PushService } from "./push.service";
import { SubscribePushDto } from "./dto/subscribe-push.dto";
import { UnsubscribePushDto } from "./dto/unsubscribe-push.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { User } from "../users/entities/user.entity";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";

@ApiTags("Push Notifications")
@Controller("push")
export class PushController {
  constructor(private readonly pushService: PushService) {}

  /** Public — the frontend needs this to create a PushSubscription in the browser. */
  @Get("vapid-public-key")
  getPublicKey() {
    return { publicKey: this.pushService.getPublicKey() };
  }

  @Post("subscribe")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async subscribe(@CurrentUser() user: User, @Body() dto: SubscribePushDto) {
    await this.pushService.subscribe(user.id, dto);
  }

  @Post("unsubscribe")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async unsubscribe(@Body() dto: UnsubscribePushDto) {
    await this.pushService.unsubscribe(dto.endpoint);
  }
}
