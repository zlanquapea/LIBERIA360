import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Online consultations: a doctor's consult fee and the clinic patients pay,
 * the clinic's mobile money numbers, and paid consultations with their
 * text and voice messages.
 */
export class AddOnlineConsultations1793100000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      ALTER TABLE clinics
        ADD COLUMN mtn_momo_number varchar(40),
        ADD COLUMN orange_money_number varchar(40)
    `);
    await q.query(`
      ALTER TABLE doctor_profiles
        ADD COLUMN consult_fee decimal(10,2),
        ADD COLUMN consult_clinic_id uuid REFERENCES clinics(id) ON DELETE SET NULL,
        ADD COLUMN available_now boolean NOT NULL DEFAULT false
    `);
    await q.query(
      `CREATE TYPE consultation_status AS ENUM ('requested', 'active', 'completed', 'declined', 'cancelled')`,
    );
    await q.query(
      `CREATE TYPE consultation_payment_method AS ENUM ('mtn_momo', 'orange_money')`,
    );
    await q.query(
      `CREATE TYPE consultation_payment_status AS ENUM ('awaiting_verification', 'paid', 'failed', 'refund_due', 'refunded')`,
    );
    await q.query(
      `CREATE TYPE consultation_outcome AS ENUM ('advice', 'prescription', 'visit_clinic', 'emergency')`,
    );
    await q.query(`
      CREATE TABLE consultations (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
        doctor_profile_id uuid NOT NULL REFERENCES doctor_profiles(id) ON DELETE CASCADE,
        doctor_user_id uuid NOT NULL,
        patient_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        patient_name varchar(150) NOT NULL,
        patient_age smallint,
        reason text NOT NULL,
        symptoms_since varchar(60),
        triage_confirmed_at timestamptz NOT NULL,
        status consultation_status NOT NULL DEFAULT 'requested',
        fee decimal(10,2) NOT NULL,
        payment_method consultation_payment_method NOT NULL,
        payment_reference varchar(80) NOT NULL,
        payment_account varchar(40),
        payment_status consultation_payment_status NOT NULL DEFAULT 'awaiting_verification',
        accepted_at timestamptz,
        completed_at timestamptz,
        outcome consultation_outcome,
        summary text,
        decline_reason text,
        e_prescription_id uuid REFERENCES e_prescriptions(id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await q.query(
      `CREATE INDEX consultations_doctor_idx ON consultations (doctor_user_id, created_at)`,
    );
    await q.query(
      `CREATE INDEX consultations_patient_idx ON consultations (patient_user_id, created_at)`,
    );
    // A mobile money transaction ID pays for one consultation only.
    await q.query(
      `CREATE UNIQUE INDEX consultations_payment_reference_uq ON consultations (payment_method, payment_reference)`,
    );
    await q.query(`
      CREATE TABLE consultation_messages (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        consultation_id uuid NOT NULL REFERENCES consultations(id) ON DELETE CASCADE,
        sender_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        from_doctor boolean NOT NULL DEFAULT false,
        body text,
        voice_key text,
        voice_mime varchar(60),
        voice_seconds smallint,
        read_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT consultation_messages_content_chk CHECK (body IS NOT NULL OR voice_key IS NOT NULL)
      )
    `);
    await q.query(
      `CREATE INDEX consultation_messages_consultation_idx ON consultation_messages (consultation_id, created_at)`,
    );
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE consultation_messages`);
    await q.query(`DROP TABLE consultations`);
    await q.query(`DROP TYPE consultation_outcome`);
    await q.query(`DROP TYPE consultation_payment_status`);
    await q.query(`DROP TYPE consultation_payment_method`);
    await q.query(`DROP TYPE consultation_status`);
    await q.query(`
      ALTER TABLE doctor_profiles
        DROP COLUMN available_now,
        DROP COLUMN consult_clinic_id,
        DROP COLUMN consult_fee
    `);
    await q.query(`
      ALTER TABLE clinics
        DROP COLUMN orange_money_number,
        DROP COLUMN mtn_momo_number
    `);
  }
}
