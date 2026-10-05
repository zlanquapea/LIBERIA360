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
import { RoomReservation } from "./room-reservation.entity";

/** The guest and the front desk talking about one stay. */
@Entity("reservation_messages")
export class ReservationMessage {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => RoomReservation, { onDelete: "CASCADE" })
  @JoinColumn({ name: "reservation_id" })
  reservation: RoomReservation;

  @Index()
  @Column({ name: "reservation_id" })
  reservationId: string;

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
