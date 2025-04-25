import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Comercio } from './entities/comercio.entity';
import { CreateComercioDto } from './dto/create-comercio.dto';
import { UpdateComercioDto } from './dto/update-comercio.dto';

@Injectable()
export class ComerciosService {
  constructor(
    @InjectRepository(Comercio)
    private readonly comercioRepo: Repository<Comercio>,
  ) {}

  async create(dto: CreateComercioDto): Promise<Comercio> {
    const comercio = this.comercioRepo.create(dto);
    return await this.comercioRepo.save(comercio);
  }

  async findAll(): Promise<Comercio[]> {
    return await this.comercioRepo.find();
  }

  async findOne(id: number): Promise<Comercio> {
    const comercio = await this.comercioRepo.findOneBy({ id });
    if (!comercio) {
      throw new NotFoundException(`Comercio con ID ${id} no encontrado`);
    }
    return comercio;
  }

  async update(id: number, dto: UpdateComercioDto): Promise<Comercio> {
    const comercio = await this.findOne(id);
    const updated = Object.assign(comercio, dto);
    return await this.comercioRepo.save(updated);
  }

  async remove(id: number): Promise<void> {
    const comercio = await this.findOne(id);
    await this.comercioRepo.remove(comercio);
  }
}
