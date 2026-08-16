import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { AdminContentService } from "./admin-content.service";
import { CreatePlaceDto } from "./dto/create-place.dto";
import { UpdatePlaceDto } from "./dto/update-place.dto";
import { CreateActivityDto } from "./dto/create-activity.dto";
import { UpdateActivityDto } from "./dto/update-activity.dto";
import { CreateBusinessAdminDto } from "./dto/create-business-admin.dto";
import { UpdateBusinessAdminDto } from "./dto/update-business-admin.dto";
import { UpdateEventDto } from "./dto/update-event.dto";
import { UpdateCountyDto } from "./dto/update-county.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { AdminGuard } from "../auth/guards/admin.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { User } from "../users/entities/user.entity";
import { toPublicUser } from "../users/user.serializer";
import { Business } from "../businesses/entities/business.entity";
import { Event } from "../events/entities/event.entity";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";

function sanitizeBusiness(business: Business) {
  return {
    ...business,
    owner: business.owner ? toPublicUser(business.owner) : null,
  };
}

function sanitizeEvent(event: Event) {
  return {
    ...event,
    createdBy: event.createdBy ? toPublicUser(event.createdBy) : null,
  };
}

@ApiTags("Admin Content")
@Controller("admin")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminContentController {
  constructor(private readonly adminContentService: AdminContentService) {}

  @Post("places")
  createPlace(@Body() dto: CreatePlaceDto) {
    return this.adminContentService.createPlace(dto);
  }

  @Patch("places/:id")
  updatePlace(@Param("id") id: string, @Body() dto: UpdatePlaceDto) {
    return this.adminContentService.updatePlace(id, dto);
  }

  @Post("activities")
  createActivity(@Body() dto: CreateActivityDto) {
    return this.adminContentService.createActivity(dto);
  }

  @Patch("activities/:id")
  updateActivity(@Param("id") id: string, @Body() dto: UpdateActivityDto) {
    return this.adminContentService.updateActivity(id, dto);
  }

  @Post("businesses")
  async createBusiness(@Body() dto: CreateBusinessAdminDto) {
    return sanitizeBusiness(await this.adminContentService.createBusiness(dto));
  }

  @Patch("businesses/:id")
  async updateBusiness(
    @Param("id") id: string,
    @Body() dto: UpdateBusinessAdminDto,
  ) {
    return sanitizeBusiness(
      await this.adminContentService.updateBusiness(id, dto),
    );
  }

  @Patch("events/:id")
  async updateEvent(@Param("id") id: string, @Body() dto: UpdateEventDto) {
    return sanitizeEvent(await this.adminContentService.updateEvent(id, dto));
  }

  @Delete("events/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteEvent(@CurrentUser() admin: User, @Param("id") id: string) {
    return this.adminContentService.deleteEvent(admin.id, id);
  }

  @Delete("reviews/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteReview(@CurrentUser() admin: User, @Param("id") id: string) {
    return this.adminContentService.deleteReview(admin.id, id);
  }

  @Patch("counties/:id")
  updateCounty(@Param("id") id: string, @Body() dto: UpdateCountyDto) {
    return this.adminContentService.updateCounty(id, dto);
  }
}
