// src/categories/categories.controller.ts
import { Controller, Post, Body, Get, Param, Patch, Delete, UseGuards, Req } from '@nestjs/common';
import { CategoriasService } from './categorias.service';
import { CreateCategoriaDto } from './dto/create-categoria.dto';
import { Categoria } from './entities/categoria.entity';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AuthGuard } from '../auth/auth.guard';

@Controller('categorias')
export class CategoriasController {
  constructor(private readonly categoriasService: CategoriasService) { }

  // Crear una categoría
  @Post()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('aliado')
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
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('aliado')
  async findAll(@Req() req: any): Promise<Categoria[]> {
    console.log('👉 Usuario autenticado:', req.user);

    return this.categoriasService.findAll();
  }

  // Obtener una categoría por ID
  @Get(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('aliado')
  async findOne(@Param('id') id: number): Promise<Categoria> {
    return this.categoriasService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('aliado')
  async update(@Param('id') id: number, @Body() updateCategoriaDto: { nombre: string }): Promise<Categoria> {
    return this.categoriasService.update(id, updateCategoriaDto);
  }

  @Delete(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('aliado')
  async remove(@Param('id') id: number): Promise<void> {
    return this.categoriasService.remove(id);
  }
}
