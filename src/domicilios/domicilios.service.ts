import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindManyOptions, Repository } from 'typeorm';
import { Domicilio } from './entities/domicilio.entity';
import { CreateDomicilioDto } from './dto/create-domicilio.dto';
import { UpdateDomicilioDto } from './dto/update-domicilio.dto';

@Injectable()
export class DomiciliosService {
  constructor(
    @InjectRepository(Domicilio)
    private readonly domicilioRepo: Repository<Domicilio>,
  ) { }

  // 🆕 Crear un nuevo domicilio
  async create(createDomicilioDto: CreateDomicilioDto): Promise<Domicilio> {
    const nuevo = this.domicilioRepo.create(createDomicilioDto);
    return this.domicilioRepo.save(nuevo);
  }

  // 📄 Obtener todos los domicilios
  async findAll(): Promise<Domicilio[]> {
    return this.domicilioRepo.find({
      relations: ['domiciliario', 'cliente'],
      order: { fecha_creacion: 'DESC' },
    });
  }


  // ✅ GENÉRICO: buscar con opciones (para el CRON de reintentos)
  async find(options: FindManyOptions<Domicilio>): Promise<Domicilio[]> {
    return this.domicilioRepo.find(options);
  }

  // 🔎 Obtener uno por ID
  async findOne(id: number): Promise<Domicilio> {
    const domicilio = await this.domicilioRepo.findOne({
      where: { id },
      relations: ['domiciliario', 'cliente'],
    });

    if (!domicilio) {
      throw new NotFoundException(`Domicilio con ID ${id} no encontrado`);
    }

    return domicilio;
  }

  // ✏️ Actualizar un domicilio
  async update(id: number, dto: UpdateDomicilioDto): Promise<Domicilio> {
    const domicilio = await this.findOne(id);

    Object.assign(domicilio, dto);
    return this.domicilioRepo.save(domicilio);
  }

  // ❌ Eliminar (borrado real)
  async remove(id: number): Promise<void> {
    const domicilio = await this.findOne(id);
    await this.domicilioRepo.remove(domicilio);
  }

  async findPendientes(numero_cliente?: string): Promise<Domicilio[]> {
    const query = this.domicilioRepo
      .createQueryBuilder('domicilio')
      .where('domicilio.estado = :estado', { estado: 0 })
      .orderBy('domicilio.fecha_creacion', 'DESC');

    if (numero_cliente) {
      query.andWhere('domicilio.numero_cliente LIKE :numero', {
        numero: `%${numero_cliente}%`,
      });
    }

    return await query.getMany();
  }


  

}
