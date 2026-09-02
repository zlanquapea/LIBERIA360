import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AdminGuard } from "../auth/guards/admin.guard";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CreateFaqDto, ReorderFaqsDto, UpdateFaqDto } from "./dto/faq.dto";
import { FaqService } from "./faq.service";

@ApiTags("FAQ")
@Controller("faq")
export class FaqController {
  constructor(private readonly faq: FaqService) {}
  @Get() list() {
    return this.faq.findPublished();
  }
}

@ApiTags("FAQ Management")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller("admin/faq")
export class AdminFaqController {
  constructor(private readonly faq: FaqService) {}
  @Get() list() {
    return this.faq.findAllForAdmin();
  }
  @Post() create(@Body() dto: CreateFaqDto) {
    return this.faq.create(dto);
  }
  @Patch(":id") update(@Param("id") id: string, @Body() dto: UpdateFaqDto) {
    return this.faq.update(id, dto);
  }
  @Delete(":id") async delete(
    @Param("id") id: string,
  ): Promise<{ success: true }> {
    await this.faq.delete(id);
    return { success: true };
  }
  @Patch("reorder/apply") async reorder(
    @Body() dto: ReorderFaqsDto,
  ): Promise<{ success: true }> {
    await this.faq.reorder(dto);
    return { success: true };
  }
}
