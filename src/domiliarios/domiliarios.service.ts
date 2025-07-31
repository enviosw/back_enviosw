// domiciliarios.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Domiciliario } from './entities/domiliario.entity';

@Injectable()
export class DomiciliariosService {
  constructor(
    @InjectRepository(Domiciliario)
    private readonly domiciliarioRepo: Repository<Domiciliario>,
    private readonly dataSource: DataSource,
  ) { }

  // 🚀 Asignar el próximo domiciliario disponible
  async asignarDomiciliarioDisponible(): Promise<Domiciliario> {
    return await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Domiciliario);

      // 🔐 Bloquea fila para evitar condiciones de carrera
      const domiciliario = await repo
        .createQueryBuilder('d')
        .setLock('pessimistic_write')
        .where('d.estado = true AND d.disponible = true')
        .orderBy('d.turno_orden', 'ASC')
        .getOne();

      if (!domiciliario) {
        throw new NotFoundException('❌ No hay domiciliarios disponibles en este momento.');
      }

      // 🔄 Marca como ocupado y mueve al final
      domiciliario.disponible = false;

      const { max } = await repo
        .createQueryBuilder('d')
        .select('MAX(d.turno_orden)', 'max')
        .getRawOne();

      domiciliario.turno_orden = (max || 0) + 1;

      await repo.save(domiciliario);
      return domiciliario;
    });
  }

  // 🟢 Liberar domiciliario después de completar un pedido
  async liberarDomiciliario(id: number): Promise<void> {
    const domiciliario = await this.domiciliarioRepo.findOneBy({ id });

    if (!domiciliario) {
      throw new NotFoundException(`No se encontró el domiciliario con ID ${id}`);
    }

    domiciliario.disponible = true;
    await this.domiciliarioRepo.save(domiciliario);
  }

  // 🔁 Reiniciar los turnos (opcional para limpiar el sistema)
  async reiniciarTurnos(): Promise<void> {
    const domiciliarios = await this.domiciliarioRepo.find({
      where: { estado: true },
      order: { turno_orden: 'ASC' },
    });

    domiciliarios.forEach((d, index) => {
      d.turno_orden = index + 1;
    });

    await this.domiciliarioRepo.save(domiciliarios);
  }


  // Obtener todos (para debug o UI)
  async getAll(): Promise<Domiciliario[]> {
    return this.domiciliarioRepo.find({ order: { turno_orden: 'ASC' } });
  }

  // Obtener por ID
  async getById(id: number): Promise<Domiciliario | null> {
    return this.domiciliarioRepo.findOneBy({ id });
  }

  async create(data: Partial<Domiciliario>): Promise<Domiciliario> {
    const nuevo = this.domiciliarioRepo.create(data);
    return this.domiciliarioRepo.save(nuevo);
  }

  // ✏️ Actualizar domiciliario
  async update(id: number, data: Partial<Domiciliario>): Promise<Domiciliario> {
    const domiciliario = await this.domiciliarioRepo.findOneBy({ id });
    if (!domiciliario) {
      throw new NotFoundException(`No se encontró domiciliario con ID ${id}`);
    }

    Object.assign(domiciliario, data);
    return this.domiciliarioRepo.save(domiciliario);
  }

  // 🔁 Cambiar estado (activo/inactivo)
  async toggleEstado(id: number): Promise<Domiciliario> {
    const domiciliario = await this.domiciliarioRepo.findOneBy({ id });
    if (!domiciliario) {
      throw new NotFoundException(`No se encontró domiciliario con ID ${id}`);
    }

    domiciliario.estado = !domiciliario.estado;
    return this.domiciliarioRepo.save(domiciliario);
  }


  // 🚀 Verifica si un número de WhatsApp ya existe
  async existeWhatsapp(telefono: string): Promise<boolean> {
    return await this.domiciliarioRepo.exists({
      where: { telefono_whatsapp: telefono },
    });
  }


  // domiciliarios.service.ts
  async esDomiciliario(telefono: string): Promise<boolean> {
    return await this.domiciliarioRepo.exists({
      where: { telefono_whatsapp: telefono },
    });
  }


  // ✅ Cambia el estado de disponibilidad por número de WhatsApp
  // ✅ Cambia el estado de disponibilidad por número de WhatsApp y actualiza turno
  async cambiarDisponibilidadPorTelefono(telefono: string, disponible: boolean): Promise<void> {
    const domiciliario = await this.domiciliarioRepo.findOneBy({ telefono_whatsapp: telefono });

    if (!domiciliario) {
      throw new NotFoundException(`No se encontró domiciliario con teléfono ${telefono}`);
    }

    // ✅ Actualizar turno_orden al valor más alto actual + 1
    const { max } = await this.domiciliarioRepo
      .createQueryBuilder('d')
      .select('MAX(d.turno_orden)', 'max')
      .getRawOne();

    domiciliario.turno_orden = (max || 0) + 1;
    domiciliario.disponible = disponible;

    await this.domiciliarioRepo.save(domiciliario);
  }



}
