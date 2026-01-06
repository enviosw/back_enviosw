import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Phone } from './entities/phone.entity';
import { PhonesService } from './phones.service';
import { PhonesController } from './phones.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Phone])],
  controllers: [PhonesController],
  providers: [PhonesService],
  exports: [PhonesService], // por si otro módulo necesita buscar/crear teléfonos
})
export class PhonesModule {}
