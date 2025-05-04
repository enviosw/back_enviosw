// src/categories/categories.controller.ts
import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import { CategoriasService } from './categorias.service';
import { CreateCategoriaDto } from './dto/create-categoria.dto';
import { Categoria } from './entities/categoria.entity';

@Controller('categorias')
export class CategoriasController {
  constructor(private readonly categoriasService: CategoriasService) {}

  // Crear una categoría
  @Post()
  async create(@Body() createCategoriaDto: CreateCategoriaDto): Promise<Categoria> {
    return this.categoriasService.create(createCategoriaDto);
  }

  // Listar categorías de un comercio específico
  @Get('comercio/:comercioId')
  async findByComercio(@Param('comercioId') comercioId: number): Promise<Categoria[]> {
    return this.categoriasService.findByComercio(comercioId);
  }

  // Obtener todas las categorías
  @Get()
  async findAll(): Promise<Categoria[]> {
    return this.categoriasService.findAll();
  }

  // Obtener una categoría por ID
  @Get(':id')
  async findOne(@Param('id') id: number): Promise<Categoria> {
    return this.categoriasService.findOne(id);
  }
}
