import { Module } from '@nestjs/common';
import { ChatbotService } from './chatbot.service';
import { ChatbotController } from './chatbot.controller';
import { ComerciosModule } from 'src/comercios/comercios.module';
import { DomiliariosModule } from 'src/domiliarios/domiliarios.module';
import { DomiciliosModule } from 'src/domicilios/domicilios.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Conversacion } from './entities/conversacion.entity';
import { Mensaje } from './entities/mensajes.entity';
import { ChatService } from './chat.service';

@Module({
  imports: [ComerciosModule, DomiliariosModule, DomiciliosModule,     TypeOrmModule.forFeature([Conversacion, Mensaje])
],
  controllers: [ChatbotController],
  providers: [ChatbotService, ChatService],
})
export class ChatbotModule {}
