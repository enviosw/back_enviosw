import { Module } from '@nestjs/common';
import { TiposComerciosService } from './tipos_comercios.service';
import { TiposComerciosController } from './tipos_comercios.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TipoComercio } from './entities/tipos_comercio.entity';

@Module({
  imports: [TypeOrmModule.forFeature([TipoComercio])],
  controllers: [TiposComerciosController],
  providers: [TiposComerciosService],
})
export class TiposComerciosModule { }
