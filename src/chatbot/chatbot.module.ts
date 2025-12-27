import { Module } from '@nestjs/common';
import { ChatbotService } from './chatbot.service';
import { ChatbotController } from './chatbot.controller';
import { ComerciosModule } from '../comercios/comercios.module';
import { DomiliariosModule } from '../domiliarios/domiliarios.module';
import { DomiciliosModule } from '../domicilios/domicilios.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Conversacion } from './entities/conversacion.entity';
import { Mensaje } from './entities/mensajes.entity';
import { ChatService } from './chat.service';
import { ScheduleModule } from '@nestjs/schedule';
import { PrecioDomicilio } from './entities/precio-domicilio.entity';
import { WelcomeImageModule } from './welcome-image.module';

@Module({
  imports: [    ScheduleModule.forRoot(), // 👈 habilita cron/interval/timeout
ComerciosModule, DomiliariosModule, DomiciliosModule,    WelcomeImageModule, TypeOrmModule.forFeature([Conversacion, Mensaje, PrecioDomicilio])
],
  controllers: [ChatbotController],
  providers: [ChatbotService, ChatService],
})
export class ChatbotModule {}
