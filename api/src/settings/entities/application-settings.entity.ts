import { Column, Entity, PrimaryColumn, UpdateDateColumn } from "typeorm";

/** Settings > Application (Tech Spec's Settings section) — the
 * moderation/alerting thresholds that used to be hardcoded constants
 * scattered across AdminService and LoginActivityService, editable by a
 * super admin without a deploy. A true singleton: exactly one row,
 * always id=1 (SettingsService.getApplicationSettings creates it with
 * the same defaults the old constants used, the first time anything
 * reads it, so behavior is unchanged until an admin actually edits
 * something). Not a generic key-value store — the fields are known and
 * few enough that explicit typed columns are simpler and safer than a
 * JSON blob a caller could put anything into. */
@Entity("application_settings")
export class ApplicationSettings {
  @PrimaryColumn({ type: "int" })
  id: number;

  // Was AdminService's FRESHNESS_FLAG_THRESHOLD / FRESHNESS_WINDOW_DAYS —
  // how many independent "no longer here" reports in how many days before
  // a place surfaces in the moderation queue as possibly closed.
  @Column({ name: "freshness_flag_threshold", type: "int", default: 3 })
  freshnessFlagThreshold: number;

  @Column({ name: "freshness_window_days", type: "int", default: 90 })
  freshnessWindowDays: number;

  // Was REPORT_FLAG_THRESHOLD / REPORT_WINDOW_DAYS — how many independent
  // content reports against the same review/event/business before it
  // surfaces as flagged content.
  @Column({ name: "report_flag_threshold", type: "int", default: 3 })
  reportFlagThreshold: number;

  @Column({ name: "report_window_days", type: "int", default: 90 })
  reportWindowDays: number;

  // Was LoginActivityService's FAILED_LOGIN_ALERT_THRESHOLD_1H/_24H — how
  // many failed logins in the window before every super admin gets a
  // proactive email (see MailService.sendFailedLoginAlert).
  @Column({ name: "failed_login_alert_threshold_1h", type: "int", default: 5 })
  failedLoginAlertThreshold1h: number;

  @Column({
    name: "failed_login_alert_threshold_24h",
    type: "int",
    default: 20,
  })
  failedLoginAlertThreshold24h: number;

  @Column({ name: "updated_by_user_id", type: "uuid", nullable: true })
  updatedByUserId: string | null;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
