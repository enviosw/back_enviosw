// src/categories/categories.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Categoria } from './entities/categoria.entity';

@Injectable()
export class CategoriasService {
  constructor(
    @InjectRepository(Categoria)
    private categoriesRepository: Repository<Categoria>,
  ) { }

  async create(nombre: string): Promise<Categoria> {
    const categoria = this.categoriesRepository.create({ nombre });
    return this.categoriesRepository.save(categoria);
  }

  async findAll(): Promise<Categoria[]> {
    return this.categoriesRepository.find();
  }

  async findOne(id: number): Promise<Categoria> {

    const categoria = await this.categoriesRepository.findOne({ where: { id } });

    if (!categoria) {
      throw new Error('Categegoria no encontrada');
    }

    return categoria
  }
}
