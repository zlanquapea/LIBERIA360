import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { User } from "../../users/entities/user.entity";

/**
 * Creator profile (Tech Spec §5 Creator, §3.2). One per User — `userId` (not
 * in the spec's minimal field list) is the FK needed to make "self-service
 * become a creator" actually work as an account extension rather than a
 * standalone record nobody owns.
 *
 * "places visited" from the spec bullet isn't tracked as a separate join
 * table here — no concrete feature depends on it yet, and it can be added
 * without a breaking change later. `contentLinks` covers the spec's
 * "linked content" (URLs to the creator's videos/posts).
 */
@Entity("creators")
export class Creator {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @OneToOne(() => User, { eager: true, onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user: User;

  @Column({ name: "user_id", unique: true })
  userId: string;

  @Column({ type: "varchar", length: 150 })
  name: string;

  @Column({ type: "varchar", length: 50, unique: true })
  username: string;

  @Column({ type: "text", nullable: true })
  bio: string | null;

  @Column({
    name: "profile_image",
    type: "varchar",
    length: 500,
    nullable: true,
  })
  profileImage: string | null;

  @Column({ type: "varchar", length: 100, nullable: true })
  instagram: string | null;

  @Column({ type: "varchar", length: 100, nullable: true })
  tiktok: string | null;

  @Column({ type: "varchar", length: 100, nullable: true })
  youtube: string | null;

  // Self-reported — no social-platform API integration to verify this.
  @Column({ name: "follower_count", type: "int", default: 0 })
  followerCount: number;

  @Column({ type: "text", array: true, default: () => "'{}'" })
  specialties: string[];

  @Column({
    name: "locations_covered",
    type: "text",
    array: true,
    default: () => "'{}'",
  })
  locationsCovered: string[];

  @Column({
    name: "content_links",
    type: "text",
    array: true,
    default: () => "'{}'",
  })
  contentLinks: string[];

  @Column({ type: "boolean", default: false })
  verified: boolean;

  // Phase 3 creator promotion (Tech Spec §3.3) — admin-set, surfaces this
  // creator first in the directory. No self-service "sponsored content"
  // tooling beyond this yet; the spec gives that bullet one line with no
  // further detail to build against.
  @Column({ type: "boolean", default: false })
  featured: boolean;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
