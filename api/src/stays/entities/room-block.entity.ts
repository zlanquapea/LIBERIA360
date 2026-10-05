import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { RoomType } from "./room-type.entity";

/**
 * Rooms the property takes off sale for some nights: repairs, a private
 * event, rooms sold elsewhere. Covers the nights from startDate up to and
 * including endDate.
 */
@Entity("room_blocks")
@Index(["roomTypeId", "startDate"])
export class RoomBlock {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => RoomType, { onDelete: "CASCADE" })
  @JoinColumn({ name: "room_type_id" })
  roomType: RoomType;

  @Column({ name: "room_type_id" })
  roomTypeId: string;

  @Column({ name: "start_date", type: "date" })
  startDate: string;

  @Column({ name: "end_date", type: "date" })
  endDate: string;

  @Column({ type: "smallint", default: 1 })
  rooms: number;

  @Column({ type: "varchar", length: 200, nullable: true })
  reason: string | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;
}
