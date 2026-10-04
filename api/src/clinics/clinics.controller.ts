import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { AdminGuard } from "../auth/guards/admin.guard";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { OptionalJwtAuthGuard } from "../auth/guards/optional-jwt-auth.guard";
import { User } from "../users/entities/user.entity";
import { ClinicsService } from "./clinics.service";
import {
  AssignClinicStaffDto,
  CancelPrescriptionDto,
  ClinicProfileDto,
  ClinicVerificationDto,
  CounterStatusDto,
  DoctorProfileDto,
  DoctorVerificationDto,
  IssuePrescriptionDto,
  PatientLookupDto,
  PrescriptionCodeDto,
  SendPrescriptionDto,
} from "./dto/clinic.dto";
import { EPrescriptionsService } from "./e-prescriptions.service";

const uuid = new ParseUUIDPipe();

@ApiTags("Clinics")
@Controller("clinics")
export class ClinicsController {
  constructor(private readonly clinics: ClinicsService) {}
  @Get() directory() {
    return this.clinics.directory();
  }
  @Get(":slug") one(@Param("slug") slug: string) {
    return this.clinics.one(slug);
  }
}

@ApiTags("Clinics")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("clinic-dashboard")
export class ClinicDashboardController {
  constructor(
    private readonly clinics: ClinicsService,
    private readonly rx: EPrescriptionsService,
  ) {}

  @Get() mine(@CurrentUser() u: User) {
    return this.clinics.mine(u.id);
  }
  @Post() create(@CurrentUser() u: User, @Body() dto: ClinicProfileDto) {
    return this.clinics.create(u.id, dto);
  }
  // Declared before ":id" so it isn't read as a clinic id.
  @Get("attachable-pharmacies") attachable(@CurrentUser() u: User) {
    return this.clinics.attachablePharmacies(u.id);
  }
  @Get("doctor-profile") doctorProfile(@CurrentUser() u: User) {
    return this.clinics.myDoctorProfile(u.id);
  }
  @Put("doctor-profile") saveDoctorProfile(
    @CurrentUser() u: User,
    @Body() dto: DoctorProfileDto,
  ) {
    return this.clinics.saveDoctorProfile(u.id, dto);
  }
  @Get(":id") one(@CurrentUser() u: User, @Param("id", uuid) id: string) {
    return this.clinics.getMine(u.id, id);
  }
  @Patch(":id") update(
    @CurrentUser() u: User,
    @Param("id", uuid) id: string,
    @Body() dto: ClinicProfileDto,
  ) {
    return this.clinics.update(u.id, id, dto);
  }
  @Get(":id/staff") staff(
    @CurrentUser() u: User,
    @Param("id", uuid) id: string,
  ) {
    return this.clinics.listStaff(u.id, id);
  }
  @Post(":id/staff") assign(
    @CurrentUser() u: User,
    @Param("id", uuid) id: string,
    @Body() dto: AssignClinicStaffDto,
  ) {
    return this.clinics.assignStaff(u.id, id, dto);
  }
  @Delete(":id/staff/:userId") deactivate(
    @CurrentUser() u: User,
    @Param("id", uuid) id: string,
    @Param("userId", uuid) staffUserId: string,
  ) {
    return this.clinics.deactivateStaff(u.id, id, staffUserId);
  }
  @Post(":id/patients/lookup") lookup(
    @CurrentUser() u: User,
    @Param("id", uuid) id: string,
    @Body() dto: PatientLookupDto,
  ) {
    return this.rx.lookupPatient(u.id, id, dto.contact);
  }
  @Get(":id/catalog") catalog(
    @CurrentUser() u: User,
    @Param("id", uuid) id: string,
    @Query("q") q = "",
  ) {
    return this.rx.searchCatalog(u.id, id, q);
  }
  @Get(":id/prescriptions") prescriptions(
    @CurrentUser() u: User,
    @Param("id", uuid) id: string,
  ) {
    return this.rx.clinicPrescriptions(u.id, id);
  }
  @Post(":id/prescriptions") issue(
    @CurrentUser() u: User,
    @Param("id", uuid) id: string,
    @Body() dto: IssuePrescriptionDto,
  ) {
    return this.rx.issue(u.id, id, dto);
  }
  @Get(":id/prescriptions/:rxId") prescription(
    @CurrentUser() u: User,
    @Param("id", uuid) id: string,
    @Param("rxId", uuid) rxId: string,
  ) {
    return this.rx.clinicPrescription(u.id, id, rxId);
  }
  @Post(":id/prescriptions/:rxId/cancel") cancel(
    @CurrentUser() u: User,
    @Param("id", uuid) id: string,
    @Param("rxId", uuid) rxId: string,
    @Body() dto: CancelPrescriptionDto,
  ) {
    return this.rx.cancel(u.id, id, rxId, dto.reason);
  }
}

@ApiTags("E-prescriptions")
@Controller("e-prescriptions")
export class EPrescriptionsController {
  constructor(private readonly rx: EPrescriptionsService) {}

  /** Behind the QR code. Signed-in staff and the patient see more. */
  @UseGuards(OptionalJwtAuthGuard)
  @Get("verify/:code")
  verify(
    @CurrentUser() u: User | undefined,
    @Param("code") code: string,
    @Query("t") token?: string,
  ) {
    return this.rx.verify(code, token, u ? { id: u.id } : undefined);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get("mine")
  mine(@CurrentUser() u: User) {
    return this.rx.patientPrescriptions(u.id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post(":id/send")
  send(
    @CurrentUser() u: User,
    @Param("id", uuid) id: string,
    @Body() dto: SendPrescriptionDto,
  ) {
    return this.rx.sendToPharmacy(u.id, id, dto.pharmacyId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get(":id/order-draft")
  draft(
    @CurrentUser() u: User,
    @Param("id", uuid) id: string,
    @Query("pharmacyId", uuid) pharmacyId: string,
  ) {
    return this.rx.orderDraft(u.id, id, pharmacyId);
  }
}

@ApiTags("E-prescriptions")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("pharmacy-dashboard/:pharmacyId/e-prescriptions")
export class PharmacyPrescriptionsController {
  constructor(private readonly rx: EPrescriptionsService) {}

  @Get() queue(
    @CurrentUser() u: User,
    @Param("pharmacyId", uuid) pharmacyId: string,
  ) {
    return this.rx.pharmacyQueue(u.id, pharmacyId);
  }
  @Post("lookup") lookup(
    @CurrentUser() u: User,
    @Param("pharmacyId", uuid) pharmacyId: string,
    @Body() dto: PrescriptionCodeDto,
  ) {
    return this.rx.pharmacyLookup(u.id, pharmacyId, dto.code);
  }
  @Patch(":rxId/status") status(
    @CurrentUser() u: User,
    @Param("pharmacyId", uuid) pharmacyId: string,
    @Param("rxId", uuid) rxId: string,
    @Body() dto: CounterStatusDto,
  ) {
    return this.rx.setCounterStatus(u.id, pharmacyId, rxId, dto.status);
  }
  @Post(":rxId/return") giveBack(
    @CurrentUser() u: User,
    @Param("pharmacyId", uuid) pharmacyId: string,
    @Param("rxId", uuid) rxId: string,
    @Body() body: { reason?: string },
  ) {
    return this.rx.returnToPatient(
      u.id,
      pharmacyId,
      rxId,
      typeof body?.reason === "string" ? body.reason.slice(0, 300) : undefined,
    );
  }
  @Post(":rxId/dispense") dispense(
    @CurrentUser() u: User,
    @Param("pharmacyId", uuid) pharmacyId: string,
    @Param("rxId", uuid) rxId: string,
  ) {
    return this.rx.dispense(u.id, pharmacyId, rxId);
  }
}

@ApiTags("Clinics")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller("admin/clinics")
export class AdminClinicsController {
  constructor(private readonly clinics: ClinicsService) {}
  @Get() applications() {
    return this.clinics.clinicApplications();
  }
  @Get("doctors") doctors() {
    return this.clinics.doctorApplications();
  }
  @Patch("doctors/:id/verification") verifyDoctor(
    @CurrentUser() u: User,
    @Param("id", uuid) id: string,
    @Body() dto: DoctorVerificationDto,
  ) {
    return this.clinics.verifyDoctor(u.id, id, dto);
  }
  @Patch(":id/verification") verify(
    @CurrentUser() u: User,
    @Param("id", uuid) id: string,
    @Body() dto: ClinicVerificationDto,
  ) {
    return this.clinics.verifyClinic(u.id, id, dto);
  }
}
