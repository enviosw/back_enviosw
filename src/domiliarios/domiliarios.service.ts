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

  async asignarDomiciliarioDisponible3(zonaId: number): Promise<Domiciliario | null> {
  console.log(`Asignando domiciliario en zona ${zonaId}`);
  return this.dataSource.transaction(async (manager) => {
    const repo = manager.getRepository(Domiciliario);

    // ---- 1) Buscar SOLO en la zona solicitada ----
    const domi = await repo
      .createQueryBuilder('d')
      .where('d.estado = :activo', { activo: true })
      .andWhere('d.disponible = :disp', { disp: true })
      .andWhere('d.zona_id = :zonaId', { zonaId })
      .orderBy('d.turno_orden', 'ASC')
      .addOrderBy('d.id', 'ASC')
      .setLock('pessimistic_write') // FOR UPDATE
      .getOne();

    // ---- 2) Si no hay en esa zona, NO buscar en otras ----
    if (!domi) {
      console.log(`⚠️  No hay domiciliarios disponibles en la zona ${zonaId}.`);
      return null;
    }

    // ---- 3) Intentar marcarlo como no disponible (reserva) ----
    const res = await repo
      .createQueryBuilder()
      .update(Domiciliario)
      .set({ disponible: false })
      .where('id = :id', { id: domi.id })
      .andWhere('disponible = true')
      .andWhere('estado = true')
      // Salvaguarda: que siga en la misma zona durante la reserva
      .andWhere('zona_id = :zonaId', { zonaId })
      .execute();

    // ---- 4) Si no se pudo actualizar, abortar sin asignar ----
    if (!res.affected) {
      console.log(`⚠️  Domiciliario ${domi.id} ya no estaba disponible o cambió de zona.`);
      return null;
    }

    // ---- 5) Devolver registro actualizado ----
    const actualizado = await repo.findOne({ where: { id: domi.id } });
    if (!actualizado) {
      console.log(`⚠️  No fue posible cargar el domiciliario actualizado.`);
      return null;
    }

    return actualizado;
  });
}



  // async asignarDomiciliarioDisponible3(zonaId: number): Promise<Domiciliario | null> {
  //   console.log(`Asignando domiciliario en zona ${zonaId}`);
  //   return this.dataSource.transaction(async (manager) => {
  //     const repo = manager.getRepository(Domiciliario);

  //     // ---- 1) Buscar en la zona solicitada ----
  //     let domi = await repo
  //       .createQueryBuilder('d')
  //       .where('d.estado = :activo', { activo: true })
  //       .andWhere('d.disponible = :disp', { disp: true })
  //       .andWhere('d.zona_id = :zonaId', { zonaId })
  //       .orderBy('d.turno_orden', 'ASC')
  //       .addOrderBy('d.id', 'ASC')
  //       .setLock('pessimistic_write')
  //       .getOne();

  //     // ---- 2) Si no hay en esa zona, intentar en cualquier otra ----
  //     let fueraDeZona = false;
  //     if (!domi) {
  //       console.log(`No hay domiciliarios disponibles en zona ${zonaId}. Buscando en otras zonas...`);
  //       domi = await repo
  //         .createQueryBuilder('d')
  //         .where('d.estado = :activo', { activo: true })
  //         .andWhere('d.disponible = :disp', { disp: true })
  //         .orderBy('d.turno_orden', 'ASC')
  //         .addOrderBy('d.id', 'ASC')
  //         .setLock('pessimistic_write')
  //         .getOne();

  //       if (domi) fueraDeZona = true;
  //     }

  //     // ---- 3) Si sigue sin haber nadie disponible, no hacer nada ----
  //     if (!domi) {
  //       console.log(`⚠️  No hay domiciliarios disponibles en ninguna zona.`);
  //       // No lanzamos excepción: retornamos null para que el flujo superior decida qué hacer.
  //       return null;
  //     }

  //     // ---- 4) Intentar marcarlo como no disponible ----
  //     const res = await repo
  //       .createQueryBuilder()
  //       .update(Domiciliario)
  //       .set({ disponible: false })
  //       .where('id = :id', { id: domi.id })
  //       .andWhere('disponible = true')
  //       .andWhere('estado = true')
  //       .execute();

  //     // ---- 5) Si no se pudo actualizar, abortar sin asignar ----
  //     if (!res.affected) {
  //       console.log(`⚠️  Domiciliario ${domi.id} ya no estaba disponible.`);
  //       return null;
  //     }

  //     // ---- 6) Devolver registro actualizado ----
  //     const actualizado = await repo.findOne({ where: { id: domi.id } });
  //     if (!actualizado) {
  //       console.log(`⚠️  No fue posible cargar el domiciliario actualizado.`);
  //       return null;
  //     }

  //     if (fueraDeZona) {
  //       console.log(
  //         `Domiciliario ${actualizado.id} asignado FUERA de la zona solicitada (zona original ${zonaId}, asignada ${actualizado.zona_id}).`,
  //       );
  //       (actualizado as any).__fueraDeZona = true; // solo marcador temporal, no se guarda en BD
  //     }

  //     return actualizado;
  //   });
  // }


  // ✅ Toma el siguiente disponible SIN mover turno_orden,
 
  async asignarDomiciliarioDisponible2(): Promise<Domiciliario> {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Domiciliario);

      // Toma el primero por turno, pero NO cambia su turno_orden
      const domi = await repo
        .createQueryBuilder('d')
        .where('d.estado = :activo AND d.disponible = :disp', { activo: true, disp: true })
        .orderBy('d.turno_orden', 'ASC')
        .addOrderBy('d.id', 'ASC')
        .setLock('pessimistic_write')
        .getOne();

      if (!domi) {
        throw new NotFoundException('No hay domiciliarios disponibles en este momento.');
      }

      // Solo lo pone como NO disponible (no mueve el turno)
      await repo
        .createQueryBuilder()
        .update(Domiciliario)
        .set({ disponible: false })
        .where('id = :id AND disponible = true AND estado = true', { id: domi.id })
        .execute();

      const actualizado = await repo.findOne({ where: { id: domi.id } });
      if (!actualizado) {
        throw new NotFoundException('No fue posible actualizar el domiciliario seleccionado.');
      }
      return actualizado;
    });
  }



  async liberarDomiciliario(id: number, moverAlFinal = false): Promise<void> {
    await this.domiciliarioRepo.manager.transaction(async (manager) => {
      const repo = manager.getRepository(Domiciliario);

      // Lock pesimista para evitar carreras al liberar/asignar
      const domi = await repo
        .createQueryBuilder('d')
        .where('d.id = :id', { id })
        .setLock('pessimistic_write')
        .getOne();

      if (!domi) {
        throw new NotFoundException(`No se encontró el domiciliario con ID ${id}`);
      }

      // Armar el update: por defecto solo disponible=true
      const update: Partial<Domiciliario> = { disponible: true };

      // (Opcional) Mover su turno al final de la cola
      if (moverAlFinal) {
        const result = await repo
          .createQueryBuilder('d')
          .select('MAX(d.turno_orden)', 'max')
          .getRawOne<{ max: number | null }>(); // puede ser undefined

        const maxTurno = result?.max ?? 0;
        update.turno_orden = maxTurno + 1;
      }

      await repo
        .createQueryBuilder()
        .update(Domiciliario)
        .set(update)
        .where('id = :id', { id })
        .execute();
    });
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
  async cambiarDisponibilidadPorTelefono(telefono: string, disponible: boolean, zonaId?: number | null, // <- opcional
  ): Promise<void> {
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
    // ✅ Solo tocar zona si el caller envía el parámetro
    if (zonaId !== undefined) {
      // puede ser number o null (para quitar la zona)
      domiciliario.zona_id = zonaId;
    }


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
  async getEstadoPorTelefono(
    telefono: string,
  ): Promise<{ nombre: string; disponible: boolean; turno: number; zona_id: number | null }> {
    const row = await this.domiciliarioRepo
      .createQueryBuilder('d')
      .select([
        'd.nombre AS nombre',
        'd.disponible AS disponible',
        'd.turno_orden AS turno',
        'd.zona_id AS zona_id', // ✅ incluimos la zona
      ])
      .where('d.telefono_whatsapp = :tel', { tel: telefono })
      .getRawOne<{ nombre: string; disponible: any; turno: any; zona_id: any }>();

    console.log(row);

    if (!row) {
      throw new NotFoundException(`No se encontró domiciliario con teléfono ${telefono}`);
    }

    return {
      nombre: row.nombre,
      disponible: Boolean(row.disponible),
      turno: Number(row.turno),
      zona_id: row.zona_id !== null ? Number(row.zona_id) : null, // ✅ parsea null correctamente
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


  // 🔥 Eliminar (hard delete) un domiciliario por ID
  async deleteById(id: number): Promise<void> {
    const exists = await this.domiciliarioRepo.exists({ where: { id } });
    if (!exists) {
      throw new NotFoundException(`No se encontró domiciliario con ID ${id}`);
    }
    await this.domiciliarioRepo.delete(id);
  }


  async actualizarZonaPorTelefono(telefono: string, zonaId: number | null): Promise<Domiciliario> {
    if (zonaId !== null && Number.isNaN(Number(zonaId))) {
      throw new ConflictException('El zonaId debe ser un número o null.');
    }

    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Domiciliario);

      const domi = await repo
        .createQueryBuilder('d')
        .where('d.telefono_whatsapp = :tel', { tel: telefono })
        .setLock('pessimistic_write')
        .getOne();

      if (!domi) {
        throw new NotFoundException(`No se encontró domiciliario con teléfono ${telefono}`);
      }

      await repo
        .createQueryBuilder()
        .update(Domiciliario)
        .set({ zona_id: zonaId })
        .where('id = :id', { id: domi.id })
        .execute();

      const actualizado = await repo.findOne({ where: { id: domi.id } });
      if (!actualizado) {
        throw new NotFoundException('No fue posible cargar el domiciliario actualizado.');
      }
      return actualizado;
    });
  }

}
