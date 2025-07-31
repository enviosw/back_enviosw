import { Module } from '@nestjs/common';
import { DomiciliosService } from './domicilios.service';
import { DomiciliosController } from './domicilios.controller';
import { Domicilio } from './entities/domicilio.entity';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [TypeOrmModule.forFeature([Domicilio])],
  controllers: [DomiciliosController],
  providers: [DomiciliosService],
  exports: [DomiciliosService]
})
export class DomiciliosModule { }
