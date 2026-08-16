import { MigrationInterface, QueryRunner } from "typeorm";

export class AddBookingMessages1786842355712 implements MigrationInterface {
  name = "AddBookingMessages1786842355712";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "booking_messages" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "booking_id" uuid NOT NULL, "sender_user_id" uuid NOT NULL, "body" text NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_b91a56d40d232a92ccba4432ebc" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_74665ddf44ef82a474462f2210" ON "booking_messages" ("booking_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "booking_messages" ADD CONSTRAINT "FK_74665ddf44ef82a474462f22100" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "booking_messages" ADD CONSTRAINT "FK_949d45dcc4edb517b9444ee6793" FOREIGN KEY ("sender_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "booking_messages" DROP CONSTRAINT "FK_949d45dcc4edb517b9444ee6793"`,
    );
    await queryRunner.query(
      `ALTER TABLE "booking_messages" DROP CONSTRAINT "FK_74665ddf44ef82a474462f22100"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_74665ddf44ef82a474462f2210"`,
    );
    await queryRunner.query(`DROP TABLE "booking_messages"`);
  }
}
