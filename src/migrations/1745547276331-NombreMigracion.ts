import { MigrationInterface, QueryRunner } from "typeorm";

export class NombreMigracion1745547276331 implements MigrationInterface {
    name = 'NombreMigracion1745547276331'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "comercios" ("id" SERIAL NOT NULL, "nombre_comercial" character varying(150) NOT NULL, "razon_social" character varying(200) NOT NULL, "nit" character varying(20) NOT NULL, "descripcion" character varying(255) NOT NULL, "categoria" character varying(100) NOT NULL, "responsable" character varying(100) NOT NULL, "email_contacto" character varying(100) NOT NULL, "telefono" character varying(15) NOT NULL, "telefono_secundario" character varying(15) NOT NULL, "direccion" character varying(255) NOT NULL, "logo_url" character varying, "activo" boolean NOT NULL DEFAULT true, "fecha_creacion" TIMESTAMP NOT NULL DEFAULT now(), "fecha_actualizacion" TIMESTAMP NOT NULL DEFAULT now(), "tipo_id" integer, CONSTRAINT "UQ_8ed955d34f5b785d74394229afd" UNIQUE ("nit"), CONSTRAINT "UQ_1891fe21a96b64643457fe5190e" UNIQUE ("email_contacto"), CONSTRAINT "PK_f886203d76afacf779ac3a562c3" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "tipos_comercio" ("id" SERIAL NOT NULL, "nombre" character varying(100) NOT NULL, "descripcion" character varying(255) NOT NULL, CONSTRAINT "UQ_4b4f797c070928232b1225543ea" UNIQUE ("nombre"), CONSTRAINT "PK_315a50b99261a2eb8bf667c0c30" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "usuarios" ("id" SERIAL NOT NULL, "nombre" character varying(100) NOT NULL, "email" character varying NOT NULL, "password" character varying NOT NULL, "rol" character varying NOT NULL DEFAULT 'usuario', "estado" boolean NOT NULL DEFAULT true, "fecha_creacion" TIMESTAMP NOT NULL DEFAULT now(), "fecha_actualizacion" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_446adfc18b35418aac32ae0b7b5" UNIQUE ("email"), CONSTRAINT "PK_d7281c63c176e152e4c531594a8" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "comercios" ADD CONSTRAINT "FK_749a43d898a55525f2deeddebab" FOREIGN KEY ("tipo_id") REFERENCES "tipos_comercio"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "comercios" DROP CONSTRAINT "FK_749a43d898a55525f2deeddebab"`);
        await queryRunner.query(`DROP TABLE "usuarios"`);
        await queryRunner.query(`DROP TABLE "tipos_comercio"`);
        await queryRunner.query(`DROP TABLE "comercios"`);
    }

}
