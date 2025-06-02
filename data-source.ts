import * as dotenv from 'dotenv';
dotenv.config(); // ✅ Cargar primero

import { DataSource } from 'typeorm';

console.log('✅ DB_HOST:', process.env.DB_HOST); // para probar
const isCompiled = __filename.endsWith('.js');


export const AppDataSource = new DataSource({
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
