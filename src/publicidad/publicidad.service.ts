import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Publicidad } from './entities/publicidad.entity';
import { CreatePublicidadDto } from './dto/create-publicidad.dto';
import { UpdatePublicidadDto } from './dto/update-publicidad.dto';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class PublicidadService {
  constructor(
    @InjectRepository(Publicidad)
    private readonly repo: Repository<Publicidad>,
  ) {}

  private buildPublicUrl(filename: string) {
    // OJO: esto asume que expones /uploads como estático
    return `/uploads/${filename}`;
  }

  private deleteFileByPublicUrl(publicUrl?: string) {
    if (!publicUrl) return;

    // publicUrl: /uploads/xxxx.png
    const filename = publicUrl.replace('/uploads/', '');
    const fullPath = path.join(process.cwd(), 'uploads', filename);

    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  }

  private handleUpload(file?: Express.Multer.File) {
    if (!file?.filename) return undefined;
    return this.buildPublicUrl(file.filename);
  }

  async create(dto: CreatePublicidadDto, file?: Express.Multer.File) {
    const imagenUrl = this.handleUpload(file);

    const pub = this.repo.create({
      imagen: imagenUrl ?? dto['imagen'] ?? '',
      ruta: dto.ruta,
      estado: dto.estado ?? 1,
      orden: dto['orden'] ?? 1,
      fecha_inicio: (dto as any).fecha_inicio ?? null,
      fecha_fin: (dto as any).fecha_fin ?? null,
    });

    await this.repo.save(pub);
    return pub;
  }

  async findAll() {
    return this.repo.find({ order: { orden: 'ASC', updated_at: 'DESC' } });
  }

  async findVigentesParaSlider() {
    return this.repo
      .createQueryBuilder('p')
      .where('p.estado = :activo', { activo: 1 })
      .andWhere('(p.fecha_inicio IS NULL OR p.fecha_inicio <= NOW())')
      .andWhere('(p.fecha_fin IS NULL OR p.fecha_fin >= NOW())')
      .orderBy('p.orden', 'ASC')
      .getMany();
  }

  async findOne(id: number) {
    const pub = await this.repo.findOne({ where: { id } });
    if (!pub) throw new NotFoundException('Publicidad no encontrada');
    return pub;
  }

  async update(id: number, dto: UpdatePublicidadDto, file?: Express.Multer.File) {
    const pub = await this.findOne(id);

    if (file?.filename) {
      const newUrl = this.handleUpload(file);
      if (newUrl) {
        this.deleteFileByPublicUrl(pub.imagen);
        pub.imagen = newUrl;
      }
    }

    if (dto.ruta !== undefined) pub.ruta = dto.ruta;
    if (dto.estado !== undefined) pub.estado = dto.estado;
    if ((dto as any).orden !== undefined) pub.orden = (dto as any).orden;
    if ((dto as any).fecha_inicio !== undefined) pub.fecha_inicio = (dto as any).fecha_inicio as any;
    if ((dto as any).fecha_fin !== undefined) pub.fecha_fin = (dto as any).fecha_fin as any;

    await this.repo.save(pub);
    return pub;
  }

  async remove(id: number) {
    const pub = await this.findOne(id);
    this.deleteFileByPublicUrl(pub.imagen);
    await this.repo.delete(id);
    return { ok: true };
  }
}
