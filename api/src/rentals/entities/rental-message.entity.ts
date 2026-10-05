import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { User } from "../../users/entities/user.entity";
import { CarRental } from "./car-rental.entity";

/** The renter and the car owner talking about one rental. */
@Entity("rental_messages")
export class RentalMessage {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => CarRental, { onDelete: "CASCADE" })
  @JoinColumn({ name: "rental_id" })
  rental: CarRental;

  @Index()
  @Column({ name: "rental_id" })
  rentalId: string;

  @ManyToOne(() => User, { eager: true, onDelete: "CASCADE" })
  @JoinColumn({ name: "sender_user_id" })
  sender: User;

  @Column({ name: "sender_user_id" })
  senderUserId: string;

  @Column({ type: "text" })
  body: string;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @Column({ name: "read_at", type: "timestamptz", nullable: true })
  readAt: Date | null;
}
