import { MigrationInterface, QueryRunner } from "typeorm";

export class DOMICLIOS1752296731810 implements MigrationInterface {
    name = 'DOMICLIOS1752296731810'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "domicilios" ("id" SERIAL NOT NULL, "mensaje_confirmacion" text, "estado" integer NOT NULL DEFAULT '1', "fecha" TIMESTAMP, "hora" character varying(5), "numero_cliente" character varying(20) NOT NULL, "tipo_servicio" character varying(30) NOT NULL, "origen_direccion" character varying(255) NOT NULL, "destino_direccion" character varying(255) NOT NULL, "telefono_contacto_origen" character varying(20), "telefono_contacto_destino" character varying(20), "notas" text, "detalles_pedido" text, "foto_entrega_url" character varying(255), "fecha_creacion" TIMESTAMP NOT NULL DEFAULT now(), "fecha_actualizacion" TIMESTAMP NOT NULL DEFAULT now(), "id_domiciliario" integer NOT NULL, "id_cliente" integer, CONSTRAINT "PK_d77bb6f1d0a3e808622f94277de" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "domicilios" ADD CONSTRAINT "FK_31c64eed75b2d884e02b411b9e2" FOREIGN KEY ("id_domiciliario") REFERENCES "domiciliarios"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "domicilios" ADD CONSTRAINT "FK_3d11d09ecf7b68b3e4ea1e45c4e" FOREIGN KEY ("id_cliente") REFERENCES "clientes"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "domicilios" DROP CONSTRAINT "FK_3d11d09ecf7b68b3e4ea1e45c4e"`);
        await queryRunner.query(`ALTER TABLE "domicilios" DROP CONSTRAINT "FK_31c64eed75b2d884e02b411b9e2"`);
        await queryRunner.query(`DROP TABLE "domicilios"`);
    }

}
