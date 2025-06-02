import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Imagen } from './entities/imagene.entity';
import { CreateImagenDto } from './dto/create-imagene.dto';

@Injectable()
export class ImagenesService {
  constructor(
    @InjectRepository(Imagen)
    private readonly imagenRepo: Repository<Imagen>,
  ) {}

  async crear(dto: CreateImagenDto, filename: string): Promise<Imagen> {
    const imagen = this.imagenRepo.create({
      nombre: dto.nombre,
      ruta: filename,
    });
    return this.imagenRepo.save(imagen);
  }

  async listar(): Promise<Imagen[]> {
    return this.imagenRepo.find();
  }

  async eliminar(id: number): Promise<void> {
    await this.imagenRepo.delete(id);
  }
}
