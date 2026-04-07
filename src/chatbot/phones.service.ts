import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';

import { Phone } from './entities/phone.entity';
import { CreatePhoneDto } from './dto/create-phone.dto';

@Injectable()
export class PhonesService {
  constructor(
    @InjectRepository(Phone)
    private readonly phoneRepo: Repository<Phone>,
  ) {}

  async create(dto: CreatePhoneDto): Promise<Phone> {
    const exists = await this.phoneRepo.exists({
      where: { value: dto.value },
    });

    if (exists) {
      throw new ConflictException('Ese número ya existe');
    }

    const phone = this.phoneRepo.create({
      value: dto.value,
      key: randomUUID(),
    });

    return this.phoneRepo.save(phone);
  }

  findByKey(key: string): Promise<Phone | null> {
    return this.phoneRepo.findOne({ where: { key } });
  }

  findAll(): Promise<Phone[]> {
    return this.phoneRepo.find();
  }

  // 👇 SOLO LECTURA, SIN FALLBACK (tu método)
  async getNumeroByKey(key: string): Promise<string | null> {
    if (!(this as any)._cache) {
      (this as any)._cache = new Map<string, string>();
    }

    const cache: Map<string, string> = (this as any)._cache;

    const cached = cache.get(key);
    if (cached) return cached;

    const phone = await this.findByKey(key);
    if (!phone?.value) return null;

    cache.set(key, phone.value);
    return phone.value;
  }

  // ✅ Seeder (tu método)
  async createFromSeed(data: { key: string; value: string }): Promise<Phone> {
    const existsKey = await this.phoneRepo.exists({ where: { key: data.key } });
    if (existsKey) {
      return (await this.findByKey(data.key)) as Phone;
    }

    const existsValue = await this.phoneRepo.exists({ where: { value: data.value } });
    if (existsValue) {
      const existente = await this.phoneRepo.findOne({ where: { value: data.value } });
      return existente as Phone;
    }

    const phone = this.phoneRepo.create({
      key: data.key,
      value: data.value,
    });

    return this.phoneRepo.save(phone);
  }

  // =============================
  // ✅ NUEVO: LISTAR/ACTUALIZAR POR CLAVE FIJA
  // =============================

  // CUENTAS
  async getCuentas(): Promise<Phone> {
    const phone = await this.findByKey('CUENTAS');
    if (!phone) throw new NotFoundException('No existe la clave CUENTAS');
    return phone;
  }

  async updateCuentas(value: string): Promise<Phone> {
    return this.updateValueByKey('CUENTAS', value);
  }

  // QUEJAS
  async getQuejas(): Promise<Phone> {
    const phone = await this.findByKey('QUEJAS');
    if (!phone) throw new NotFoundException('No existe la clave QUEJAS');
    return phone;
  }

  async updateQuejas(value: string): Promise<Phone> {
    return this.updateValueByKey('QUEJAS', value);
  }

  // Helper interno reutilizable
  private async updateValueByKey(key: string, value: string): Promise<Phone> {
    const phone = await this.findByKey(key);
    if (!phone) throw new NotFoundException(`No existe la clave ${key}`);

    // evita choque con unique(value)
    const existsValue = await this.phoneRepo.exists({ where: { value } });
    if (existsValue && phone.value !== value) {
      throw new ConflictException('Ese número ya existe');
    }

    phone.value = value;
    const saved = await this.phoneRepo.save(phone);

    // si usas cache en getNumeroByKey, invalida la key
    if ((this as any)._cache) {
      const cache: Map<string, string> = (this as any)._cache;
      cache.delete(key);
    }

    return saved;
  }
}
