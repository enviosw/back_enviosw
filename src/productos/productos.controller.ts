// src/productos/productos.controller.ts
import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { ProductosService } from './productos.service';
import { Producto } from './entities/producto.entity';
import { CreateProductoDto } from './dto/create-producto.dto';

@Controller('productos')
export class ProductosController {
  constructor(private readonly productosService: ProductosService) {}

  // Crear un producto
  @Post()
  create(
    @Body() createProductoDto: CreateProductoDto,
  ): Promise<Producto> {
    return this.productosService.create(createProductoDto);
  }

  // Obtener todos los productos
  @Get()
  findAll(): Promise<Producto[]> {
    return this.productosService.findAll();
  }

  // Listar productos de un comercio específico
  @Get('comercio')
  async findAllComercios(
    @Query('comercio_id') comercio_id: number,
  ): Promise<Producto[]> {
    return this.productosService.findAllComercio(comercio_id);
  }

  // Obtener un producto por ID
  @Get(':id')
  findOne(@Param('id') id: string): Promise<Producto> {
    return this.productosService.findOne(+id);
  }
}
