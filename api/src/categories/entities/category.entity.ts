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
 * Interest category used for browsing/filtering (beaches, waterfalls, hiking,
 * culture, food, nightlife, ...). See Technical Specification §3.1, §10.
 */
@Entity("categories")
export class Category {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar", length: 100 })
  name: string;

  @Column({ type: "varchar", length: 100, unique: true })
  slug: string;

  @Column({ type: "text", nullable: true })
  description: string | null;

  @Column({ type: "varchar", length: 50, nullable: true })
  icon: string | null;

  @OneToMany(() => Place, (place) => place.category)
  places: Place[];

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
