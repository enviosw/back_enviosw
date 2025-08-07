import { Controller, Get, Post, Body, Query, Logger, Param } from '@nestjs/common';
import { ChatbotService } from './chatbot.service';
import { ConfigService } from '@nestjs/config';
import { whatsappConstants } from 'src/auth/constants/jwt.constant';
import { ChatService } from './chat.service';
import { Mensaje } from './entities/mensajes.entity';


@Controller('chatbot')
export class ChatbotController {

  private readonly logger = new Logger(ChatbotController.name);

  constructor(private readonly chatbotService: ChatbotService,
        private readonly chatService: ChatService, // ✅ Inyectamos ChatService


  ) { }

  @Get()
  verificarWebhook(
    @Query('hub.mode') modo: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') reto: string,
  ) {

    console.log("inicio")
    const TOKEN_VERIFICACION = whatsappConstants.verifyToken;

    if (!modo || !token || !reto) {
      this.logger.warn('⚠️ Parámetros incompletos en la verificación del webhook.');
      return { status: '400 Faltan parámetros requeridos' };
    }

    if (modo !== 'subscribe') {
      this.logger.warn(`⚠️ Modo inválido recibido: "${modo}"`);
      return { status: '403 Modo inválido' };
    }

    if (token !== TOKEN_VERIFICACION) {
      this.logger.warn(`❌ Token inválido recibido: "${token}"`);
      return { status: '403 Token inválido' };
    }

    this.logger.log('✅ Webhook verificado correctamente.');
    return reto; // Meta requiere que se devuelva el challenge si todo está bien
  }


  @Post()
  async resibiMensaje(@Body() body: any) {
    this.logger.debug('webhook resibido');
    await this.chatbotService.procesarMensajeEntrante(body);
    return { status: 'Mensaje recibido' };
  }

    // ✅ Lista todos los mensajes entre un domiciliario y un cliente
  @Get('mensajes')
  async obtenerMensajes(
    @Query('cliente') cliente: string,
    @Query('domiciliario') domiciliario: string,
  ) {
    return this.chatService.listarMensajesPorDomiciliarioYCliente(domiciliario, cliente);
  }

  @Get('mensajes/:idConversacion')
async obtenerMensajesPorConversacionId(
  @Param('idConversacion') idConversacion: string,
): Promise<Mensaje[]> {
  return this.chatService.listarMensajesPorConversacionId(idConversacion);
}

  // ✅ Lista todos los chats de un domiciliario (últimos mensajes)
  @Get('chats/:numeroDomiciliario')
  async obtenerChats(@Param('numeroDomiciliario') numeroDomiciliario: string) {
    return this.chatService.obtenerChatsPorDomiciliario(numeroDomiciliario);
  }
}
