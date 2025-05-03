// src/productos/productos.controller.ts
import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { ProductosService } from './productos.service';
import { Producto } from './entities/producto.entity';

@Controller('productos')
export class ProductosController {
  constructor(private readonly productosService: ProductosService) {}

  @Post()
  create(
    @Body()
    createProductoDto: {
      nombre: string;
      descripcion: string;
      categoriaId: number;
      precio: number;
      precio_descuento?: number;
      estado?: string;
      estado_descuento?: string;
      unidad: string;
    },
  ): Promise<Producto> {
    return this.productosService.create(createProductoDto);
  }

  @Get()
  findAll(): Promise<Producto[]> {
    return this.productosService.findAll();
  }

  @Get('comercio')
  async findAllComercios(
    @Query('comercio_id') comercio_id: number,
  ): Promise<Producto[]> {
    return this.productosService.findAllComercio(comercio_id);
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<Producto> {
    return this.productosService.findOne(+id);
  }
}
