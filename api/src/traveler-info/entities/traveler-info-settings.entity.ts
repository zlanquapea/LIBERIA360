import { Column, Entity, PrimaryColumn, UpdateDateColumn } from "typeorm";
import { decimalTransformer } from "../../database/decimal.transformer";

/** A true singleton (always id=1, same materialize-on-first-read
 * convention as ApplicationSettings) for the practical, public-facing
 * traveler content a plain catalog directory doesn't have: currency,
 * visa/entry requirements, and a season note. Kept as its own small
 * entity/module rather than folded into SettingsService — that service's
 * existing fields are all security/moderation thresholds, edited by a
 * super admin; this is public-read content, edited by any admin, same
 * "admin-owned, never guessed, renders nothing if unset" posture as
 * County.emergencyNumber/safetyTips/localCustoms. */
@Entity("traveler_info_settings")
export class TravelerInfoSettings {
  @PrimaryColumn({ type: "int" })
  id: number;

  // USD is this platform's own pricing currency throughout (see
  // formatCost on the frontend) — this is for the OTHER direction, a
  // visitor converting USD to Liberian dollars. Null until an admin sets
  // it; the currency converter shows "not available yet" rather than a
  // guessed or stale rate.
  @Column({
    name: "usd_to_lrd_rate",
    type: "numeric",
    precision: 10,
    scale: 4,
    nullable: true,
    transformer: decimalTransformer,
  })
  usdToLrdRate: number | null;

  @Column({ name: "visa_info", type: "text", nullable: true })
  visaInfo: string | null;

  @Column({ name: "entry_requirements", type: "text", nullable: true })
  entryRequirements: string | null;

  // A live weather API integration was considered and deliberately
  // dropped (see plan doc) — this admin-edited note (e.g. "Rainy season,
  // May-Oct: expect afternoon downpours...") is the honest, no-external-
  // dependency stand-in, updated by an admin a couple of times a year.
  @Column({ name: "current_season_note", type: "text", nullable: true })
  currentSeasonNote: string | null;

  @Column({ name: "updated_by_user_id", type: "uuid", nullable: true })
  updatedByUserId: string | null;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
