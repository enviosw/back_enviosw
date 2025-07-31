import { MigrationInterface, QueryRunner } from "typeorm";

export class Indexe1752279646108 implements MigrationInterface {
    name = 'Indexe1752279646108'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_TELEFONO_WHATSAPP" ON "domiciliarios" ("telefono_whatsapp") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_TELEFONO_WHATSAPP"`);
    }

}
