import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Imagen } from './entities/imagene.entity';
import { CreateImagenDto } from './dto/create-imagene.dto';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class ImagenesService {
  constructor(
    @InjectRepository(Imagen)
    private readonly imagenRepo: Repository<Imagen>,
  ) { }

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

  async eliminar(id: number) {
    const imagen = await this.imagenRepo.findOneBy({ id });

    if (!imagen) {
      throw new NotFoundException('Imagen no encontrada');
    }

    // Ruta completa al archivo (desde la raíz del proyecto)
    const rutaArchivo = path.resolve('uploads', imagen.ruta); // ✅ esta línea es clave

    try {
      if (fs.existsSync(rutaArchivo)) {
        await fs.promises.unlink(rutaArchivo);
        console.log(`Archivo eliminado: ${rutaArchivo}`);
      } else {
        console.warn(`Archivo no encontrado en disco: ${rutaArchivo}`);
      }
    } catch (error) {
      console.error('Error al eliminar el archivo físico:', error);
    }

    await this.imagenRepo.delete(id);
    return { message: 'Imagen eliminada correctamente' };
  }
}
