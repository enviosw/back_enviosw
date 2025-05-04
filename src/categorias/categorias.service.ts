// src/categories/categories.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Categoria } from './entities/categoria.entity';
import { CreateCategoriaDto } from './dto/create-categoria.dto';
import { ComerciosService } from 'src/comercios/comercios.service';

@Injectable()
export class CategoriasService {
  constructor(
    @InjectRepository(Categoria)
    private categoriesRepository: Repository<Categoria>,

    private comercioServices: ComerciosService,
  ) { }

  // Crear una categoría asociada a un comercio
  async create(createCategoriaDto: CreateCategoriaDto): Promise<Categoria> {
    const { nombre, comercioId } = createCategoriaDto;

    const comercio = await this.comercioServices.findOne(comercioId);

    if (!comercio) {
      throw new Error('Comercio no encontrado');
    }

    const categoria = this.categoriesRepository.create({
      nombre,
      comercio, // Asociamos la categoría al comercio
    });

    return this.categoriesRepository.save(categoria);
  }

  // Listar categorías solo de un comercio específico
  async findByComercio(comercioId: number): Promise<Categoria[]> {
    return this.categoriesRepository.find({ where: { comercio: { id: comercioId } } });
  }

  // Obtener todas las categorías
  async findAll(): Promise<Categoria[]> {
    return this.categoriesRepository.find();
  }

  // Obtener una categoría por ID
  async findOne(id: number): Promise<Categoria> {
    const categoria = await this.categoriesRepository.findOne({
      where: { id },
    });

    if (!categoria) {
      throw new Error('Categoría no encontrada');
    }

    return categoria;
  }
}
