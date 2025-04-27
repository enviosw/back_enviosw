import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Servicio } from './entities/servicio.entity';
import { CreateServicioDto } from './dto/create-servicio.dto';
import { UpdateServicioDto } from './dto/update-servicio.dto';

@Injectable()
export class ServiciosService {
  constructor(
    @InjectRepository(Servicio)
    private readonly servicioRepo: Repository<Servicio>,
  ) { }

  // Crear un nuevo servicio
  async create(createServicioDto: CreateServicioDto): Promise<Servicio> {
    const servicio = this.servicioRepo.create(createServicioDto);
    return await this.servicioRepo.save(servicio);
  }

  // Obtener todos los servicios
  async findAll(): Promise<Servicio[]> {
    return await this.servicioRepo.find();
  }

  // Obtener un servicio por su ID
  async findOne(id: number): Promise<Servicio> {
    const servicio = await this.servicioRepo.findOne({
      where: { id },
      relations: ['tipo'],  // Si deseas cargar la relación 'tipo'
    });

    if (!servicio) {
      throw new NotFoundException(`Servicio con ID ${id} no encontrado`);
    }

    return servicio;
  }

  // Actualizar un servicio
  async update(id: number, updateServicioDto: UpdateServicioDto): Promise<Servicio> {
    const servicio = await this.findOne(id);
    const updated = Object.assign(servicio, updateServicioDto);
    return await this.servicioRepo.save(updated);
  }

  // Eliminar un servicio
  async remove(id: number): Promise<void> {
    const servicio = await this.findOne(id);
    await this.servicioRepo.remove(servicio);
  }
}
