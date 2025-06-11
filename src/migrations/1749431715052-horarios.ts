import { MigrationInterface, QueryRunner } from "typeorm";

export class Horarios1749431715052 implements MigrationInterface {
    name = 'Horarios1749431715052'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "comercios" ALTER COLUMN "horarios" SET DEFAULT '{"horarios":[{"dia":"lunes","apertura":"07:00 AM","cierre":"04:30 PM"},{"dia":"martes","apertura":"07:00 AM","cierre":"04:30 PM"},{"dia":"miercoles","apertura":"07:00 AM","cierre":"04:30 PM"},{"dia":"jueves","apertura":"07:00 AM","cierre":"04:30 PM"},{"dia":"viernes","apertura":"07:00 AM","cierre":"04:30 PM"},{"dia":"sabado","apertura":"07:00 AM","cierre":"04:30 PM"},{"dia":"domingo","apertura":"07:00 AM","cierre":"11:30 PM"}]}'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "comercios" ALTER COLUMN "horarios" SET DEFAULT '{"horarios": {"lunes": {"cierre": "04:30 PM", "apertura": "07:00 AM"}, "jueves": {"cierre": "04:30 PM", "apertura": "07:00 AM"}, "martes": {"cierre": "04:30 PM", "apertura": "07:00 AM"}, "sabado": {"cierre": "04:30 PM", "apertura": "07:00 AM"}, "domingo": {"cierre": "11:30 PM", "apertura": "07:00 AM"}, "viernes": {"cierre": "04:30 PM", "apertura": "07:00 AM"}, "miercoles": {"cierre": "04:30 PM", "apertura": "07:00 AM"}}}'`);
    }

}
