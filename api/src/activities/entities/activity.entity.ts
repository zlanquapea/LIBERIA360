import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { Place } from "../../places/entities/place.entity";
import { decimalTransformer } from "../../database/decimal.transformer";
import { ActivityDifficulty } from "./activity.enums";

/** A bookable/requestable thing to do at a Place (Tech Spec §5). */
@Entity("activities")
export class Activity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => Place, (place) => place.activities, { onDelete: "CASCADE" })
  @JoinColumn({ name: "place_id" })
  place: Place;

  @Index()
  @Column({ name: "place_id" })
  placeId: string;

  @Column({ type: "varchar", length: 200 })
  name: string;

  @Column({ type: "text", nullable: true })
  description: string | null;

  @Column({ type: "varchar", length: 100, nullable: true })
  duration: string | null;

  @Column({
    type: "decimal",
    precision: 10,
    scale: 2,
    nullable: true,
    transformer: decimalTransformer,
  })
  price: number | null;

  @Column({ type: "enum", enum: ActivityDifficulty, nullable: true })
  difficulty: ActivityDifficulty | null;

  @Column({ name: "age_range", type: "varchar", length: 50, nullable: true })
  ageRange: string | null;

  @Column({ name: "guide_required", type: "boolean", default: false })
  guideRequired: boolean;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
