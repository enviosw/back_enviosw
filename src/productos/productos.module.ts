import { Module } from '@nestjs/common';
import { ProductosService } from './productos.service';
import { ProductosController } from './productos.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Producto } from './entities/producto.entity';
import { Categoria } from '../categorias/entities/categoria.entity';
import { CategoriasModule } from 'src/categorias/categorias.module';
import { ComerciosModule } from 'src/comercios/comercios.module';

@Module({
  imports: [TypeOrmModule.forFeature([Producto, Categoria]), CategoriasModule, ComerciosModule],
  controllers: [ProductosController],
  providers: [ProductosService],
})
export class ProductosModule {}
