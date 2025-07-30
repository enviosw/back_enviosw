import { MigrationInterface, QueryRunner } from "typeorm";

export class Slectpass1749261556914 implements MigrationInterface {
    name = 'Slectpass1749261556914'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "productos" ("id" SERIAL NOT NULL, "nombre" character varying NOT NULL, "descripcion" character varying, "precio" numeric NOT NULL, "precio_descuento" numeric, "estado" character varying NOT NULL DEFAULT 'activo', "estado_descuento" character varying NOT NULL DEFAULT 'inactivo', "unidad" character varying, "imagen_url" character varying, "fecha_creacion" TIMESTAMP NOT NULL DEFAULT now(), "fecha_actualizacion" TIMESTAMP NOT NULL DEFAULT now(), "categoriaId" integer, "comercioId" integer, CONSTRAINT "PK_04f604609a0949a7f3b43400766" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "categorias" ("id" SERIAL NOT NULL, "nombre" character varying NOT NULL, "comercio_id" integer, CONSTRAINT "PK_3886a26251605c571c6b4f861fe" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "servicios" ("id" SERIAL NOT NULL, "nombre" character varying(150) NOT NULL, "estado" character varying NOT NULL DEFAULT 'activo', "icon" character varying(50), "color" character varying(20), "orden" integer, "foto" character varying(255), "fecha_creacion" TIMESTAMP NOT NULL DEFAULT now(), "fecha_actualizacion" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_fefcdbfeaf506ca485a6dcfb0d8" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "comercios" ("id" SERIAL NOT NULL, "nombre_comercial" character varying(150) NOT NULL, "razon_social" character varying(200) NOT NULL, "nit" character varying(20) NOT NULL, "descripcion" character varying(255) NOT NULL, "responsable" character varying(100) NOT NULL, "email_contacto" character varying(100) NOT NULL, "telefono" character varying(15) NOT NULL, "telefono_secundario" character varying(15) NOT NULL, "direccion" character varying(255) NOT NULL, "logo_url" character varying, "estado" character varying NOT NULL DEFAULT true, "activar_numero" integer NOT NULL DEFAULT '0', "horarios" jsonb DEFAULT '{"lunes":{"apertura":"07:00 AM","cierre":"10:30 PM"},"martes":{"apertura":"07:00 AM","cierre":"10:30 PM"},"miercoles":{"apertura":"07:00 AM","cierre":"10:30 PM"},"jueves":{"apertura":"07:00 AM","cierre":"10:30 PM"},"viernes":{"apertura":"07:00 AM","cierre":"10:30 PM"},"sabado":{"apertura":"07:00 AM","cierre":"10:30 PM"},"domingo":{"apertura":"07:00 AM","cierre":"10:00 PM"}}', "estado_comercio" boolean NOT NULL DEFAULT true, "fecha_creacion" TIMESTAMP NOT NULL DEFAULT now(), "fecha_actualizacion" TIMESTAMP NOT NULL DEFAULT now(), "servicio_id" integer, CONSTRAINT "PK_f886203d76afacf779ac3a562c3" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "usuarios" ("id" SERIAL NOT NULL, "nombre" character varying(100) NOT NULL, "email" character varying NOT NULL, "password" character varying NOT NULL, "rol" character varying NOT NULL DEFAULT 'usuario', "estado" character varying NOT NULL DEFAULT 'activo', "telefono" character varying(15), "direccion" character varying(255), "fecha_creacion" TIMESTAMP NOT NULL DEFAULT now(), "fecha_actualizacion" TIMESTAMP NOT NULL DEFAULT now(), "comercio_id" integer, CONSTRAINT "UQ_446adfc18b35418aac32ae0b7b5" UNIQUE ("email"), CONSTRAINT "PK_d7281c63c176e152e4c531594a8" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "clientes" ("id" SERIAL NOT NULL, "nombre" character varying(150) NOT NULL, "apellido" character varying(150) NOT NULL, "email" character varying(255) NOT NULL, "password" character varying(255) NOT NULL, "telefono" character varying(20) NOT NULL, "telefono_2" character varying(20), "direccion" character varying(255) NOT NULL, "estado" character varying(20) NOT NULL, "fecha_creacion" TIMESTAMP NOT NULL DEFAULT now(), "fecha_actualizacion" TIMESTAMP NOT NULL DEFAULT now(), "rol_id" integer NOT NULL, CONSTRAINT "UQ_3cd5652ab34ca1a0a2c7a255313" UNIQUE ("email"), CONSTRAINT "PK_d76bf3571d906e4e86470482c08" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "roles" ("id" SERIAL NOT NULL, "nombre" character varying NOT NULL, "fecha_creacion" TIMESTAMP NOT NULL DEFAULT now(), "fecha_actualizacion" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_c1433d71a4838793a49dcad46ab" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "imagenes" ("id" SERIAL NOT NULL, "nombre" character varying NOT NULL, "ruta" character varying NOT NULL, "creadoEn" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_8a74dd76fc7dcbf7c200583474b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "productos" ADD CONSTRAINT "FK_aee00189e42dd8880cdfe1bb1e7" FOREIGN KEY ("categoriaId") REFERENCES "categorias"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "productos" ADD CONSTRAINT "FK_3f08f2bea6e23e149898845341a" FOREIGN KEY ("comercioId") REFERENCES "comercios"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "categorias" ADD CONSTRAINT "FK_f1a00af57c79e47d4d4ead89d66" FOREIGN KEY ("comercio_id") REFERENCES "comercios"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "comercios" ADD CONSTRAINT "FK_1be6ea640f5da67b11fd4798111" FOREIGN KEY ("servicio_id") REFERENCES "servicios"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "usuarios" ADD CONSTRAINT "FK_7b87ece4d89b3f4d79c0fac5e65" FOREIGN KEY ("comercio_id") REFERENCES "comercios"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "clientes" ADD CONSTRAINT "FK_a065860eb526aad31fcd8ae54e1" FOREIGN KEY ("rol_id") REFERENCES "roles"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "clientes" DROP CONSTRAINT "FK_a065860eb526aad31fcd8ae54e1"`);
        await queryRunner.query(`ALTER TABLE "usuarios" DROP CONSTRAINT "FK_7b87ece4d89b3f4d79c0fac5e65"`);
        await queryRunner.query(`ALTER TABLE "comercios" DROP CONSTRAINT "FK_1be6ea640f5da67b11fd4798111"`);
        await queryRunner.query(`ALTER TABLE "categorias" DROP CONSTRAINT "FK_f1a00af57c79e47d4d4ead89d66"`);
        await queryRunner.query(`ALTER TABLE "productos" DROP CONSTRAINT "FK_3f08f2bea6e23e149898845341a"`);
        await queryRunner.query(`ALTER TABLE "productos" DROP CONSTRAINT "FK_aee00189e42dd8880cdfe1bb1e7"`);
        await queryRunner.query(`DROP TABLE "imagenes"`);
        await queryRunner.query(`DROP TABLE "roles"`);
        await queryRunner.query(`DROP TABLE "clientes"`);
        await queryRunner.query(`DROP TABLE "usuarios"`);
        await queryRunner.query(`DROP TABLE "comercios"`);
        await queryRunner.query(`DROP TABLE "servicios"`);
        await queryRunner.query(`DROP TABLE "categorias"`);
        await queryRunner.query(`DROP TABLE "productos"`);
    }

}
