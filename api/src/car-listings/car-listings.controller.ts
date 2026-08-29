import {
  Body,
  Controller,
  Delete,
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
import { CarListingsService } from "./car-listings.service";
import { CreateCarListingDto } from "./dto/create-car-listing.dto";
import { UpdateCarListingDto } from "./dto/update-car-listing.dto";
import { QueryCarListingsDto } from "./dto/query-car-listings.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { User } from "../users/entities/user.entity";
import { toPublicUser } from "../users/user.serializer";
import { CarListing } from "./entities/car-listing.entity";

// `owner` (the direct lister) and `business.owner` (eager on Business, for
// the rare linked-business case) both carry a raw passwordHash — every
// response has to strip both down to the public shape, same pattern as
// BusinessesController/AdvertisementsController's own `sanitize`.
function sanitize(listing: CarListing) {
  return {
    ...listing,
    owner: listing.owner ? toPublicUser(listing.owner) : null,
    business: listing.business
      ? {
          ...listing.business,
          owner: listing.business.owner
            ? toPublicUser(listing.business.owner)
            : null,
        }
      : null,
  };
}

@ApiTags("Car Rentals")
@Controller("car-listings")
export class CarListingsController {
  constructor(private readonly carListingsService: CarListingsService) {}

  // Public — the /car-rentals directory.
  @Get()
  async findAllApproved(@Query() query: QueryCarListingsDto) {
    const result = await this.carListingsService.findAllApproved(query);
    return { ...result, data: result.data.map(sanitize) };
  }

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async create(@CurrentUser() user: User, @Body() dto: CreateCarListingDto) {
    return sanitize(await this.carListingsService.create(user.id, dto));
  }

  @Get("mine")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async findMine(@CurrentUser() user: User) {
    const listings = await this.carListingsService.findMine(user.id);
    return listings.map(sanitize);
  }

  // Public — the /car-rentals/[id] detail page. Declared after "mine" so
  // that literal segment matches first, same ordering as
  // AdvertisementsController's active/active/:id/:id.
  @Get(":id")
  async findApprovedOne(@Param("id") id: string) {
    return sanitize(await this.carListingsService.findApprovedOne(id));
  }

  @Get("mine/:id")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async findOne(@CurrentUser() user: User, @Param("id") id: string) {
    return sanitize(await this.carListingsService.findOne(user.id, id));
  }

  @Patch(":id")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async update(
    @CurrentUser() user: User,
    @Param("id") id: string,
    @Body() dto: UpdateCarListingDto,
  ) {
    return sanitize(await this.carListingsService.update(user.id, id, dto));
  }

  @Delete(":id")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser() user: User, @Param("id") id: string) {
    await this.carListingsService.remove(user.id, id);
  }
}
