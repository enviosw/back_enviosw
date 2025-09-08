// src/config/jwtConstants.ts
import * as dotenv from 'dotenv';
dotenv.config(); // ✅ Cargar primero

export const jwtConstants = {
  accessTokenSecret: process.env.ACCESS_TOKEN_SECRET,
  refreshTokenSecret: process.env.REFRESH_TOKEN_SECRET,
  accessTokenExpiration: process.env.ACCESS_TOKEN_EXPIRATION,
  refreshTokenExpiration: process.env.REFRESH_TOKEN_EXPIRATION,
};

export const whatsappConstants = {
  verifyToken: process.env.WEBHOOK_VERIFY_TOKEN,
  apiToken: process.env.WHATSAPP_TOKEN,
  phoneId: process.env.NUMBER_PRUEBA,
  apiVersion: process.env.API_VERSION,
  baseUrl: process.env.BASE_URL,
};

export const stickerConstants = {
  stickerId: process.env.ID_STICKER,
  stickerChad: process.env.SHAD_STICKER,
};