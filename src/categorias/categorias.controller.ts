// src/categories/categories.controller.ts
import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { CategoriasService } from './categorias.service';
import { Categoria } from './entities/categoria.entity';

@Controller('categories')
export class CategoriasController {
  constructor(private readonly categoriesService: CategoriasService) {}

  @Post()
  create(@Body() createCategoryDto: { nombre: string }): Promise<Categoria> {
    return this.categoriesService.create(createCategoryDto.nombre);
  }

  @Get()
  findAll(): Promise<Categoria[]> {
    return this.categoriesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<Categoria> {
    return this.categoriesService.findOne(+id);
  }
}
