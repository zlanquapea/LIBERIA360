import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/**
 * One of Liberia's 15 counties. `rolloutStage` mirrors the geographic
 * rollout plan in Business Plan §9.1 (1 = Greater Monrovia, ... 4 = full
 * national coverage) — used to gate which counties are "live" in the
 * catalog vs. planned for a later stage.
 */
@Entity('counties')
export class County {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  slug: string;

  @Column({ name: 'rollout_stage', type: 'smallint' })
  rolloutStage: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
