import { forwardRef, Module } from '@nestjs/common';
import { ProductosService } from './productos.service';
import { ProductosController } from './productos.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Producto } from './entities/producto.entity';
import { Categoria } from '../categorias/entities/categoria.entity';
import { CategoriasModule } from '../categorias/categorias.module';
import { ComerciosModule } from '../comercios/comercios.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([Producto, Categoria]), forwardRef(() => AuthModule),CategoriasModule, ComerciosModule],
  controllers: [ProductosController],
  providers: [ProductosService],
})
export class ProductosModule {}
