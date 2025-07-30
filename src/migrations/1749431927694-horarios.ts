import { MigrationInterface, QueryRunner } from "typeorm";

export class Horarios1749431927694 implements MigrationInterface {
    name = 'Horarios1749431927694'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "comercios" ALTER COLUMN "estado" SET DEFAULT 'activo'`);
        await queryRunner.query(`ALTER TABLE "comercios" ALTER COLUMN "horarios" SET DEFAULT '{"horarios":[{"dia":"lunes","apertura":"07:00 AM","cierre":"04:30 PM"},{"dia":"martes","apertura":"07:00 AM","cierre":"04:30 PM"},{"dia":"miercoles","apertura":"07:00 AM","cierre":"04:30 PM"},{"dia":"jueves","apertura":"07:00 AM","cierre":"04:30 PM"},{"dia":"viernes","apertura":"07:00 AM","cierre":"04:30 PM"},{"dia":"sabado","apertura":"07:00 AM","cierre":"04:30 PM"},{"dia":"domingo","apertura":"07:00 AM","cierre":"11:30 PM"}]}'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "comercios" ALTER COLUMN "horarios" SET DEFAULT '{"lunes": {"cierre": "10:30 PM", "apertura": "07:00 AM"}, "jueves": {"cierre": "10:30 PM", "apertura": "07:00 AM"}, "martes": {"cierre": "10:30 PM", "apertura": "07:00 AM"}, "sabado": {"cierre": "10:30 PM", "apertura": "07:00 AM"}, "domingo": {"cierre": "10:00 PM", "apertura": "07:00 AM"}, "viernes": {"cierre": "10:30 PM", "apertura": "07:00 AM"}, "miercoles": {"cierre": "10:30 PM", "apertura": "07:00 AM"}}'`);
        await queryRunner.query(`ALTER TABLE "comercios" ALTER COLUMN "estado" SET DEFAULT true`);
    }

}
