import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { Place } from "../../places/entities/place.entity";

/**
 * One of Liberia's 15 counties. `rolloutStage` mirrors the geographic
 * rollout plan in Business Plan §9.1 (1 = Greater Monrovia, ... 4 = full
 * national coverage) — used to gate which counties are "live" in the
 * catalog vs. planned for a later stage.
 */
@Entity("counties")
export class County {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar", length: 100 })
  name: string;

  @Column({ type: "varchar", length: 100, unique: true })
  slug: string;

  @Column({ name: "rollout_stage", type: "smallint" })
  rolloutStage: number;

  // A single symbol representing what the county is locally known for —
  // same pattern as Category.icon, one level up. Editorial, not derived
  // from anything in the schema; set by hand in seed-data.ts.
  @Column({ type: "varchar", length: 50, nullable: true })
  icon: string | null;

  // Safety & practical-info panel, for the international-visitor/diaspora
  // audience specifically — null unless an admin has actually verified and
  // set it (see PATCH /admin/counties/:id). Deliberately null rather than
  // a guessed default: a wrong emergency number is worse than no number at
  // all, so this is admin-entered content, not something computed or
  // assumed at seed time.
  @Column({
    name: "emergency_number",
    type: "varchar",
    length: 100,
    nullable: true,
  })
  emergencyNumber: string | null;

  @Column({
    name: "safety_tips",
    type: "text",
    array: true,
    default: () => "'{}'",
  })
  safetyTips: string[];

  @Column({ name: "local_customs", type: "text", nullable: true })
  localCustoms: string | null;

  @OneToMany(() => Place, (place) => place.county)
  places: Place[];

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
