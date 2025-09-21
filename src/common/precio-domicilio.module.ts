import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PrecioDomicilio } from 'src/chatbot/entities/precio-domicilio.entity';
import { PrecioDomicilioService } from './precio-domicilio.service';
import { PrecioDomicilioController } from './precio-domicilio.controller';

@Module({
  imports: [TypeOrmModule.forFeature([PrecioDomicilio])],
  providers: [PrecioDomicilioService],
  controllers: [PrecioDomicilioController],
  exports: [PrecioDomicilioService],
})
export class PrecioDomicilioModule {}
