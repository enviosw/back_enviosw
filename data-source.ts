import * as dotenv from 'dotenv';
dotenv.config(); // ✅ Cargar primero

import { DataSource } from 'typeorm';

console.log('✅ DB_HOST:', process.env.DB_HOST); // para probar


export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  entities: [__dirname + '/**/**/*.entity{.ts,.js}'],
  migrations: ['../migrations/*.ts'],
  synchronize: false,
});
