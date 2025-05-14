import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Comercio } from './entities/comercio.entity';
import { CreateComercioDto } from './dto/create-comercio.dto';
import { UpdateComercioDto } from './dto/update-comercio.dto';
import { ComercioQuery } from './interfaces/comercio.interface';

@Injectable()
export class ComerciosService {
  constructor(
    @InjectRepository(Comercio)
    private readonly comercioRepo: Repository<Comercio>,
  ) { }

  // Crear un nuevo comercio
  async create(dto: CreateComercioDto): Promise<Comercio> {
    const comercio = this.comercioRepo.create({
      ...dto,
      servicio: { id: dto.servicio_id, estado: 'activo' },
    });

    console.log(comercio);
    return await this.comercioRepo.save(comercio);
  }

  async searchAll(search: string) {
    const qb = this.comercioRepo
      .createQueryBuilder('comercio')
      .leftJoinAndSelect('comercio.servicio', 'servicio');

    if (search) {
      const palabras = search.trim().split(/\s+/);

      palabras.forEach((palabra, index) => {
        const param = `palabra${index}`;
        qb.andWhere(
          `(
            comercio.nombre_comercial ILIKE :${param} OR 
            comercio.razon_social ILIKE :${param} OR 
            comercio.nit ILIKE :${param} OR 
            comercio.descripcion ILIKE :${param} OR 
            comercio.responsable ILIKE :${param} OR 
            comercio.email_contacto ILIKE :${param} OR 
            comercio.telefono ILIKE :${param} OR 
            comercio.telefono_secundario ILIKE :${param} OR 
            comercio.direccion ILIKE :${param}
          )`,
          { [param]: `%${palabra}%` },
        );
      });
    }

    qb.orderBy('comercio.fecha_creacion', 'DESC');

    const resultados = await qb.getMany();
    return resultados;
  }


  // Obtener todos los comercios
  async findAll(query: ComercioQuery) {
    const take = 20;
    const skip = (query.page - 1) * take;

    const qb = this.comercioRepo
      .createQueryBuilder('comercio')
      .leftJoinAndSelect('comercio.servicio', 'servicio'); // ⬅️ Aquí se une la relación

    if (query.search) {
      const palabras = query.search.trim().split(/\s+/);

      palabras.forEach((palabra, index) => {
        const param = `palabra${index}`;
        qb.andWhere(
          `(
            comercio.nombre_comercial ILIKE :${param} OR 
            comercio.razon_social ILIKE :${param} OR 
            comercio.nit ILIKE :${param} OR 
            comercio.descripcion ILIKE :${param} OR 
            comercio.responsable ILIKE :${param} OR 
            comercio.email_contacto ILIKE :${param} OR 
            comercio.telefono ILIKE :${param} OR 
            comercio.telefono_secundario ILIKE :${param} OR 
            comercio.direccion ILIKE :${param}
          )`,
          { [param]: `%${palabra}%` },
        );
      });
    }

    if (query.estado) {
      qb.andWhere('comercio.estado = :estado', { estado: query.estado });
    }

    if (query.fechaInicio && query.fechaFin) {
      qb.andWhere('comercio.fecha_creacion BETWEEN :inicio AND :fin', {
        inicio: query.fechaInicio,
        fin: query.fechaFin,
      });
    }

    qb.skip(skip).take(take).orderBy('comercio.fecha_creacion', 'DESC');

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      total,
      page: query.page,
      lastPage: Math.ceil(total / take),
    };
  }

  // Obtener un comercio por su ID
  async findOne(id: number): Promise<Comercio> {
    const comercio = await this.comercioRepo.findOneBy({ id });
    if (!comercio) {
      throw new NotFoundException(`Comercio con ID ${id} no encontrado`);
    }
    return comercio;
  }

  // Actualizar un comercio
  async update(id: number, dto: UpdateComercioDto): Promise<Comercio> {
    const comercio = await this.comercioRepo.findOne({ where: { id } });

    if (!comercio) {
      throw new NotFoundException(`Comercio con ID ${id} no encontrado`);
    }

    Object.assign(comercio, {
      ...dto,
      servicio: dto.servicio_id ? { id: dto.servicio_id } : comercio.servicio,
    });

    return await this.comercioRepo.save(comercio);
  }

  // Eliminar un comercio
  async remove(id: number): Promise<void> {
    const comercio = await this.findOne(id);
    await this.comercioRepo.remove(comercio);
  }

  async findComerciosByServicio(
    servicioId: number,
    search: string = '',
    page: number = 1,
  ): Promise<{ data: Comercio[]; total: number; page: number; lastPage: number }> {
    const take = 25;
    const skip = (page - 1) * take;

    const qb = this.comercioRepo
      .createQueryBuilder('comercio')
      .leftJoinAndSelect('comercio.servicio', 'servicio')
      .where('servicio.id = :servicioId', { servicioId });

    if (search.trim()) {
      const palabras = search.trim().split(/\s+/);

      palabras.forEach((palabra, index) => {
        const param = `palabra${index}`;
        qb.andWhere(
          `(
          comercio.nombre_comercial ILIKE :${param} OR 
          comercio.razon_social ILIKE :${param} OR 
          comercio.nit ILIKE :${param} OR 
          comercio.descripcion ILIKE :${param} OR 
          comercio.responsable ILIKE :${param} OR 
          comercio.email_contacto ILIKE :${param} OR 
          comercio.telefono ILIKE :${param} OR 
          comercio.telefono_secundario ILIKE :${param} OR 
          comercio.direccion ILIKE :${param}
        )`,
          { [param]: `%${palabra}%` },
        );
      });
    }

    qb.select([
      'comercio.id',
      'comercio.nombre_comercial',
      'comercio.descripcion',
      'comercio.responsable',
      'comercio.email_contacto',
      'comercio.telefono',
      'comercio.telefono_secundario',
      'comercio.direccion',
      'comercio.logo_url',
      'comercio.estado',
      'comercio.fecha_creacion',
      'comercio.fecha_actualizacion',
      'comercio.horarios',
      'servicio'
    ])
      .orderBy('comercio.fecha_creacion', 'DESC')
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




  // Obtener los horarios de un comercio por su ID
  async getHorariosByComercio(id: number): Promise<any> {
    const comercio = await this.comercioRepo.findOne({
      where: { id },
      select: ['horarios'], // Solo seleccionamos los horarios
    });

    if (!comercio) {
      throw new NotFoundException(`Comercio con ID ${id} no encontrado`);
    }

    return comercio.horarios;
  }

  // Actualizar los horarios de un comercio
  async updateHorarios(id: number, horarios: any): Promise<Comercio> {
    const comercio = await this.comercioRepo.findOne({ where: { id } });

    if (!comercio) {
      throw new NotFoundException(`Comercio con ID ${id} no encontrado`);
    }

    comercio.horarios = horarios; // Actualizamos los horarios
    return await this.comercioRepo.save(comercio);
  }

}
