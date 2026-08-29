import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";

export enum AssistantFeedbackType {
  HELPFUL = "helpful",
  NOT_HELPFUL = "not_helpful",
  INCORRECT = "incorrect",
  UNANSWERED = "unanswered",
}

@Entity("assistant_feedback")
@Index(["type", "createdAt"])
@Index(["question"])
export class AssistantFeedback {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "enum", enum: AssistantFeedbackType })
  type: AssistantFeedbackType;

  @Column({ type: "varchar", length: 600 })
  question: string;

  @Column({ type: "varchar", length: 1600 })
  answer: string;

  @Column({ type: "varchar", length: 32 })
  source: "ai" | "knowledge";

  @Column({
    name: "current_path",
    type: "varchar",
    length: 160,
    nullable: true,
  })
  currentPath: string | null;

  @Column({ type: "varchar", length: 600, nullable: true })
  details: string | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;
}
