import { MigrationInterface, QueryRunner } from "typeorm";

export class RelacionUsuarioComercio1746381610152 implements MigrationInterface {
    name = 'RelacionUsuarioComercio1746381610152'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "roles" DROP COLUMN "activo"`);
        await queryRunner.query(`ALTER TABLE "usuarios" ADD "comercio_id" integer`);
        await queryRunner.query(`ALTER TABLE "usuarios" ADD CONSTRAINT "FK_7b87ece4d89b3f4d79c0fac5e65" FOREIGN KEY ("comercio_id") REFERENCES "comercios"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "usuarios" DROP CONSTRAINT "FK_7b87ece4d89b3f4d79c0fac5e65"`);
        await queryRunner.query(`ALTER TABLE "usuarios" DROP COLUMN "comercio_id"`);
        await queryRunner.query(`ALTER TABLE "roles" ADD "activo" character varying NOT NULL DEFAULT 'activo'`);
    }

}
