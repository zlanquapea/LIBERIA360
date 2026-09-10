import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { AdminGuard } from "../auth/guards/admin.guard";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { User } from "../users/entities/user.entity";
import {
  CreateOrderDto,
  PharmacyProfileDto,
  PharmacyQueryDto,
  PrescriptionReviewDto,
  ProductDto,
  ProductQueryDto,
  StatusDto,
  VerificationDto,
} from "./dto/pharmacy.dto";
import { PharmaciesService } from "./pharmacies.service";

@ApiTags("Pharmacies")
@Controller("pharmacies")
export class PharmaciesController {
  constructor(private readonly service: PharmaciesService) {}
  @Get() directory(@Query() q: PharmacyQueryDto) {
    return this.service.directory(q);
  }
  @Get("categories") categories() {
    return this.service.categoriesList();
  }
  @Get(":slug") one(@Param("slug") slug: string) {
    return this.service.one(slug);
  }
  @Get(":id/products") products(
    @Param("id") id: string,
    @Query() q: ProductQueryDto,
  ) {
    return this.service.catalog(id, q);
  }
}

@ApiTags("Pharmacy customer")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("pharmacy-marketplace")
export class PharmacyCustomerController {
  constructor(private readonly service: PharmaciesService) {}
  @Post("orders") create(@CurrentUser() u: User, @Body() dto: CreateOrderDto) {
    return this.service.createOrder(u.id, dto);
  }
  @Get("orders/mine") mine(@CurrentUser() u: User) {
    return this.service.customerOrders(u.id);
  }
}

@ApiTags("Pharmacy dashboard")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("pharmacy-dashboard")
export class PharmacyDashboardController {
  constructor(private readonly service: PharmaciesService) {}
  @Get() mine(@CurrentUser() u: User) {
    return this.service.mine(u.id);
  }
  @Post() create(@CurrentUser() u: User, @Body() dto: PharmacyProfileDto) {
    return this.service.saveProfile(u.id, undefined, dto);
  }
  @Patch(":id") update(
    @CurrentUser() u: User,
    @Param("id") id: string,
    @Body() dto: PharmacyProfileDto,
  ) {
    return this.service.saveProfile(u.id, id, dto);
  }
  @Post(":id/products") product(
    @CurrentUser() u: User,
    @Param("id") id: string,
    @Body() dto: ProductDto,
  ) {
    return this.service.saveProduct(u.id, id, undefined, dto);
  }
  @Patch(":id/products/:productId") updateProduct(
    @CurrentUser() u: User,
    @Param("id") id: string,
    @Param("productId") productId: string,
    @Body() dto: ProductDto,
  ) {
    return this.service.saveProduct(u.id, id, productId, dto);
  }
  @Delete(":id/products/:productId") remove(
    @CurrentUser() u: User,
    @Param("id") id: string,
    @Param("productId") productId: string,
  ) {
    return this.service.removeProduct(u.id, id, productId);
  }
  @Get(":id/orders") orders(@CurrentUser() u: User, @Param("id") id: string) {
    return this.service.pharmacyOrders(u.id, id);
  }
  @Patch(":id/orders/:orderId/status") status(
    @CurrentUser() u: User,
    @Param("id") id: string,
    @Param("orderId") orderId: string,
    @Body() dto: StatusDto,
  ) {
    return this.service.transition(u.id, id, orderId, dto.status);
  }
  @Post(":id/prescriptions/:prescriptionId/reviews") review(
    @CurrentUser() u: User,
    @Param("id") id: string,
    @Param("prescriptionId") prescriptionId: string,
    @Body() dto: PrescriptionReviewDto,
  ) {
    return this.service.review(u.id, id, prescriptionId, dto);
  }
  @Get(":id/statistics") stats(
    @CurrentUser() u: User,
    @Param("id") id: string,
  ) {
    return this.service.stats(u.id, id);
  }
}

@ApiTags("Admin pharmacies")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller("admin/pharmacies")
export class AdminPharmaciesController {
  constructor(private readonly service: PharmaciesService) {}
  @Get("applications") applications() {
    return this.service.applications();
  }
  @Patch(":id/verification") verify(
    @CurrentUser() u: User,
    @Param("id") id: string,
    @Body() dto: VerificationDto,
  ) {
    return this.service.verification(u.id, id, dto);
  }
  @Get("orders/all") orders() {
    return this.service.allOrders();
  }
  @Get("audit-log") audit() {
    return this.service.auditLogs();
  }
}
