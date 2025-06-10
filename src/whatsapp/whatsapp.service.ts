// src/whatsapp/whatsapp.service.ts
import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { jwtConstants } from 'src/auth/constants/jwt.constant';

@Injectable()
export class WhatsappService {
  private readonly token = jwtConstants.apiWhatsapp; // 🔐 Token de acceso (env)
  private readonly phoneNumberId = jwtConstants.numberPrueba; // ID del número emisor

  constructor(private readonly httpService: HttpService) {}

  async enviarPedidoWhatsApp(destino: string, productos: any[], direccion: string, telefono?: string) {
    const total = productos.reduce(
      (sum, p) => sum + p.precio * p.cantidad,
      0,
    );

    console.log(destino, direccion,telefono)

    const mensaje = `¡Hola! 👋 Me gustaría hacer un pedido con los siguientes productos:\n\n` +
      productos.map(p => `• ${p.cantidad}x ${p.nombre} - $${p.precio * p.cantidad}`).join('\n') +
      `\n\n🔸 Total: $${total}\n📍 Dirección: ${direccion}` +
      (telefono ? `\n📞 Teléfono: ${telefono}` : '') +
      `\n\n¿Me puedes confirmar si todo está bien? ¡Gracias! 🙌`;

    const url = `https://graph.facebook.com/v19.0/${this.phoneNumberId}/messages`;

    const payload = {
      messaging_product: 'whatsapp',
      to: destino, // Ej: '573001112233'
      type: 'text',
      text: { body: mensaje },
    };

    const headers = {
      Authorization: `Bearer ${this.token}`,
      'Content-Type': 'application/json',
    };

    try {
      const response = await firstValueFrom(
        this.httpService.post(url, payload, { headers }),
      );
      return response.data;
    } catch (error) {
      console.error('❌ Error al enviar a WhatsApp:', error.response?.data || error);
      throw new Error('No se pudo enviar el pedido por WhatsApp');
    }
  }
}
