// src/productos/productos.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Brackets } from 'typeorm';
import { Producto } from './entities/producto.entity';
import { CreateProductoDto } from './dto/create-producto.dto';
import { ComerciosService } from '../comercios/comercios.service';
import { CategoriasService } from '../categorias/categorias.service';
import { ProductoQuery } from './interfaces/producto-query.interface';

@Injectable()
export class ProductosService {
  constructor(
    @InjectRepository(Producto)
    private productosRepository: Repository<Producto>,
    private categoriaServices: CategoriasService,
    private comercioServices: ComerciosService,
  ) { }

  async create(createProductoDto: CreateProductoDto): Promise<Producto> {
    const categoria = await this.categoriaServices.findOne(createProductoDto.categoriaId);
    if (!categoria) throw new Error('Categoría no encontrada');

    const comercio = await this.comercioServices.findOne(createProductoDto.comercioId);
    if (!comercio) throw new Error('Comercio no encontrado');

    console.log("img", createProductoDto.imagen_url)

    const producto = this.productosRepository.create({
      ...createProductoDto,
      categoria,
      comercio,
      estado: createProductoDto.estado || 'activo',
      estado_descuento: createProductoDto.estado_descuento || 'inactivo',
    });

    return this.productosRepository.save(producto);
  }

  async findAll(query: ProductoQuery) {
    const take = query.take ? Math.min(query.take, 100) : 20;
    const page = query.page && query.page > 0 ? query.page : 1;
    const skip = (page - 1) * take;

    const qb = this.productosRepository
      .createQueryBuilder('producto')
      .leftJoinAndSelect('producto.categoria', 'categoria')
      .leftJoinAndSelect('producto.comercio', 'comercio');

    if (query.search) {
      const palabras = query.search.trim().split(/\s+/);
      palabras.forEach((palabra, i) => {
        const param = `palabra${i}`;
        qb.andWhere(new Brackets(qb1 => {
          qb1.where(`producto.nombre ILIKE :${param}`, { [param]: `%${palabra}%` })
            .orWhere(`producto.descripcion ILIKE :${param}`, { [param]: `%${palabra}%` });
        }));
      });
    }

    if (query.estado) {
      qb.andWhere('producto.estado = :estado', { estado: query.estado });
    }

    if (query.categoriaId) {
      qb.andWhere('categoria.id = :categoriaId', { categoriaId: query.categoriaId });
    }

    if (query.comercioId) {
      qb.andWhere('comercio.id = :comercioId', { comercioId: query.comercioId });
    }

    qb.orderBy('producto.fecha_creacion', 'DESC').skip(skip).take(take);

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      total,
      page,
      lastPage: Math.ceil(total / take),
    };
  }

  async findOne(id: number): Promise<Producto> {
    const producto = await this.productosRepository.findOne({
      where: { id },
      relations: ['categoria', 'comercio'],
    });
    if (!producto) throw new Error('Producto no encontrado');
    return producto;
  }



  async findProductosByComercio(
    comercioId: number,
    categoriaId?: number,
    search: string = '',
    page: number = 1,
  ): Promise<{ data: Producto[]; total: number; page: number; lastPage: number }> {
    const take = 25;
    const skip = (page - 1) * take;

    const qb = this.productosRepository
      .createQueryBuilder('producto')
      .leftJoinAndSelect('producto.categoria', 'categoria')
      .where('producto.comercio = :comercioId', { comercioId });

    if (categoriaId) {
      qb.andWhere('producto.categoria = :categoriaId', { categoriaId });
    }

    if (search.trim()) {
      const palabras = search.trim().split(/\s+/);

      palabras.forEach((palabra, index) => {
        const param = `palabra${index}`;
        qb.andWhere(
          `(
          producto.nombre ILIKE :${param} OR
          producto.descripcion ILIKE :${param} OR
          producto.unidad ILIKE :${param}
        )`,
          { [param]: `%${palabra}%` },
        );
      });
    }

    qb.select([
      'producto.id',
      'producto.nombre',
      'producto.descripcion',
      'producto.precio',
      'producto.precio_descuento',
      'producto.estado',
      'producto.estado_descuento',
      'producto.unidad',
      'producto.imagen_url',
      'producto.fecha_creacion',
      'producto.fecha_actualizacion',
      'categoria'
    ])
      .orderBy('producto.fecha_creacion', 'DESC')
      .skip(skip)
      .take(take);

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      total,
      page,
      lastPage: Math.ceil(total / take),
    };
  }


  async update(id: number, updateProductoDto: CreateProductoDto): Promise<Producto> {
    const producto = await this.findOne(id);

    if (updateProductoDto.categoriaId) {
      const categoria = await this.categoriaServices.findOne(updateProductoDto.categoriaId);
      if (!categoria) throw new Error('Categoría no encontrada');
      producto.categoria = categoria;
    }

    if (updateProductoDto.comercioId) {
      const comercio = await this.comercioServices.findOne(updateProductoDto.comercioId);
      if (!comercio) throw new Error('Comercio no encontrado');
      producto.comercio = comercio;
    }

    Object.assign(producto, {
      ...updateProductoDto,
      estado: updateProductoDto.estado || producto.estado,
      estado_descuento: updateProductoDto.estado_descuento || producto.estado_descuento,
      imagen_url: updateProductoDto.imagen_url || producto.imagen_url,
    });

    return this.productosRepository.save(producto);
  }


}