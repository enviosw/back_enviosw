// welcome-image.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WelcomeImage } from './entities/welcome-image.entity';

@Injectable()
export class WelcomeImageService {
  constructor(
    @InjectRepository(WelcomeImage)
    private repo: Repository<WelcomeImage>,
  ) {}

  async saveImage(path: string) {
    let image = await this.repo.findOne({
      where: { code: 'WELCOME_IMAGE' },
    });

    if (!image) {
      image = this.repo.create({
        code: 'WELCOME_IMAGE',
        path,
      });
    } else {
      image.path = path;
    }

    return this.repo.save(image);
  }

  async getImage() {
    return this.repo.findOne({ where: { code: 'WELCOME_IMAGE' } });
  }
  
private buildPublicUrl(path: string): string {
  if (!path) return '';

  // Quita "uploads/" o "/uploads/" si viene incluido
  const cleanPath = path.replace(/^\/?uploads\//, '');

  return `${process.env.APP_URL}/${cleanPath}`;
}

  
  async getImage2() {
    const image = await this.repo.findOne({
      where: { code: 'WELCOME_IMAGE' },
    });

    if (!image) return null;

    return {
      ...image,
      path: this.buildPublicUrl(image.path),
    };
  }
}
