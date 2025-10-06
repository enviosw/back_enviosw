import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Zona } from './entities/zona.entity';
import { CreateZonaDto } from './dto/create-zona.dto';
import { UpdateZonaDto } from './dto/update-zona.dto';

@Injectable()
export class ZonasService {
  constructor(
    @InjectRepository(Zona)
    private readonly zonasRepo: Repository<Zona>,
  ) {}

  async create(createZonaDto: CreateZonaDto): Promise<Zona> {
    const zona = this.zonasRepo.create(createZonaDto);
    return this.zonasRepo.save(zona);
  }

  async findAll(): Promise<Zona[]> {
    return this.zonasRepo.find({
      order: { id: 'ASC' },
    });
  }

  async findOne(id: number): Promise<Zona> {
    const zona = await this.zonasRepo.findOne({ where: { id } });
    if (!zona) throw new NotFoundException(`Zona #${id} no encontrada`);
    return zona;
  }

  async update(id: number, updateZonaDto: UpdateZonaDto): Promise<Zona> {
    const zona = await this.findOne(id);
    Object.assign(zona, updateZonaDto);
    return this.zonasRepo.save(zona);
  }

  async remove(id: number): Promise<void> {
    const zona = await this.findOne(id);
    await this.zonasRepo.remove(zona);
  }
}
