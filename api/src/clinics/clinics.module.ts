import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { NotificationsModule } from "../notifications/notifications.module";
import {
  Pharmacy,
  PharmacyStaff,
} from "../pharmacies/entities/pharmacy.entity";
import {
  PharmacyInventory,
  PharmacyProduct,
} from "../pharmacies/entities/product.entity";
import { User } from "../users/entities/user.entity";
import { UsersModule } from "../users/users.module";
import {
  AdminClinicsController,
  ClinicDashboardController,
  ClinicsController,
  EPrescriptionsController,
  PharmacyPrescriptionsController,
} from "./clinics.controller";
import { ClinicsService } from "./clinics.service";
import { EPrescriptionsService } from "./e-prescriptions.service";
import { Clinic, ClinicStaff, DoctorProfile } from "./entities/clinic.entity";
import {
  EPrescription,
  EPrescriptionItem,
} from "./entities/e-prescription.entity";

export const CLINIC_ENTITIES = [
  Clinic,
  ClinicStaff,
  DoctorProfile,
  EPrescription,
  EPrescriptionItem,
];

/**
 * Partner clinics, their verified doctors, and e-prescriptions with a QR
 * code that any pharmacy can check and fill once.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      ...CLINIC_ENTITIES,
      Pharmacy,
      PharmacyStaff,
      PharmacyProduct,
      PharmacyInventory,
      User,
    ]),
    UsersModule,
    NotificationsModule,
  ],
  controllers: [
    ClinicsController,
    ClinicDashboardController,
    EPrescriptionsController,
    PharmacyPrescriptionsController,
    AdminClinicsController,
  ],
  providers: [ClinicsService, EPrescriptionsService],
  exports: [EPrescriptionsService],
})
export class ClinicsModule {}
