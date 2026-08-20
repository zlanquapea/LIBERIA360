import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Creator } from "./creator.entity";
import { CreatorPortfolioItemType } from "./creator.enums";

/**
 * One item in a creator's portfolio gallery — see CreatorPortfolioItemType's
 * doc comment for why image and video are handled differently (uploaded
 * file vs. external link). `url` holds whichever applies; `type` says which.
 */
@Entity("creator_portfolio_items")
export class CreatorPortfolioItem {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => Creator, { onDelete: "CASCADE" })
  @JoinColumn({ name: "creator_id" })
  creator: Creator;

  @Index()
  @Column({ name: "creator_id" })
  creatorId: string;

  @Column({ type: "enum", enum: CreatorPortfolioItemType })
  type: CreatorPortfolioItemType;

  @Column({ type: "varchar", length: 500 })
  url: string;

  @Column({ type: "varchar", length: 200, nullable: true })
  caption: string | null;

  // Freeform tag for the gallery's filter chips (e.g. "Weddings",
  // "Nature") — same freeform-not-enum choice as Creator.specialties,
  // since portfolio categories vary too much by creator type (a
  // photographer's shoot types vs. a chef's dish types) for one fixed
  // list to fit everyone.
  @Column({ type: "varchar", length: 60, nullable: true })
  category: string | null;

  @Column({ name: "sort_order", type: "int", default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;
}
