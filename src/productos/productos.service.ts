// src/productos/productos.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Producto } from './entities/producto.entity';
import { CreateProductoDto } from './dto/create-producto.dto';
import { ComerciosService } from 'src/comercios/comercios.service';
import { CategoriasService } from 'src/categorias/categorias.service';

@Injectable()
export class ProductosService {
  constructor(
    @InjectRepository(Producto)
    private productosRepository: Repository<Producto>,
    
    private categoriaServices: CategoriasService,

    private comercioServices: ComerciosService,

  ) {}

  async create(createProductoDto: CreateProductoDto): Promise<Producto> {
    // Buscar la categoría por su ID
    const categoria = await this.categoriaServices.findOne(createProductoDto.categoriaId);

    // Si la categoría no existe, manejar el error
    if (!categoria) {
      throw new Error('Categoría no encontrada');
    }

    // Buscar el comercio por su ID
    const comercio = await this.comercioServices.findOne(createProductoDto.comercioId);

    // Si el comercio no existe, manejar el error
    if (!comercio) {
      throw new Error('Comercio no encontrado');
    }

    const producto = this.productosRepository.create({
      ...createProductoDto,
      categoria,
      comercio,  // Asociamos el producto al comercio
      estado: createProductoDto.estado || 'activo',
      estado_descuento: createProductoDto.estado_descuento || 'inactivo',
    });

    return this.productosRepository.save(producto);
  }

  findAll(): Promise<Producto[]> {
    return this.productosRepository.find({ relations: ['categoria', 'comercio'] });
  }

  // Listar productos de un comercio específico
  async findAllComercio(comercio_id: number): Promise<Producto[]> {
    return this.productosRepository.find({
      where: { comercio: { id: comercio_id } },
      relations: ['categoria'],  // Relacionamos categorías para cada producto
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
