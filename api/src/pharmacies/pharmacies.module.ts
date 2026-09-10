import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { StorageModule } from "../uploads/storage/storage.module";
import { UsersModule } from "../users/users.module";
import {
  AdminPharmaciesController,
  PharmaciesController,
  PharmacyCustomerController,
  PharmacyDashboardController,
} from "./pharmacies.controller";
import {
  Pharmacy,
  PharmacyOpeningHours,
  PharmacyStaff,
  PharmacyVerification,
} from "./entities/pharmacy.entity";
import {
  PharmacyInventory,
  PharmacyProduct,
  PharmacyProductCategory,
} from "./entities/product.entity";
import {
  CustomerAddress,
  PharmacyAuditLog,
  PharmacyCart,
  PharmacyCartItem,
  PharmacyDelivery,
  PharmacyOrder,
  PharmacyOrderItem,
  PharmacyPayment,
  PharmacyReport,
  Prescription,
  PrescriptionReview,
} from "./entities/order.entity";
import { PharmaciesService } from "./pharmacies.service";

export const PHARMACY_ENTITIES = [
  Pharmacy,
  PharmacyStaff,
  PharmacyOpeningHours,
  PharmacyVerification,
  PharmacyProductCategory,
  PharmacyProduct,
  PharmacyInventory,
  CustomerAddress,
  PharmacyCart,
  PharmacyCartItem,
  PharmacyOrder,
  PharmacyOrderItem,
  Prescription,
  PrescriptionReview,
  PharmacyPayment,
  PharmacyDelivery,
  PharmacyAuditLog,
  PharmacyReport,
];
@Module({
  imports: [
    TypeOrmModule.forFeature(PHARMACY_ENTITIES),
    StorageModule,
    UsersModule,
  ],
  controllers: [
    PharmaciesController,
    PharmacyCustomerController,
    PharmacyDashboardController,
    AdminPharmaciesController,
  ],
  providers: [PharmaciesService],
  exports: [PharmaciesService],
})
export class PharmaciesModule {}
