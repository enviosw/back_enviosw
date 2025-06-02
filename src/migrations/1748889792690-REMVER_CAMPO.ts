import { MigrationInterface, QueryRunner } from "typeorm";

export class REMVERCAMPO1748889792690 implements MigrationInterface {
    name = 'REMVERCAMPO1748889792690'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "clientes" ("id" SERIAL NOT NULL, "nombre" character varying(150) NOT NULL, "apellido" character varying(150) NOT NULL, "email" character varying(255) NOT NULL, "password" character varying(255) NOT NULL, "telefono" character varying(20) NOT NULL, "telefono_2" character varying(20), "direccion" character varying(255) NOT NULL, "estado" character varying(20) NOT NULL, "fecha_creacion" TIMESTAMP NOT NULL DEFAULT now(), "fecha_actualizacion" TIMESTAMP NOT NULL DEFAULT now(), "rol_id" integer NOT NULL, CONSTRAINT "UQ_3cd5652ab34ca1a0a2c7a255313" UNIQUE ("email"), CONSTRAINT "PK_d76bf3571d906e4e86470482c08" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "imagenes" ("id" SERIAL NOT NULL, "nombre" character varying NOT NULL, "ruta" character varying NOT NULL, "creadoEn" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_8a74dd76fc7dcbf7c200583474b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "clientes" ADD CONSTRAINT "FK_a065860eb526aad31fcd8ae54e1" FOREIGN KEY ("rol_id") REFERENCES "roles"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "clientes" DROP CONSTRAINT "FK_a065860eb526aad31fcd8ae54e1"`);
        await queryRunner.query(`DROP TABLE "imagenes"`);
        await queryRunner.query(`DROP TABLE "clientes"`);
    }

}
