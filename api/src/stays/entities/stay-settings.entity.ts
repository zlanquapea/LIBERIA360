import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from "typeorm";
import { Business } from "../../businesses/entities/business.entity";
import type { StayCurrency } from "./stay.enums";

/** How a property takes bookings: times, money and house rules. */
@Entity("stay_settings")
export class StaySettings {
  @PrimaryColumn({ name: "business_id", type: "uuid" })
  businessId: string;

  @OneToOne(() => Business, { onDelete: "CASCADE" })
  @JoinColumn({ name: "business_id" })
  business: Business;

  @Column({ type: "varchar", length: 3, default: "USD" })
  currency: StayCurrency;

  // "HH:mm"
  @Column({
    name: "check_in_time",
    type: "varchar",
    length: 5,
    default: "14:00",
  })
  checkInTime: string;

  @Column({
    name: "check_out_time",
    type: "varchar",
    length: 5,
    default: "11:00",
  })
  checkOutTime: string;

  // Confirm requests the moment they arrive when there's a room free, as
  // long as there's no mobile money payment to check first.
  @Column({ name: "instant_confirm", default: false })
  instantConfirm: boolean;

  // Pay at the front desk on arrival.
  @Column({ name: "pay_at_property_enabled", default: true })
  payAtPropertyEnabled: boolean;

  // A mobile money method is offered exactly when its number is set.
  @Column({
    name: "mtn_momo_number",
    type: "varchar",
    length: 40,
    nullable: true,
  })
  mtnMomoNumber: string | null;

  @Column({
    name: "orange_money_number",
    type: "varchar",
    length: 40,
    nullable: true,
  })
  orangeMoneyNumber: string | null;

  @Column({
    name: "mobile_money_account_name",
    type: "varchar",
    length: 120,
    nullable: true,
  })
  mobileMoneyAccountName: string | null;

  @Column({ name: "cancellation_policy", type: "text", nullable: true })
  cancellationPolicy: string | null;

  @Column({ name: "house_rules", type: "text", nullable: true })
  houseRules: string | null;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
