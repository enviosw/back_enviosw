import { Module } from '@nestjs/common';
import { DomiciliariosService } from './domiliarios.service';
import { DomiciliariosController } from './domiliarios.controller';
import { Domiciliario } from './entities/domiliario.entity';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [TypeOrmModule.forFeature([Domiciliario])],
  controllers: [DomiciliariosController],
  providers: [DomiciliariosService],
  exports: [DomiciliariosService],
})
export class DomiliariosModule { }
