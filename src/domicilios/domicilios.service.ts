import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, DeepPartial, FindManyOptions, Repository } from 'typeorm';
import { Domicilio } from './entities/domicilio.entity';
import { CreateDomicilioDto } from './dto/create-domicilio.dto';
import { UpdateDomicilioDto } from './dto/update-domicilio.dto';
import { RegistrarDomiPlataformaDto } from './dto/registrar-domi-plataforma.dto';
import { Domiciliario } from '../domiliarios/entities/domiliario.entity';

@Injectable()
export class DomiciliosService {
  constructor(
    @InjectRepository(Domicilio)
    private readonly domicilioRepo: Repository<Domicilio>,
    private readonly dataSource: DataSource,
  ) { }

  // =========================
  // Métodos que ya tenías
  // =========================

  async create(createDomicilioDto: CreateDomicilioDto): Promise<Domicilio> {
  const { cliente, ...rest } = createDomicilioDto as any;

  // cliente -> id_cliente (soporta número u objeto {id})
  const rawCliente = (cliente && typeof cliente === 'object') ? cliente.id : cliente;
  const parsedIdCliente = Number.isFinite(Number(rawCliente)) ? Number(rawCliente) : null;

  const payload: DeepPartial<Domicilio> = {
    ...rest,
    id_cliente: parsedIdCliente,
  };

  // 🔒 Tipos explícitos para que tome el overload de entidad
  const nuevo: Domicilio = this.domicilioRepo.create(payload as DeepPartial<Domicilio>);
  const guardado: Domicilio = await this.domicilioRepo.save<Domicilio>(nuevo);
  return guardado;
}

  async findAll(): Promise<Domicilio[]> {
    return this.domicilioRepo.find({
      relations: ['domiciliario'],
      order: { fecha_creacion: 'DESC' },
    });
  }

  // domicilios.service.ts
async getPedidoEnProceso(numeroCliente: string): Promise<Domicilio | null> {
  return this.domicilioRepo
    .createQueryBuilder('d')
    .where('d.numero_cliente = :num', { num: numeroCliente })
    .andWhere('d.estado IN (:...estados)', { estados: [0, 5] }) // 0=pte, 5=ofertado
    .orderBy('d.fecha_creacion', 'DESC')
    .getOne();
}


  async find(options: FindManyOptions<Domicilio>): Promise<Domicilio[]> {
    return this.domicilioRepo.find(options);
  }

  async findOne(id: number): Promise<Domicilio> {
    const domicilio = await this.domicilioRepo.findOne({
      where: { id },
    });
    if (!domicilio) {
      throw new NotFoundException(`Domicilio con ID ${id} no encontrado`);
    }
    return domicilio;
  }

  async update(id: number, dto: UpdateDomicilioDto): Promise<Domicilio> {
    const domicilio = await this.findOne(id);
    Object.assign(domicilio, dto);
    return this.domicilioRepo.save(domicilio);
  }

  async remove(id: number): Promise<void> {
    const domicilio = await this.findOne(id);
    await this.domicilioRepo.remove(domicilio);
  }

  async findPendientes(numero_cliente?: string): Promise<Domicilio[]> {
    const qb = this.domicilioRepo
      .createQueryBuilder('domicilio')
      .where('domicilio.estado = :estado', { estado: 0 })
      .orderBy('domicilio.fecha_creacion', 'DESC');

    if (numero_cliente) {
      qb.andWhere('domicilio.numero_cliente LIKE :numero', { numero: `%${numero_cliente}%` });
    }
    return await qb.getMany();
  }

  async registrarDomiPlataforma(dto: RegistrarDomiPlataformaDto) {
    const parcial = this.domicilioRepo.create({
      estado: dto.estado,
      fecha: dto.fecha,
      numero_cliente: dto.numero_cliente,
      tipo_servicio: dto.tipo_servicio,
      origen_direccion: dto.origen_direccion,
      destino_direccion: dto.destino_direccion,
      detalles_pedido: dto.detalles_pedido,
    });
    return this.domicilioRepo.save(parcial);
  }

  async findTipoPlataforma(estado: number): Promise<Domicilio[]> {
    return this.domicilioRepo.find({
      where: { estado: Number(estado) },
      order: { fecha_creacion: 'DESC' },
      take: 50,
    });
  }

  // =========================
  // 👇 Métodos ATÓMICOS sin cambiar la entidad
  // =========================

  /** True si sigue pendiente */
  async estaPendiente(pedidoId: number): Promise<boolean> {
    const row = await this.domicilioRepo
      .createQueryBuilder('d')
      .select('1')
      .where('d.id = :id AND d.estado = :e', { id: pedidoId, e: 0 })
      .getRawOne();
    return !!row;
  }

  /**
   * PENDIENTE (0) -> OFERTADO (5) + set relación "domiciliario" en UNA transacción con bloqueo.
   * Devuelve true si ganó la carrera.
   */
  async marcarOfertadoSiPendiente(pedidoId: number, domiId: number): Promise<boolean> {
    return this.dataSource.transaction(async (manager) => {
      // 1) Carga y BLOQUEA el pedido (FOR UPDATE)
      const pedido = await manager.getRepository(Domicilio)
        .createQueryBuilder('d')
        .setLock('pessimistic_write')
        .where('d.id = :id', { id: pedidoId })
        .getOne();

      if (!pedido) return false;
      if (pedido.estado !== 0) return false; // ya no está pendiente

      // 2) Asignar relación SIN FK (no tocamos la entidad)
      //    Basta con crear un stub del Domiciliario con el id.
      const domiStub = manager.getRepository(Domiciliario).create({ id: domiId }) as Domiciliario;
      pedido.domiciliario = domiStub;

      // 3) Cambiar estado + fecha_asignacion y guardar
      pedido.estado = 5; // OFERTADO
      (pedido as any).fecha_asignacion = new Date();

      await manager.getRepository(Domicilio).save(pedido);
      return true;
    });
  }

  /**
   * OFERTADO (5) -> PENDIENTE (0), limpia la relación "domiciliario".
   * Devuelve true si realmente estaba ofertado y se revirtió.
   */
  async volverAPendienteSiOfertado(pedidoId: number): Promise<boolean> {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Domicilio);

      // Bloquea el registro del pedido
      const pedido = await repo
        .createQueryBuilder('d')
        .setLock('pessimistic_write')
        .where('d.id = :id', { id: pedidoId })
        .getOne();

      if (!pedido) return false;
      if (pedido.estado !== 5) return false; // ya no está OFERTADO

      // 1) Limpia la relación mediante RelationQueryBuilder (evita asignar null a la propiedad TS)
      await manager
        .createQueryBuilder()
        .relation(Domicilio, 'domiciliario')
        .of(pedido.id)
        .set(null);

      // 2) Actualiza el resto de campos
      pedido.estado = 0; // PENDIENTE
      (pedido as any).fecha_asignacion = null;
      // si quieres dejar constancia del motivo del “rollback” de oferta:
      (pedido as any).motivo_cancelacion = 'No respuesta de domiciliario';
      (pedido as any).fecha_cancelacion = null;

      await repo.save(pedido);
      return true;
    });
  }
  /**
   * Cancela por timeout SOLO si sigue PENDIENTE (0).
   */
  async cancelarPorTimeoutSiPendiente(pedidoId: number, motivo: string): Promise<boolean> {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Domicilio);

      const pedido = await repo
        .createQueryBuilder('d')
        .setLock('pessimistic_write')
        .where('d.id = :id', { id: pedidoId })
        .getOne();

      if (!pedido) return false;
      if (pedido.estado !== 0) return false; // ya no está pendiente

      pedido.estado = 2; // tu CANCELADO_TIMEOUT
      (pedido as any).motivo_cancelacion = (motivo || 'Timeout de asignación').slice(0, 160);
      (pedido as any).fecha_cancelacion = new Date();

      await repo.save(pedido);
      return true;
    });
  }

  /** Leer sin excepción */
  async getByIdOrNull(id: number): Promise<Domicilio | null> {
    return (await this.domicilioRepo.findOne({ where: { id } })) ?? null;
  }

  // domicilios.service.ts
  // async confirmarAsignacionSiOfertado(pedidoId: number, domiId?: number): Promise<boolean> {
  //   return this.dataSource.transaction(async (manager) => {
  //     const repo = manager.getRepository(Domicilio);

  //     const pedido = await repo
  //       .createQueryBuilder('d')
  //       .setLock('pessimistic_write')
  //       .where('d.id = :id', { id: pedidoId })
  //       .getOne();

  //     if (!pedido) return false;
  //     if (pedido.estado !== 5) return false;             // debe seguir OFERTADO

  //     // (Opcional, recomendado) valida que el mismo domi esté aceptando
  //     if (domiId && (pedido as any).domiciliario?.id && (pedido as any).domiciliario.id !== domiId) {
  //       return false; // la oferta no era para este domi
  //     }

  //     pedido.estado = 1;                                 // ASIGNADO
  //     (pedido as any).fecha_asignacion = new Date();
  //     await repo.save(pedido);
  //     return true;
  //   });
  // }

  // domicilios.service.ts
  async confirmarAsignacionSiOfertado(pedidoId: number, domiId?: number): Promise<boolean> {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Domicilio);

      // Bloqueo pesimista: evita carreras entre múltiples aceptaciones / timeouts
      const pedido = await repo
        .createQueryBuilder('d')
        .setLock('pessimistic_write')
        .where('d.id = :id', { id: pedidoId })
        .getOne();

      if (!pedido) return false;

      // Debe seguir OFERTADO
      if (pedido.estado !== 5) return false;

      // (Opcional, recomendado) validar que el mismo domi que recibió la oferta sea quien acepta
      if (domiId && (pedido as any).id_domiciliario && (pedido as any).id_domiciliario !== domiId) {
        return false;
      }

      // Transición segura a ASIGNADO
      pedido.estado = 1; // ASIGNADO
      (pedido as any).fecha_asignacion = new Date();
      await repo.save(pedido);

      return true;
    });
  }


  // domicilios.service.ts
async cancelarPorClienteSiNoAsignado(pedidoId: number, motivo: string): Promise<boolean> {
  return this.dataSource.transaction(async (manager) => {
    const repo = manager.getRepository(Domicilio);
    const p = await repo.createQueryBuilder('d')
      .setLock('pessimistic_write')
      .where('d.id = :id', { id: pedidoId })
      .getOne();
    if (!p) return false;

    // Solo dejar cancelar si NO está ASIGNADO (1) ni ENTREGADO/etc.
    if (![0,5].includes(p.estado)) return false;

    // Si estaba OFERTADO (5), limpia relación con domi
    if (p.estado === 5) {
      await manager.createQueryBuilder()
        .relation(Domicilio, 'domiciliario')
        .of(p.id)
        .set(null);
    }

    p.estado = 2; // tu estado "CANCELADO"
    (p as any).motivo_cancelacion = (motivo || 'Cancelación por cliente').slice(0,160);
    (p as any).fecha_cancelacion = new Date();

    await repo.save(p);
    return true;
  });
}

async vaciarTablaYReiniciarIds(): Promise<void> {
  const qr = this.dataSource.createQueryRunner();
  await qr.connect();
  await qr.startTransaction();

  try {
    const { tableName, schema } = this.domicilioRepo.metadata;
    const qualified = schema ? `"${schema}"."${tableName}"` : `"${tableName}"`;

    // TRUNCATE en Postgres reinicia el IDENTITY/SEQUENCE automáticamente
    // CASCADE: cuidado, también vacía tablas que referencien esta.
    await qr.query(`TRUNCATE TABLE ${qualified} RESTART IDENTITY CASCADE;`);

    await qr.commitTransaction();
  } catch (e) {
    await qr.rollbackTransaction();
    throw e;
  } finally {
    await qr.release();
  }
}
async marcarEntregadoSiAsignado(pedidoId: number, domiId?: number): Promise<boolean> {
  return this.dataSource.transaction(async (manager) => {
    const repo = manager.getRepository(Domicilio);

    const pedido = await repo
      .createQueryBuilder('d')
      .setLock('pessimistic_write')
      .where('d.id = :id', { id: pedidoId })
      .getOne();

    if (!pedido) return false;
    if (pedido.estado !== 1) return false; // debe estar ASIGNADO

    // (Opcional) verificar domi que cierra coincide con el asignado
    if (domiId && (pedido as any).id_domiciliario && (pedido as any).id_domiciliario !== domiId) {
      return false;
    }

    pedido.estado = 7; // ENTREGADO
    (pedido as any).fecha_entrega = new Date();
    await repo.save(pedido);
    return true;
  });
}

  async asignarSiPendiente(pedidoId: number, domiId: number): Promise<boolean> {
    const now = new Date();
    const res = await this.domicilioRepo.createQueryBuilder()
      .update(Domicilio)
      .set({
        estado: 1,
        fecha_asignacion: now,
        // relación por FK existente
        domiciliario: { id: domiId } as any,
      })
      .where('id = :id', { id: pedidoId })
      .andWhere('estado = :pend', { pend: 0 })
      .execute();

    return (res.affected ?? 0) > 0;
  }
}
