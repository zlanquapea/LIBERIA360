import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Pharmacy ordering at restaurant quality: which payment methods a pharmacy
 * takes (cash, MTN MoMo, Orange Money, with its merchant numbers), the
 * payment method/state on each order, a contact phone and note, and an
 * order chat between the customer and the pharmacy's staff.
 */
export class AddPharmacyPaymentsAndChat1792500000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      ALTER TABLE pharmacies
        ADD COLUMN accepts_cash boolean NOT NULL DEFAULT true,
        ADD COLUMN mtn_momo_number varchar(40),
        ADD COLUMN orange_money_number varchar(40),
        ADD COLUMN payment_note varchar(300)
    `);
    await q.query(
      `CREATE TYPE pharmacy_order_payment_method AS ENUM ('cash', 'mtn_momo', 'orange_money')`,
    );
    await q.query(
      `CREATE TYPE pharmacy_order_payment_status AS ENUM ('pay_on_collection', 'awaiting_payment', 'awaiting_verification', 'paid', 'failed', 'refund_due', 'refunded')`,
    );
    await q.query(`
      ALTER TABLE pharmacy_orders
        ADD COLUMN payment_method pharmacy_order_payment_method NOT NULL DEFAULT 'cash',
        ADD COLUMN payment_status pharmacy_order_payment_status NOT NULL DEFAULT 'pay_on_collection',
        ADD COLUMN payment_reference varchar(80),
        ADD COLUMN payment_account varchar(40),
        ADD COLUMN contact_phone varchar(40),
        ADD COLUMN customer_note varchar(500)
    `);
    // A mobile money transaction ID can only pay for one order, per method.
    await q.query(
      `CREATE UNIQUE INDEX pharmacy_orders_payment_reference_uq ON pharmacy_orders (payment_method, payment_reference) WHERE payment_reference IS NOT NULL`,
    );
    await q.query(`
      CREATE TABLE pharmacy_order_messages (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        order_id uuid NOT NULL REFERENCES pharmacy_orders(id) ON DELETE CASCADE,
        sender_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        from_pharmacy boolean NOT NULL DEFAULT false,
        body text NOT NULL,
        read_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await q.query(
      `CREATE INDEX pharmacy_order_messages_order_idx ON pharmacy_order_messages (order_id, created_at)`,
    );
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE pharmacy_order_messages`);
    await q.query(`DROP INDEX pharmacy_orders_payment_reference_uq`);
    await q.query(`
      ALTER TABLE pharmacy_orders
        DROP COLUMN payment_method,
        DROP COLUMN payment_status,
        DROP COLUMN payment_reference,
        DROP COLUMN payment_account,
        DROP COLUMN contact_phone,
        DROP COLUMN customer_note
    `);
    await q.query(`DROP TYPE pharmacy_order_payment_status`);
    await q.query(`DROP TYPE pharmacy_order_payment_method`);
    await q.query(`
      ALTER TABLE pharmacies
        DROP COLUMN accepts_cash,
        DROP COLUMN mtn_momo_number,
        DROP COLUMN orange_money_number,
        DROP COLUMN payment_note
    `);
  }
}
