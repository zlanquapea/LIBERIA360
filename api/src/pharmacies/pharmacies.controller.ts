import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import type { Response } from "express";
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
  UploadPrescriptionDto,
  VerificationDto,
} from "./dto/pharmacy.dto";
import { PharmaciesService } from "./pharmacies.service";

// Matches uploads.controller.ts's own image cap; a prescription upload
// separately also allows a PDF (see pharmacies.service.ts) up to 10MB.
const MAX_PRESCRIPTION_FILE_SIZE_BYTES = 10 * 1024 * 1024;

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
  // Uploaded *before* checkout — returns the prescriptionId the cart then
  // submits as CreateOrderDto.prescriptionId.
  @Post("prescriptions")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: { fileSize: MAX_PRESCRIPTION_FILE_SIZE_BYTES },
    }),
  )
  uploadPrescription(
    @CurrentUser() u: User,
    @Body() dto: UploadPrescriptionDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file)
      throw new BadRequestException(
        'No file uploaded (expected multipart field "file")',
      );
    return this.service.uploadPrescription(u.id, dto.pharmacyId, {
      buffer: file.buffer,
      originalName: file.originalname,
      mimeType: file.mimetype,
    });
  }
  // Streams the actual bytes back (not a URL — see PharmaciesService's
  // doc comment on prescriptionFile()) so this route itself, guarded by
  // JwtAuthGuard and the ownership/staff/admin check inside the service,
  // is the only way to ever read a prescription's content.
  @Get("prescriptions/:id/file")
  async prescriptionFile(
    @CurrentUser() u: User,
    @Param("id") id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { buffer, mimeType, originalFilename } =
      await this.service.prescriptionFile(u.id, u.isAdmin, id);
    res.set({
      "Content-Type": mimeType,
      "Content-Disposition": `inline; filename="${encodeURIComponent(originalFilename)}"`,
    });
    return new StreamableFile(buffer);
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
