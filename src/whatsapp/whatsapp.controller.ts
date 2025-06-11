// src/whatsapp/whatsapp.controller.ts
import { Controller, Post, Body } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';

@Controller('whatsapp')
export class WhatsappController {
  constructor(private readonly whatsappService: WhatsappService) {}

  @Post('enviar-pedido')
  async enviarPedido(
    @Body() body: {
      destino: string;
      productos: { nombre: string; cantidad: number; precio: number }[];
      direccion: string;
      telefono?: string;
    },
  ) {
    return this.whatsappService.enviarPedidoWhatsApp(
      body.destino,
      body.productos,
      body.direccion,
      body.telefono,
    );
  }
}
