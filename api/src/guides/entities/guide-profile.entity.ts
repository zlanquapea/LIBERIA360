import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { County } from "../../counties/entities/county.entity";
import { User } from "../../users/entities/user.entity";
import { GuideType, GuideVerificationStatus } from "./guide.enums";

@Entity("guide_profiles")
export class GuideProfile {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @OneToOne(() => User, { eager: true, onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user: User;

  @Column({ name: "user_id", unique: true })
  userId: string;

  @Column({ name: "guide_type", type: "enum", enum: GuideType })
  guideType: GuideType;

  @Column({ type: "text" })
  bio: string;

  @ManyToOne(() => County, { eager: true, nullable: true })
  @JoinColumn({ name: "county_id" })
  county: County | null;

  @Column({ name: "county_id", nullable: true })
  countyId: string | null;

  @Column({ type: "varchar", length: 120 })
  city: string;

  @Column({ type: "text", array: true, default: () => "'{}'" })
  languages: string[];

  @Column({ name: "verification_status", type: "enum", enum: GuideVerificationStatus, default: GuideVerificationStatus.PENDING })
  verificationStatus: GuideVerificationStatus;

  @Column({ name: "verified_at", type: "timestamptz", nullable: true })
  verifiedAt: Date | null;

  @Column({ name: "verified_by", type: "uuid", nullable: true })
  verifiedBy: string | null;

  @Column({ name: "lta_license_number", type: "varchar", length: 100, nullable: true })
  ltaLicenseNumber: string | null;

  @Column({ name: "verification_document_key", type: "varchar", length: 500, nullable: true })
  verificationDocumentKey: string | null;

  @Column({ name: "whatsapp_number", type: "varchar", length: 40, nullable: true })
  whatsappNumber: string | null;

  @Column({ type: "varchar", length: 180, unique: true })
  slug: string;

  @Column({ name: "profile_image_url", type: "varchar", length: 1000, nullable: true })
  profileImageUrl: string | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
