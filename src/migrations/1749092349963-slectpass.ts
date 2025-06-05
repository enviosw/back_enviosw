import { MigrationInterface, QueryRunner } from "typeorm";

export class Slectpass1749092349963 implements MigrationInterface {
    name = 'Slectpass1749092349963'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "productos" ALTER COLUMN "descripcion" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "productos" ALTER COLUMN "unidad" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "comercios" ALTER COLUMN "horarios" SET DEFAULT '{"lunes":{"apertura":"07:00 AM","cierre":"10:30 PM"},"martes":{"apertura":"07:00 AM","cierre":"10:30 PM"},"miercoles":{"apertura":"07:00 AM","cierre":"10:30 PM"},"jueves":{"apertura":"07:00 AM","cierre":"10:30 PM"},"viernes":{"apertura":"07:00 AM","cierre":"10:30 PM"},"sabado":{"apertura":"07:00 AM","cierre":"10:30 PM"},"domingo":{"apertura":"07:00 AM","cierre":"10:00 PM"}}'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "comercios" ALTER COLUMN "horarios" SET DEFAULT '{"lunes": {"cierre": "04:30 PM", "apertura": "07:00 AM"}, "jueves": {"cierre": "04:30 PM", "apertura": "07:00 AM"}, "martes": {"cierre": "04:30 PM", "apertura": "07:00 AM"}, "sabado": {"cierre": "04:30 PM", "apertura": "07:00 AM"}, "domingo": {"cierre": "09:00 PM", "apertura": "07:00 AM"}, "viernes": {"cierre": "04:30 PM", "apertura": "07:00 AM"}, "miercoles": {"cierre": "04:30 PM", "apertura": "07:00 AM"}}'`);
        await queryRunner.query(`ALTER TABLE "productos" ALTER COLUMN "unidad" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "productos" ALTER COLUMN "descripcion" SET NOT NULL`);
    }

}
