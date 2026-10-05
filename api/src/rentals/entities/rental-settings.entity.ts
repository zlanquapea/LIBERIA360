import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from "typeorm";
import { User } from "../../users/entities/user.entity";

/** How a car owner takes payment, across every car they list. */
@Entity("rental_settings")
export class RentalSettings {
  @PrimaryColumn({ name: "owner_user_id", type: "uuid" })
  ownerUserId: string;

  @OneToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "owner_user_id" })
  owner: User;

  // Cash when the renter collects the car.
  @Column({ name: "cash_at_pickup_enabled", default: true })
  cashAtPickupEnabled: boolean;

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

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
