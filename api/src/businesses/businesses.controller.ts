import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { BusinessesService } from "./businesses.service";
import { CreateBusinessDto } from "./dto/create-business.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { User } from "../users/entities/user.entity";
import { toPublicUser } from "../users/user.serializer";
import { Business } from "./entities/business.entity";

function sanitize(business: Business) {
  return {
    ...business,
    owner: business.owner ? toPublicUser(business.owner) : null,
  };
}

@Controller("businesses")
export class BusinessesController {
  constructor(private readonly businessesService: BusinessesService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async claim(@CurrentUser() user: User, @Body() dto: CreateBusinessDto) {
    const business = await this.businessesService.claimPlace(user.id, dto);
    return sanitize(business);
  }

  @Post(":id/claim")
  @UseGuards(JwtAuthGuard)
  async claimExisting(@CurrentUser() user: User, @Param("id") id: string) {
    const business = await this.businessesService.claimExisting(user.id, id);
    return sanitize(business);
  }

  @Get("mine")
  @UseGuards(JwtAuthGuard)
  async mine(@CurrentUser() user: User) {
    const businesses = await this.businessesService.findMine(user.id);
    return businesses.map(sanitize);
  }

  @Get()
  async byPlace(@Query("placeId") placeId: string) {
    if (!placeId) {
      return null;
    }
    const business = await this.businessesService.findByPlace(placeId);
    return business ? sanitize(business) : null;
  }
}
