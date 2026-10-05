import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UseGuards,
} from "@nestjs/common";
import { IsBoolean } from "class-validator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { User } from "../users/entities/user.entity";
import { AddStopDto } from "./dto/add-stop.dto";
import { TripVotingService } from "./trip-voting.service";
export class VoteDto {
  @IsBoolean() voted: boolean;
}
@Controller("itineraries/:id/suggestions")
@UseGuards(JwtAuthGuard)
export class TripVotingController {
  constructor(private readonly service: TripVotingService) {}
  @Get() @Header("Cache-Control", "no-store") list(
    @CurrentUser() u: User,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.service.list(u.id, id);
  }
  @Post() suggest(
    @CurrentUser() u: User,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: AddStopDto,
  ) {
    return this.service.suggest(u.id, id, dto);
  }
  @Put(":suggestion/vote") vote(
    @CurrentUser() u: User,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("suggestion", ParseUUIDPipe) s: string,
    @Body() dto: VoteDto,
  ) {
    return this.service.vote(u.id, id, s, dto.voted);
  }
  @Delete(":suggestion") remove(
    @CurrentUser() u: User,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("suggestion", ParseUUIDPipe) s: string,
  ) {
    return this.service.remove(u.id, id, s);
  }
  @Post(":suggestion/choose") choose(
    @CurrentUser() u: User,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("suggestion", ParseUUIDPipe) s: string,
  ) {
    return this.service.choose(u.id, id, s);
  }
}
