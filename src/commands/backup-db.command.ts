import { Command } from 'commander';
import { exec } from 'child_process';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import type { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';

// ✅ Cargar variables de entorno
dotenv.config();

const isCompiled = __filename.endsWith('.js');

// ✅ Crear la conexión a la base de datos directamente
const AppDataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    entities: [isCompiled ? 'dist/**/*.entity.js' : 'src/**/*.entity.ts'],
    migrations: [isCompiled ? 'dist/migrations/*.js' : 'src/migrations/*.ts'],
    synchronize: false,
});

const program = new Command();

program
    .name('backup-db')
    .description('Backup de la base de datos actual')
    .action(async () => {
        try {
            await AppDataSource.initialize();

            const options = AppDataSource.options as PostgresConnectionOptions;

            const db = options.database;
            const host = options.host;
            const user = options.username;
            const pass = options.password;

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupFile = `backup_${db}_${timestamp}.sql`;

            const command = `set PGPASSWORD=${pass} && pg_dump -h ${host} -U ${user} -d ${db} > ${backupFile}`;

            exec(command, (error: any, stdout: string, stderr: string) => {
                if (error) {
                    console.error(`❌ Error al hacer backup:`, error.message);
                    return;
                }
                console.log(`✅ Backup realizado: ${backupFile}`);
            });
        } catch (error) {
            console.error('❌ Error general:', error);
        }
    });

program.parse(process.argv);
