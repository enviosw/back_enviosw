import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Categoria } from './entities/categoria.entity';
import { CategoriasController } from './categorias.controller';
import { CategoriasService } from './categorias.service';
import { ComerciosModule } from '../comercios/comercios.module';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([Categoria]), ComerciosModule, forwardRef(() => AuthModule)],

  controllers: [CategoriasController],
  providers: [CategoriasService],
  exports: [CategoriasService]
})
export class CategoriasModule { }
