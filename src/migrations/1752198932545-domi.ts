import { MigrationInterface, QueryRunner } from "typeorm";

export class Domi1752198932545 implements MigrationInterface {
    name = 'Domi1752198932545'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "domiciliarios" DROP CONSTRAINT "UQ_34a1199091f0305f59f63c972e2"`);
        await queryRunner.query(`ALTER TABLE "domiciliarios" DROP COLUMN "telefono"`);
        await queryRunner.query(`ALTER TABLE "domiciliarios" DROP COLUMN "latitud_actual"`);
        await queryRunner.query(`ALTER TABLE "domiciliarios" DROP COLUMN "longitud_actual"`);
        await queryRunner.query(`ALTER TABLE "domiciliarios" DROP COLUMN "creado_en"`);
        await queryRunner.query(`ALTER TABLE "domiciliarios" DROP COLUMN "actualizado_en"`);
        await queryRunner.query(`ALTER TABLE "domiciliarios" ADD "apellido" character varying(100) NOT NULL`);
        await queryRunner.query(`ALTER TABLE "domiciliarios" ADD "alias" character varying(50) NOT NULL`);
        await queryRunner.query(`ALTER TABLE "domiciliarios" ADD "telefono_whatsapp" character varying(15) NOT NULL`);
        await queryRunner.query(`ALTER TABLE "domiciliarios" ADD "placa_moto" character varying(15) NOT NULL`);
        await queryRunner.query(`ALTER TABLE "domiciliarios" ADD "numero_chaqueta" integer NOT NULL`);
        await queryRunner.query(`ALTER TABLE "domiciliarios" ADD "direccion_residencia" character varying(255) NOT NULL`);
        await queryRunner.query(`ALTER TABLE "domiciliarios" ADD "disponible" boolean NOT NULL DEFAULT true`);
        await queryRunner.query(`ALTER TABLE "domiciliarios" ADD "turno_orden" integer NOT NULL DEFAULT '1'`);
        await queryRunner.query(`ALTER TABLE "domiciliarios" ADD "fecha_creacion" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "domiciliarios" ADD "fecha_actualizacion" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "domiciliarios" DROP COLUMN "nombre"`);
        await queryRunner.query(`ALTER TABLE "domiciliarios" ADD "nombre" character varying(100) NOT NULL`);
        await queryRunner.query(`ALTER TABLE "domiciliarios" DROP COLUMN "estado"`);
        await queryRunner.query(`ALTER TABLE "domiciliarios" ADD "estado" boolean NOT NULL DEFAULT true`);
        await queryRunner.query(`CREATE INDEX "IDX_e08114161ba668a7c886f8bcfd" ON "domiciliarios" ("estado", "disponible", "turno_orden") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_e08114161ba668a7c886f8bcfd"`);
        await queryRunner.query(`ALTER TABLE "domiciliarios" DROP COLUMN "estado"`);
        await queryRunner.query(`ALTER TABLE "domiciliarios" ADD "estado" character varying NOT NULL DEFAULT 'disponible'`);
        await queryRunner.query(`ALTER TABLE "domiciliarios" DROP COLUMN "nombre"`);
        await queryRunner.query(`ALTER TABLE "domiciliarios" ADD "nombre" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "domiciliarios" DROP COLUMN "fecha_actualizacion"`);
        await queryRunner.query(`ALTER TABLE "domiciliarios" DROP COLUMN "fecha_creacion"`);
        await queryRunner.query(`ALTER TABLE "domiciliarios" DROP COLUMN "turno_orden"`);
        await queryRunner.query(`ALTER TABLE "domiciliarios" DROP COLUMN "disponible"`);
        await queryRunner.query(`ALTER TABLE "domiciliarios" DROP COLUMN "direccion_residencia"`);
        await queryRunner.query(`ALTER TABLE "domiciliarios" DROP COLUMN "numero_chaqueta"`);
        await queryRunner.query(`ALTER TABLE "domiciliarios" DROP COLUMN "placa_moto"`);
        await queryRunner.query(`ALTER TABLE "domiciliarios" DROP COLUMN "telefono_whatsapp"`);
        await queryRunner.query(`ALTER TABLE "domiciliarios" DROP COLUMN "alias"`);
        await queryRunner.query(`ALTER TABLE "domiciliarios" DROP COLUMN "apellido"`);
        await queryRunner.query(`ALTER TABLE "domiciliarios" ADD "actualizado_en" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "domiciliarios" ADD "creado_en" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "domiciliarios" ADD "longitud_actual" double precision`);
        await queryRunner.query(`ALTER TABLE "domiciliarios" ADD "latitud_actual" double precision`);
        await queryRunner.query(`ALTER TABLE "domiciliarios" ADD "telefono" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "domiciliarios" ADD CONSTRAINT "UQ_34a1199091f0305f59f63c972e2" UNIQUE ("telefono")`);
    }

}
