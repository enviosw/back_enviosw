// src/shortlinks/shortlinks.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ShortLink } from './entities/shortlink.entity';

@Injectable()
export class ShortlinksService {
  constructor(@InjectRepository(ShortLink) private repo: Repository<ShortLink>) {}

  private slugForCommerce(id: number) {
    return `comercio-${id}`;
  }

  private destinoFinal(id: number) {
    const base = process.env.DESTINO_BASE || 'https://dominio-frontend.com/comercio';
    // Resultado p.ej: https://domiciliosw.com/comercio/39/productos
    return `${base}/${id}/productos`;
  }

  async ensureForCommerce(commerceId: number) {
    const slug = this.slugForCommerce(commerceId);
    let link = await this.repo.findOne({ where: { slug } });
    if (link) return link;

    link = this.repo.create({
      slug,
      commerceId,
      targetUrl: this.destinoFinal(commerceId),
      active: true,
    });
    return this.repo.save(link);
  }

  findBySlug(slug: string) {
    return this.repo.findOne({ where: { slug } });
  }

  async updateTargetToCurrent(commerceId: number) {
    const slug = this.slugForCommerce(commerceId);
    const link = await this.findBySlug(slug);
    if (!link) return null;
    link.targetUrl = this.destinoFinal(commerceId);
    link.updatedAt = new Date();
    return this.repo.save(link);
  }

  async activate(commerceId: number) {
    const slug = this.slugForCommerce(commerceId);
    const link = await this.findBySlug(slug);
    if (!link) return null;
    link.active = true;
    link.updatedAt = new Date();
    return this.repo.save(link);
  }

  async invalidate(commerceId: number) {
    const slug = this.slugForCommerce(commerceId);
    const link = await this.findBySlug(slug);
    if (!link) return null;
    link.active = false;
    link.updatedAt = new Date();
    return this.repo.save(link);
  }
}
