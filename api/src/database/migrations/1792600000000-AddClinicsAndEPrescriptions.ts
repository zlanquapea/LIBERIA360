import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Partner clinics, their staff, verified doctor profiles, and
 * e-prescriptions (with their medicines) that a pharmacy fills once, plus a
 * link from a pharmacy order to the e-prescription it was placed with.
 */
export class AddClinicsAndEPrescriptions1792600000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(
      `CREATE TYPE clinic_status AS ENUM ('pending', 'approved', 'rejected', 'suspended')`,
    );
    await q.query(
      `CREATE TYPE clinic_staff_role AS ENUM ('admin', 'doctor', 'front_desk')`,
    );
    await q.query(
      `CREATE TYPE doctor_verification_status AS ENUM ('pending', 'verified', 'rejected')`,
    );
    await q.query(
      `CREATE TYPE e_prescription_status AS ENUM ('issued', 'sent', 'preparing', 'ready', 'ordered', 'dispensed', 'cancelled')`,
    );
    await q.query(`
      CREATE TABLE clinics (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        name varchar(160) NOT NULL,
        slug varchar(180) NOT NULL UNIQUE,
        address varchar(240) NOT NULL,
        location varchar(80) NOT NULL DEFAULT 'Monrovia',
        telephone varchar(40) NOT NULL,
        about text,
        logo_url varchar(500),
        cover_url varchar(500),
        licence_number varchar(120),
        status clinic_status NOT NULL DEFAULT 'pending',
        status_notes text,
        pharmacy_id uuid REFERENCES pharmacies(id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await q.query(`CREATE INDEX clinics_name_idx ON clinics (name)`);
    await q.query(`
      CREATE TABLE clinic_staff (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role clinic_staff_role NOT NULL,
        active boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT clinic_staff_clinic_user_uq UNIQUE (clinic_id, user_id)
      )
    `);
    await q.query(
      `CREATE INDEX clinic_staff_user_idx ON clinic_staff (user_id)`,
    );
    await q.query(`
      CREATE TABLE doctor_profiles (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        full_name varchar(150) NOT NULL,
        specialty varchar(120) NOT NULL DEFAULT 'General practice',
        licence_number varchar(80) NOT NULL,
        bio text,
        photo_url varchar(500),
        verification_status doctor_verification_status NOT NULL DEFAULT 'pending',
        verification_notes text,
        verified_at timestamptz,
        verified_by_user_id uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await q.query(`
      CREATE TABLE e_prescriptions (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        code varchar(12) NOT NULL UNIQUE,
        verify_token varchar(64) NOT NULL,
        clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
        doctor_profile_id uuid NOT NULL REFERENCES doctor_profiles(id) ON DELETE CASCADE,
        doctor_user_id uuid NOT NULL,
        patient_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
        patient_name varchar(150) NOT NULL,
        patient_phone varchar(40),
        patient_age smallint,
        notes_for_pharmacist text,
        status e_prescription_status NOT NULL DEFAULT 'issued',
        pharmacy_id uuid REFERENCES pharmacies(id) ON DELETE SET NULL,
        pharmacy_order_id uuid REFERENCES pharmacy_orders(id) ON DELETE SET NULL,
        dispensed_at timestamptz,
        dispensed_by_user_id uuid,
        cancelled_reason text,
        expires_at timestamptz NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await q.query(
      `CREATE INDEX e_prescriptions_clinic_idx ON e_prescriptions (clinic_id)`,
    );
    await q.query(
      `CREATE INDEX e_prescriptions_doctor_idx ON e_prescriptions (doctor_user_id)`,
    );
    await q.query(
      `CREATE INDEX e_prescriptions_patient_idx ON e_prescriptions (patient_user_id)`,
    );
    await q.query(
      `CREATE INDEX e_prescriptions_pharmacy_idx ON e_prescriptions (pharmacy_id)`,
    );
    await q.query(`
      CREATE TABLE e_prescription_items (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        prescription_id uuid NOT NULL REFERENCES e_prescriptions(id) ON DELETE CASCADE,
        position smallint NOT NULL DEFAULT 0,
        medicine varchar(180) NOT NULL,
        strength varchar(60),
        dosage varchar(160) NOT NULL,
        duration_days smallint,
        quantity int NOT NULL CHECK (quantity > 0),
        instructions varchar(300),
        product_id uuid REFERENCES pharmacy_products(id) ON DELETE SET NULL
      )
    `);
    await q.query(
      `CREATE INDEX e_prescription_items_prescription_idx ON e_prescription_items (prescription_id)`,
    );
    await q.query(`
      ALTER TABLE pharmacy_orders
        ADD COLUMN e_prescription_id uuid REFERENCES e_prescriptions(id) ON DELETE SET NULL
    `);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE pharmacy_orders DROP COLUMN e_prescription_id`);
    await q.query(`DROP TABLE e_prescription_items`);
    await q.query(`DROP TABLE e_prescriptions`);
    await q.query(`DROP TABLE doctor_profiles`);
    await q.query(`DROP TABLE clinic_staff`);
    await q.query(`DROP TABLE clinics`);
    await q.query(`DROP TYPE e_prescription_status`);
    await q.query(`DROP TYPE doctor_verification_status`);
    await q.query(`DROP TYPE clinic_staff_role`);
    await q.query(`DROP TYPE clinic_status`);
  }
}
