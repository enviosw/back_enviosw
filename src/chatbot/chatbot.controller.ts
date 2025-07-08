import { Controller, Get, Post, Body, Query, Logger } from '@nestjs/common';
import { ChatbotService } from './chatbot.service';
import { ConfigService } from '@nestjs/config';
import { whatsappConstants } from 'src/auth/constants/jwt.constant';


@Controller('chatbot')
export class ChatbotController {

  private readonly logger = new Logger(ChatbotController.name);

  constructor(private readonly chatbotService: ChatbotService,

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
}
