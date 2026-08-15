import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { County } from "../../counties/entities/county.entity";
import { AuthProvider } from "./user.enums";

/** Phase 2 account (Tech Spec §5 User + §3.2). */
@Entity("users")
export class User {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar", length: 150 })
  name: string;

  @Column({ type: "varchar", length: 255, unique: true })
  email: string;

  // Only the email/password provider is implemented, so this is required in
  // practice; nullable at the DB level so a future OAuth-only account
  // (Google/Apple) doesn't need a fabricated password.
  @Column({
    name: "password_hash",
    type: "varchar",
    length: 255,
    nullable: true,
  })
  passwordHash: string | null;

  @Column({ type: "varchar", length: 40, nullable: true })
  phone: string | null;

  @Column({
    name: "auth_provider",
    type: "enum",
    enum: AuthProvider,
    default: AuthProvider.EMAIL,
  })
  authProvider: AuthProvider;

  @ManyToOne(() => County, { eager: true, nullable: true })
  @JoinColumn({ name: "home_county_id" })
  homeCounty: County | null;

  @Column({ name: "home_county_id", nullable: true })
  homeCountyId: string | null;

  // Minimal admin flag backing the verification-badge workflow (Tech Spec
  // §7/§8). Not a full role system — Phase 2 doesn't need one yet.
  @Column({ name: "is_admin", type: "boolean", default: false })
  isAdmin: boolean;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
