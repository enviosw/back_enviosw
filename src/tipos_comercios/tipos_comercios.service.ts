import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TipoComercio } from './entities/tipos_comercio.entity';
import { CreateTiposComercioDto } from './dto/create-tipos_comercio.dto';
import { UpdateTiposComercioDto } from './dto/update-tipos_comercio.dto';

@Injectable()
export class TiposComerciosService {
  constructor(
    @InjectRepository(TipoComercio)
    private readonly tipoComercioRepo: Repository<TipoComercio>,
  ) { }

  async create(dto: CreateTiposComercioDto): Promise<TipoComercio> {
    const tipo = this.tipoComercioRepo.create(dto);
    return await this.tipoComercioRepo.save(tipo);
  }

  async findAll(): Promise<TipoComercio[]> {
    return await this.tipoComercioRepo.find();
  }

  async findOne(id: number): Promise<TipoComercio> {
    const tipo = await this.tipoComercioRepo.findOneBy({ id });
    if (!tipo) throw new NotFoundException(`TipoComercio con ID ${id} no existe`);
    return tipo;
  }

  async update(id: number, dto: UpdateTiposComercioDto): Promise<TipoComercio> {
    const tipo = await this.findOne(id);
    const updated = Object.assign(tipo, dto);
    return await this.tipoComercioRepo.save(updated);
  }

  async remove(id: number): Promise<void> {
    const tipo = await this.findOne(id);
    await this.tipoComercioRepo.remove(tipo);
  }
}
