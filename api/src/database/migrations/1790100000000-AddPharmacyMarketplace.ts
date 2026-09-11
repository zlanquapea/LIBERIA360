import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPharmacyMarketplace1790100000000 implements MigrationInterface {
  name = "AddPharmacyMarketplace1790100000000";
  public async up(q: QueryRunner): Promise<void> {
    await q.query(
      `CREATE TYPE "pharmacy_status_enum" AS ENUM ('pending','approved','rejected','suspended'); CREATE TYPE "pharmacy_staff_role_enum" AS ENUM ('manager','pharmacist','employee'); CREATE TYPE "pharmacy_order_status_enum" AS ENUM ('pending','under_review','accepted','preparing','ready_for_pickup','out_for_delivery','completed','rejected','cancelled'); CREATE TYPE "fulfillment_method_enum" AS ENUM ('pickup','delivery'); CREATE TYPE "prescription_decision_enum" AS ENUM ('accepted','rejected','clarification_requested'); CREATE TYPE "pharmacy_payment_status_enum" AS ENUM ('pending','authorized','paid','failed','refunded')`,
    );
    await q.query(
      `CREATE TABLE "pharmacies" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),"name" varchar(160) NOT NULL,"slug" varchar(180) UNIQUE NOT NULL,"address" varchar(240) NOT NULL,"location" varchar(80) NOT NULL DEFAULT 'Monrovia',"telephone" varchar(40) NOT NULL,"logo_url" varchar(500),"cover_url" varchar(500),"latitude" decimal(9,6),"longitude" decimal(9,6),"pickup_enabled" boolean NOT NULL DEFAULT true,"delivery_enabled" boolean NOT NULL DEFAULT false,"delivery_fee" decimal(10,2) NOT NULL DEFAULT 0,"status" pharmacy_status_enum NOT NULL DEFAULT 'pending',"licence_number" varchar(100),"licence_document_key" text,"sponsored" boolean NOT NULL DEFAULT false,"created_at" timestamptz NOT NULL DEFAULT now(),"updated_at" timestamptz NOT NULL DEFAULT now()); CREATE INDEX "IDX_pharmacies_name" ON "pharmacies"("name")`,
    );
    await q.query(
      `CREATE TABLE "pharmacy_staff" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),"pharmacy_id" uuid NOT NULL REFERENCES pharmacies(id) ON DELETE CASCADE,"user_id" uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,"role" pharmacy_staff_role_enum NOT NULL DEFAULT 'employee',"active" boolean NOT NULL DEFAULT true,UNIQUE("pharmacy_id","user_id")); CREATE TABLE "pharmacy_opening_hours" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),"pharmacy_id" uuid NOT NULL REFERENCES pharmacies(id) ON DELETE CASCADE,"day_of_week" smallint NOT NULL,"opens_at" time,"closes_at" time,"is_closed" boolean NOT NULL DEFAULT false,UNIQUE("pharmacy_id","day_of_week")); CREATE TABLE "pharmacy_verifications" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),"pharmacy_id" uuid NOT NULL REFERENCES pharmacies(id) ON DELETE CASCADE,"decision" pharmacy_status_enum NOT NULL,"reviewer_user_id" uuid NOT NULL REFERENCES users(id),"notes" text,"created_at" timestamptz NOT NULL DEFAULT now())`,
    );
    await q.query(
      `CREATE TABLE "pharmacy_product_categories" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),"name" varchar(100) UNIQUE NOT NULL,"slug" varchar(100) UNIQUE NOT NULL); CREATE TABLE "pharmacy_products" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),"pharmacy_id" uuid NOT NULL REFERENCES pharmacies(id) ON DELETE CASCADE,"category_id" uuid NOT NULL REFERENCES pharmacy_product_categories(id),"name" varchar(180) NOT NULL,"image_url" varchar(500),"price" decimal(10,2) NOT NULL CHECK(price>=0),"prescription_required" boolean NOT NULL DEFAULT false,"is_visible" boolean NOT NULL DEFAULT true,"created_at" timestamptz NOT NULL DEFAULT now(),"updated_at" timestamptz NOT NULL DEFAULT now()); CREATE INDEX "IDX_pharmacy_products_tenant_name" ON pharmacy_products(pharmacy_id,name); CREATE TABLE "pharmacy_inventory" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),"product_id" uuid UNIQUE NOT NULL REFERENCES pharmacy_products(id) ON DELETE CASCADE,"quantity" integer NOT NULL DEFAULT 0 CHECK(quantity>=0),"updated_at" timestamptz NOT NULL DEFAULT now())`,
    );
    await q.query(
      `CREATE TABLE "customer_addresses" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),"user_id" uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,"label" varchar(80) NOT NULL,"address" text NOT NULL,"city" varchar(80) NOT NULL,"telephone" varchar(40),"is_default" boolean NOT NULL DEFAULT false); CREATE TABLE "pharmacy_carts" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),"user_id" uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,"pharmacy_id" uuid NOT NULL REFERENCES pharmacies(id) ON DELETE CASCADE,"created_at" timestamptz NOT NULL DEFAULT now(),UNIQUE("user_id","pharmacy_id")); CREATE TABLE "pharmacy_cart_items" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),"cart_id" uuid NOT NULL REFERENCES pharmacy_carts(id) ON DELETE CASCADE,"product_id" uuid NOT NULL REFERENCES pharmacy_products(id) ON DELETE CASCADE,"quantity" integer NOT NULL CHECK(quantity>0),UNIQUE("cart_id","product_id"))`,
    );
    await q.query(
      `CREATE TABLE "pharmacy_orders" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),"pharmacy_id" uuid NOT NULL REFERENCES pharmacies(id),"customer_user_id" uuid NOT NULL REFERENCES users(id),"status" pharmacy_order_status_enum NOT NULL DEFAULT 'pending',"fulfillment_method" fulfillment_method_enum NOT NULL,"delivery_address" text,"product_subtotal" decimal(10,2) NOT NULL,"delivery_fee" decimal(10,2) NOT NULL DEFAULT 0,"platform_fee" decimal(10,2) NOT NULL DEFAULT 0,"final_total" decimal(10,2) NOT NULL,"created_at" timestamptz NOT NULL DEFAULT now(),"updated_at" timestamptz NOT NULL DEFAULT now()); CREATE INDEX "IDX_pharmacy_orders_tenant" ON pharmacy_orders(pharmacy_id,created_at); CREATE TABLE "pharmacy_order_items" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),"order_id" uuid NOT NULL REFERENCES pharmacy_orders(id) ON DELETE CASCADE,"product_id" uuid REFERENCES pharmacy_products(id) ON DELETE SET NULL,"name" varchar(180) NOT NULL,"unit_price" decimal(10,2) NOT NULL,"quantity" integer NOT NULL,"prescription_required" boolean NOT NULL)`,
    );
    await q.query(
      `CREATE TABLE "prescriptions" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),"order_id" uuid REFERENCES pharmacy_orders(id) ON DELETE CASCADE,"customer_user_id" uuid NOT NULL REFERENCES users(id),"pharmacy_id" uuid NOT NULL REFERENCES pharmacies(id),"private_storage_key" text NOT NULL,"original_filename" varchar(255) NOT NULL,"mime_type" varchar(60) NOT NULL,"version" integer NOT NULL DEFAULT 1,"created_at" timestamptz NOT NULL DEFAULT now()); CREATE TABLE "prescription_reviews" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),"prescription_id" uuid NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,"reviewer_user_id" uuid NOT NULL REFERENCES users(id),"decision" prescription_decision_enum NOT NULL,"notes" text,"fulfilled_at" timestamptz,"created_at" timestamptz NOT NULL DEFAULT now()); CREATE TABLE "pharmacy_payments" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),"order_id" uuid UNIQUE NOT NULL REFERENCES pharmacy_orders(id),"provider" varchar(40) NOT NULL DEFAULT 'unconfigured',"provider_reference" varchar(255),"status" pharmacy_payment_status_enum NOT NULL DEFAULT 'pending',"amount" decimal(10,2) NOT NULL); CREATE TABLE "pharmacy_deliveries" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),"order_id" uuid UNIQUE NOT NULL REFERENCES pharmacy_orders(id),"address" text NOT NULL,"driver_name" varchar(120),"tracking_note" text)`,
    );
    await q.query(
      `CREATE TABLE "pharmacy_audit_logs" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),"actor_user_id" uuid REFERENCES users(id) ON DELETE SET NULL,"pharmacy_id" uuid REFERENCES pharmacies(id) ON DELETE SET NULL,"action" varchar(100) NOT NULL,"target_type" varchar(60) NOT NULL,"target_id" uuid,"metadata" jsonb NOT NULL DEFAULT '{}',"created_at" timestamptz NOT NULL DEFAULT now()); CREATE TABLE "pharmacy_reports" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),"reporter_user_id" uuid NOT NULL REFERENCES users(id),"pharmacy_id" uuid REFERENCES pharmacies(id),"product_id" uuid REFERENCES pharmacy_products(id),"reason" text NOT NULL,"status" varchar(30) NOT NULL DEFAULT 'open',"created_at" timestamptz NOT NULL DEFAULT now())`,
    );
  }
  public async down(q: QueryRunner): Promise<void> {
    for (const table of [
      "pharmacy_reports",
      "pharmacy_audit_logs",
      "pharmacy_deliveries",
      "pharmacy_payments",
      "prescription_reviews",
      "prescriptions",
      "pharmacy_order_items",
      "pharmacy_orders",
      "pharmacy_cart_items",
      "pharmacy_carts",
      "customer_addresses",
      "pharmacy_inventory",
      "pharmacy_products",
      "pharmacy_product_categories",
      "pharmacy_verifications",
      "pharmacy_opening_hours",
      "pharmacy_staff",
      "pharmacies",
    ])
      await q.query(`DROP TABLE IF EXISTS "${table}" CASCADE`);
    for (const type of [
      "pharmacy_payment_status_enum",
      "prescription_decision_enum",
      "fulfillment_method_enum",
      "pharmacy_order_status_enum",
      "pharmacy_staff_role_enum",
      "pharmacy_status_enum",
    ])
      await q.query(`DROP TYPE IF EXISTS "${type}"`);
  }
}
