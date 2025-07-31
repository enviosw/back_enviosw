import { MigrationInterface, QueryRunner } from "typeorm";

export class DOMICLIOS221752296912015 implements MigrationInterface {
    name = 'DOMICLIOS221752296912015'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "domicilios" DROP CONSTRAINT "FK_31c64eed75b2d884e02b411b9e2"`);
        await queryRunner.query(`ALTER TABLE "domicilios" ALTER COLUMN "id_domiciliario" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "domicilios" ADD CONSTRAINT "FK_31c64eed75b2d884e02b411b9e2" FOREIGN KEY ("id_domiciliario") REFERENCES "domiciliarios"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "domicilios" DROP CONSTRAINT "FK_31c64eed75b2d884e02b411b9e2"`);
        await queryRunner.query(`ALTER TABLE "domicilios" ALTER COLUMN "id_domiciliario" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "domicilios" ADD CONSTRAINT "FK_31c64eed75b2d884e02b411b9e2" FOREIGN KEY ("id_domiciliario") REFERENCES "domiciliarios"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

}
