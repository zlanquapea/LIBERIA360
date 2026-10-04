import { Column, Entity, Index, PrimaryColumn } from "typeorm";
@Entity("saved_collections")
@Index(["userId"])
export class SavedCollection {
  @PrimaryColumn("uuid") id: string;
  @Column({ name: "user_id", type: "uuid" }) userId: string;
  @Column({ type: "varchar", length: 80 }) name: string;
  @Column({ type: "jsonb", default: () => "'[]'::jsonb" }) items: {
    title: string;
    path: string;
  }[];
  @Column({ type: "integer", default: 1 }) version: number;
  @Column({ name: "share_token", type: "uuid", nullable: true, unique: true })
  shareToken: string | null;
}
