// src/productos/productos.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Producto } from './entities/producto.entity';
import { Categoria } from 'src/categorias/entities/categoria.entity';
import { CreateProductoDto } from './dto/create-producto.dto';

@Injectable()
export class ProductosService {
  constructor(
    @InjectRepository(Producto)
    private productosRepository: Repository<Producto>,
    @InjectRepository(Categoria)
    private categoriesRepository: Repository<Categoria>,
  ) {}

  async create(createProductoDto: CreateProductoDto): Promise<Producto> {
    // Buscar la categoría por su ID usando 'where' para pasar el objeto con el id
    const categoria = await this.categoriesRepository.findOne({
      where: { id: createProductoDto.categoriaId },
    });

    // Si la categoría no existe, puedes manejar el error aquí
    if (!categoria) {
      throw new Error('Categoría no encontrada');
    }

    const producto = this.productosRepository.create({
      ...createProductoDto,
      categoria,
      estado: createProductoDto.estado || 'activo',
      estado_descuento: createProductoDto.estado_descuento || 'inactivo',
    });

    return this.productosRepository.save(producto);
  }
  findAll(): Promise<Producto[]> {
    return this.productosRepository.find({ relations: ['categoria'] });
  }

  findAllComercio(comercio_id: number): Promise<Producto[]> {
    return this.productosRepository.find({
      where: { comercio: { id: comercio_id } },
      relations: ['categoria'],
    });
  }

  async findOne(id: number): Promise<Producto> {
    const producto = await this.productosRepository.findOne({
      where: { id },
    });

    if (!producto) {
      throw new Error('Producto no encontrado');
    }

    return producto;
  }
}
