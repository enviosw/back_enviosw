// src/config/jwtConstants.ts
import * as dotenv from 'dotenv';
dotenv.config(); // ✅ Cargar primero

export const jwtConstants = {
  accessTokenSecret: process.env.ACCESS_TOKEN_SECRET,
  refreshTokenSecret: process.env.REFRESH_TOKEN_SECRET,
  accessTokenExpiration: process.env.ACCESS_TOKEN_EXPIRATION,
  refreshTokenExpiration: process.env.REFRESH_TOKEN_EXPIRATION,
};
