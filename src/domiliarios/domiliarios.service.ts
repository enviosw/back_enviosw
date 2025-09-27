// domiciliarios.service.ts
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Domiciliario } from './entities/domiliario.entity';

type ResumenDomiciliario = {
  nombre: string;
  disponible: boolean;
  turno: number; // alias de turno_orden
};
// Configurable (env) o constante
const REOFERTA_COOLDOWN_MS = Number(process.env.REOFERTA_COOLDOWN_MS ?? 120_000); // 2 min

@Injectable()
export class DomiciliariosService {
  constructor(
    @InjectRepository(Domiciliario)
    private readonly domiciliarioRepo: Repository<Domiciliario>,
    private readonly dataSource: DataSource,
  ) { }

  // 🚀 Asignar el próximo domiciliario disponible
async asignarDomiciliarioDisponible(): Promise<Domiciliario> {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Domiciliario);

      // 1) Tomar el siguiente disponible con LOCK (el segundo concurrente esperará).
      const domi = await repo
        .createQueryBuilder('d')
        .where('d.estado = :activo AND d.disponible = :disp', { activo: true, disp: true })
        .orderBy('d.turno_orden', 'ASC')
        .addOrderBy('d.id', 'ASC')
        .setLock('pessimistic_write') // evita que otro hilo lo "coja" al mismo tiempo
        .getOne();

      if (!domi) {
        throw new NotFoundException('❌ No hay domiciliarios disponibles en este momento.');
      }

      // 2) Calcular el nuevo turno_orden de forma segura (max puede venir null/undefined).
      const result = await repo
        .createQueryBuilder('d')
        .select('MAX(d.turno_orden)', 'max')
        .getRawOne<{ max: number | null }>();

      const maxTurno = (result?.max ?? 0);

      // 3) Actualizar flags/turno y persistir dentro de la misma transacción.
      domi.disponible = false;
      domi.turno_orden = maxTurno + 1;

      await repo.save(domi);

      return domi;
    });
  }



// ✅ Toma el siguiente disponible SIN mover turno_orden,
//    priorizando la fecha_actualizacion MÁS ANTIGUA y luego el turno_orden.
async asignarDomiciliarioDisponible2(excluirIds: number[] = []): Promise<Domiciliario> {
  return this.dataSource.transaction(async (manager) => {
    const repo = manager.getRepository(Domiciliario);

    const qb = repo
      .createQueryBuilder('d')
      .where('d.estado = :activo AND d.disponible = :disp', { activo: true, disp: true })
      // (opcional) excluye IDs, p. ej. el que acaba de perder/rechazar este mismo pedido
      .andWhere(excluirIds.length ? 'd.id NOT IN (:...excluir)' : '1=1', { excluir: excluirIds })
      // 👇 clave: primero el MENOS reciente (más antiguo)
      .orderBy('d.fecha_actualizacion', 'ASC')
      .addOrderBy('d.turno_orden', 'ASC')
      .addOrderBy('d.id', 'ASC')
      .setLock('pessimistic_write'); // evita carreras al tomar el registro

    const domi = await qb.getOne();

    if (!domi) {
      throw new NotFoundException('❌ No hay domiciliarios disponibles en este momento.');
    }

    // 👇 cambiar SOLO disponibilidad (NO tocar turno_orden)
    const upd = await repo
      .createQueryBuilder()
      .update(Domiciliario)
      .set({ disponible: false })
      .where('id = :id AND disponible = :disp AND estado = :activo', {
        id: domi.id,
        disp: true,
        activo: true,
      })
      .execute();

    if (!upd.affected) {
      throw new ConflictException('⚠️ El domiciliario ya no está disponible (concurrencia). Reintenta.');
    }

    const domiActualizado = await repo.findOne({ where: { id: domi.id } });
    return domiActualizado as Domiciliario;
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



  async listarResumen(): Promise<{ id: number; nombre: string; telefono_whatsapp: string }[]> {
    const domiciliarios = await this.domiciliarioRepo
      .createQueryBuilder('d')
      .select(['d.id AS id', 'd.nombre AS nombre', 'd.telefono_whatsapp AS telefono_whatsapp'])
      .orderBy('d.turno_orden', 'ASC')
      .getRawMany();

    return domiciliarios;
  }


  // 🚦 Listar por orden de disponibilidad (disponibles primero)
  async listarPorDisponibilidad(): Promise<Domiciliario[]> {
    return this.domiciliarioRepo
      .createQueryBuilder('d')
      .where('d.estado = true')
      .orderBy('d.disponible', 'DESC')   // true primero
      .addOrderBy('d.turno_orden', 'ASC')
      .addOrderBy('d.id', 'ASC')
      .getMany();
  }

  // 🔄 Reiniciar turnos a 0 y dejar no disponibles (solo activos)
  async reiniciarTurnosACeroYNoDisponibles(): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await manager
        .createQueryBuilder()
        .update(Domiciliario)
        .set({ turno_orden: 0, disponible: false })
        .where('estado = :estado', { estado: true })
        .execute();
    });
  }

  async verSiguienteDisponible(): Promise<Domiciliario | null> {
  return this.domiciliarioRepo.findOne({
    where: { estado: true, disponible: true },
    order: { turno_orden: 'ASC', id: 'ASC' },
  });
}

// domiciliarios.service.ts
async getByTelefono(telefono: string): Promise<Domiciliario | null> {
  return this.domiciliarioRepo.findOne({
    where: { telefono_whatsapp: telefono },
  });
}



  // domiciliarios.service.ts
async getEstadoPorTelefono(telefono: string): Promise<{ nombre: string; disponible: boolean; turno: number }> {
  const row = await this.domiciliarioRepo
    .createQueryBuilder('d')
    .select([
      'd.nombre AS nombre',
      'd.disponible AS disponible',
      'd.turno_orden AS turno',
    ])
    .where('d.telefono_whatsapp = :tel', { tel: telefono })
    .getRawOne<{ nombre: string; disponible: any; turno: any }>();

    console.log(row)
  if (!row) {
    throw new NotFoundException(`No se encontró domiciliario con teléfono ${telefono}`);
  }

  return {
    nombre: row.nombre,
    disponible: Boolean(row.disponible),
    turno: Number(row.turno),
  };
}

async setDisponibleManteniendoTurnoById(id: number, disponible = true): Promise<void> {
  const domi = await this.domiciliarioRepo.findOneBy({ id });
  if (!domi) {
    throw new NotFoundException(`No se encontró domiciliario con ID ${id}`);
  }
  domi.disponible = disponible;
  await this.domiciliarioRepo.save(domi); // 👈 persiste de verdad y dispara hooks
}


// ✅ Dejar disponible SIN mover el turno (por teléfono)
async setDisponibleManteniendoTurnoByTelefono(telefono: string, disponible = true): Promise<void> {
  const domi = await this.domiciliarioRepo.findOne({ where: { telefono_whatsapp: telefono } });
  if (!domi) {
    throw new NotFoundException(`No se encontró domiciliario con teléfono ${telefono}`);
  }
  await this.domiciliarioRepo.update({ id: domi.id }, { disponible });
}



}
