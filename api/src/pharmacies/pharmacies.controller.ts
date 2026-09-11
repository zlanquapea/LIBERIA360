import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
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
  AssignStaffDto,
  CreateOrderDto,
  PharmacyProfileDto,
  PharmacyQueryDto,
  PrescriptionReviewDto,
  ProductDto,
  ProductQueryDto,
  SaveOpeningHoursDto,
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
    @Param("id", ParseUUIDPipe) id: string,
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
  // Cleans up an uploaded prescription that was never attached to an
  // order — e.g. the customer picked a different file after a successful
  // upload but before checking out (see PharmacyShop's
  // uploadedPrescriptionRef, which now calls this on that path).
  @Delete("prescriptions/:id")
  deleteUnattachedPrescription(
    @CurrentUser() u: User,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.service.deleteUnattachedPrescription(u.id, id);
  }
  // Lets a customer reply to a pharmacist's clarification_requested
  // decision (see PharmaciesService.review()) by uploading a replacement
  // prescription for the same order — customerOrders() surfaces the
  // decision/notes that prompt this call.
  @Patch("orders/:orderId/prescription")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: { fileSize: MAX_PRESCRIPTION_FILE_SIZE_BYTES },
    }),
  )
  resubmitPrescription(
    @CurrentUser() u: User,
    @Param("orderId", ParseUUIDPipe) orderId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file)
      throw new BadRequestException(
        'No file uploaded (expected multipart field "file")',
      );
    return this.service.resubmitPrescription(u.id, orderId, {
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
    @Param("id", ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { buffer, mimeType, originalFilename } =
      await this.service.prescriptionFile(u.id, u.isAdmin, id);
    res.set({
      "Content-Type": mimeType,
      "Content-Disposition": `inline; filename="${encodeURIComponent(originalFilename)}"`,
      // This is sensitive medical data behind an auth check — without an
      // explicit no-store, a browser or intermediary proxy may retain the
      // response and keep serving it from cache or history after logout on
      // a shared device, since the service worker's logout cleanup only
      // clears its own cache storage, not the browser's HTTP cache.
      "Cache-Control": "private, no-store",
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
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: PharmacyProfileDto,
  ) {
    return this.service.saveProfile(u.id, id, dto);
  }
  // one() (the public storefront lookup) only works once a pharmacy is
  // approved — this is the only way staff can load their own hours to
  // edit while an application is still pending.
  @Get(":id/hours") getHours(
    @CurrentUser() u: User,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.service.getOpeningHours(u.id, id);
  }
  // Any staff role may set hours — unlike staff assignment, this isn't a
  // clinical or organizational decision, and gatekeeping it behind
  // "manager-only" would leave a pharmacist-only staffed pharmacy (or one
  // whose manager is unavailable) unable to ever open the storefront to
  // the "Open now" filter.
  @Patch(":id/hours") saveHours(
    @CurrentUser() u: User,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: SaveOpeningHoursDto,
  ) {
    return this.service.saveOpeningHours(u.id, id, dto);
  }
  // Manager-only — the only way this pharmacy gets a pharmacist (or a
  // second manager, or an employee) beyond the one saveProfile() created
  // automatically for whoever applied.
  @Post(":id/staff") assignStaff(
    @CurrentUser() u: User,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: AssignStaffDto,
  ) {
    return this.service.assignStaff(u.id, id, dto);
  }
  @Get(":id/staff") listStaff(
    @CurrentUser() u: User,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.service.listStaff(u.id, id);
  }
  // Deactivates (never hard-deletes, to preserve audit history) a staff
  // member's access — the only way a departed pharmacist/employee's
  // access is ever actually revoked, since assignStaff() only creates or
  // reassigns a membership.
  @Delete(":id/staff/:staffUserId") deactivateStaff(
    @CurrentUser() u: User,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("staffUserId", ParseUUIDPipe) staffUserId: string,
  ) {
    return this.service.deactivateStaff(u.id, id, staffUserId);
  }
  // Staff-facing — unlike PharmaciesController's public ":id/products"
  // (catalog()), this includes hidden products too, since staff need to
  // find and re-enable one they'd previously hidden.
  @Get(":id/products") myProducts(
    @CurrentUser() u: User,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.service.myProducts(u.id, id);
  }
  @Post(":id/products") product(
    @CurrentUser() u: User,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: ProductDto,
  ) {
    return this.service.saveProduct(u.id, id, undefined, dto);
  }
  @Patch(":id/products/:productId") updateProduct(
    @CurrentUser() u: User,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("productId", ParseUUIDPipe) productId: string,
    @Body() dto: ProductDto,
  ) {
    return this.service.saveProduct(u.id, id, productId, dto);
  }
  @Delete(":id/products/:productId") remove(
    @CurrentUser() u: User,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("productId", ParseUUIDPipe) productId: string,
  ) {
    return this.service.removeProduct(u.id, id, productId);
  }
  @Get(":id/orders") orders(
    @CurrentUser() u: User,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.service.pharmacyOrders(u.id, id);
  }
  @Patch(":id/orders/:orderId/status") status(
    @CurrentUser() u: User,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("orderId", ParseUUIDPipe) orderId: string,
    @Body() dto: StatusDto,
  ) {
    return this.service.transition(u.id, id, orderId, dto.status);
  }
  @Post(":id/prescriptions/:prescriptionId/reviews") review(
    @CurrentUser() u: User,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("prescriptionId", ParseUUIDPipe) prescriptionId: string,
    @Body() dto: PrescriptionReviewDto,
  ) {
    return this.service.review(u.id, id, prescriptionId, dto);
  }
  @Get(":id/statistics") stats(
    @CurrentUser() u: User,
    @Param("id", ParseUUIDPipe) id: string,
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
    @Param("id", ParseUUIDPipe) id: string,
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
