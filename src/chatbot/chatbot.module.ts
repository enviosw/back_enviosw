import { Module } from '@nestjs/common';
import { ChatbotService } from './chatbot.service';
import { ChatbotController } from './chatbot.controller';
import { ComerciosModule } from 'src/comercios/comercios.module';
import { DomiliariosModule } from 'src/domiliarios/domiliarios.module';
import { DomiciliosModule } from 'src/domicilios/domicilios.module';

@Module({
  imports: [ComerciosModule, DomiliariosModule, DomiciliosModule],
  controllers: [ChatbotController],
  providers: [ChatbotService],
})
export class ChatbotModule {}
