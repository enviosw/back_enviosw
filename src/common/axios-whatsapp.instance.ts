// src/shared/http/axios-whatsapp.instance.ts
import axios from 'axios';
import { whatsappConstants } from 'src/auth/constants/jwt.constant'; // Ajusta el path si es diferente

export const axiosWhatsapp = axios.create({
  baseURL: `${whatsappConstants.baseUrl}/${whatsappConstants.apiVersion}/${whatsappConstants.phoneId}`,
  headers: {
    Authorization: `Bearer ${whatsappConstants.apiToken}`,
    'Content-Type': 'application/json',
  },
});
