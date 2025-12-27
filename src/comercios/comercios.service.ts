import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Comercio } from './entities/comercio.entity';
import { CreateComercioDto } from './dto/create-comercio.dto';
import { UpdateComercioDto } from './dto/update-comercio.dto';
import { ComercioQuery } from './interfaces/comercio.interface';
import { Zona } from 'src/zonas/entities/zona.entity';

@Injectable()
export class ComerciosService {
  constructor(
    @InjectRepository(Comercio)
    private readonly comercioRepo: Repository<Comercio>,
  ) { }

  // Crear un nuevo comercio
  async create(dto: CreateComercioDto): Promise<Comercio> {
    const comercio = this.comercioRepo.create({
      ...dto,
      estado: dto.estado ?? 'activo', // 👈 valor por defecto si no viene
      servicio: { id: dto.servicio_id, estado: 'activo' },
    });

    return await this.comercioRepo.save(comercio);
  }


  // En ComerciosService
// ComerciosService
async getById(id: number) {
  // si quieres seguir usando QB, trae la relación igual
  return this.comercioRepo
    .createQueryBuilder('c')
    .leftJoinAndSelect('c.zona', 'zona') // ← trae la zona
    .select([
      'c.id',
      'c.nombre_comercial',
      'c.razon_social',
      'c.telefono',
      'c.telefono_secundario',
      'c.direccion',
      'zona.id',       // ← id de la zona
      'zona.nombre',   // (opcional) nombre de la zona
    ])
    .where('c.id = :id', { id })
    .getOne();
}



  async searchAll(search: string) {
    const qb = this.comercioRepo
      .createQueryBuilder('comercio')
      .leftJoinAndSelect('comercio.servicio', 'servicio');

    if (search) {
      const palabras = search.trim().split(/\s+/);

      palabras.forEach((palabra, index) => {
        const param = `palabra${index}`;
        qb.andWhere(
          `(
            comercio.nombre_comercial ILIKE :${param} OR 
            comercio.razon_social ILIKE :${param} OR 
            comercio.nit ILIKE :${param} OR 
            comercio.descripcion ILIKE :${param} OR 
            comercio.responsable ILIKE :${param} OR 
            comercio.email_contacto ILIKE :${param} OR 
            comercio.telefono ILIKE :${param} OR 
            comercio.telefono_secundario ILIKE :${param} OR 
            comercio.direccion ILIKE :${param}
          )`,
          { [param]: `%${palabra}%` },
        );
      });
    }

    qb.orderBy('comercio.fecha_creacion', 'DESC');

    const resultados = await qb.getMany();
    return resultados;
  }


  // Obtener todos los comercios
  async findAll(query: ComercioQuery) {
    const take = 30;
    const skip = (query.page - 1) * take;

    const qb = this.comercioRepo
      .createQueryBuilder('comercio')
      .leftJoinAndSelect('comercio.servicio', 'servicio') // ⬅️ Aquí se une la relación
      .leftJoinAndSelect('comercio.zona', 'zona')

    if (query.search) {
      const palabras = query.search.trim().split(/\s+/);

      palabras.forEach((palabra, index) => {
        const param = `palabra${index}`;
        qb.andWhere(
          `(
            comercio.nombre_comercial ILIKE :${param} OR 
            comercio.razon_social ILIKE :${param} OR 
            comercio.nit ILIKE :${param} OR 
            comercio.descripcion ILIKE :${param} OR 
            comercio.responsable ILIKE :${param} OR 
            comercio.email_contacto ILIKE :${param} OR 
            comercio.telefono ILIKE :${param} OR 
            comercio.telefono_secundario ILIKE :${param} OR 
            comercio.direccion ILIKE :${param}
          )`,
          { [param]: `%${palabra}%` },
        );
      });
    }

    if (query.estado) {
      qb.andWhere('comercio.estado = :estado', { estado: query.estado });
    }

    if (query.fechaInicio && query.fechaFin) {
      qb.andWhere('comercio.fecha_creacion BETWEEN :inicio AND :fin', {
        inicio: query.fechaInicio,
        fin: query.fechaFin,
      });
    }

    qb.skip(skip).take(take).orderBy('comercio.fecha_creacion', 'DESC');

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      total,
      page: query.page,
      lastPage: Math.ceil(total / take),
    };
  }

  // Obtener un comercio por su ID
  async findOne(id: number): Promise<Comercio> {
    const comercio = await this.comercioRepo.findOneBy({ id });

    if (!comercio) {
      throw new NotFoundException(`Comercio con ID ${id} no encontrado`);
    }

    await this.aumentarCLicks(id)
    return comercio;
  }

  // comercios.service.ts
  async update(id: number, dto: UpdateComercioDto): Promise<Comercio> {
    const comercio = await this.comercioRepo.findOne({ where: { id } });
    if (!comercio) throw new NotFoundException(`Comercio con ID ${id} no encontrado`);

    // Asigna solamente propiedades válidas de la entidad
    if (dto.nombre_comercial !== undefined) comercio.nombre_comercial = dto.nombre_comercial;
    // ...otros campos

    // SERVICIO (si tienes servicio_id como columna simple)
    if (dto.servicio_id !== undefined) {
      // si tu entidad tiene servicio_id simple:
      // comercio.servicio_id = dto.servicio_id;
      // (si tienes relación ManyToOne, usa la variante A)
    }

    if (dto.zonaId !== undefined) {
      comercio.zona = dto.zonaId === null ? null : ({ id: dto.zonaId } as Zona);
    }

    return this.comercioRepo.save(comercio);
  }

    // Actualizar un comercio
  async update2(id: number, dto: UpdateComercioDto): Promise<Comercio> {
    const comercio = await this.comercioRepo.findOne({ where: { id } });

    if (!comercio) {
      throw new NotFoundException(`Comercio con ID ${id} no encontrado`);
    }

    Object.assign(comercio, {
      ...dto,
      servicio: dto.servicio_id ? { id: dto.servicio_id } : comercio.servicio,
    });

    return await this.comercioRepo.save(comercio);
  }


  // Eliminar un comercio
  async remove(id: number): Promise<void> {
    const comercio = await this.findOne(id);
    await this.comercioRepo.remove(comercio);
  }


  async findComerciosByServicio(
    servicioId: number,
    search: string = '',
    page: number = 1,
  ): Promise<{ data: Comercio[]; total: number; page: number; lastPage: number }> {
    const take = 30;
    const skip = (page - 1) * take;
    const subQb = this.comercioRepo
      .createQueryBuilder('comercio')
      .select('comercio.id', 'id')
      .leftJoin('comercio.servicio', 'servicio')
      .where('servicio.id = :servicioId', { servicioId })
      .andWhere('comercio.estado = :estado', { estado: 'activo' }); // 👈 Agregado aquí


    if (search.trim()) {
      const palabras = search.trim().split(/\s+/);
      palabras.forEach((palabra, index) => {
        const param = `palabra${index}`;
        subQb.andWhere(
          `(
          comercio.nombre_comercial ILIKE :${param} OR 
          comercio.razon_social ILIKE :${param} OR 
          comercio.nit ILIKE :${param} OR 
          comercio.descripcion ILIKE :${param} OR 
          comercio.responsable ILIKE :${param} OR 
          comercio.email_contacto ILIKE :${param} OR 
          comercio.telefono ILIKE :${param} OR 
          comercio.telefono_secundario ILIKE :${param} OR 
          comercio.direccion ILIKE :${param}
        )`,
          { [param]: `%${palabra}%` },
        );
      });
    }

    // Obtener IDs aleatorios
    const idsResult = await subQb
      .orderBy('comercio.clicks', 'DESC')          // 1er criterio
      .addOrderBy('comercio.fecha_creacion', 'DESC') // 2do criterio
      .offset(skip)
      .limit(take)
      .getRawMany();


    const ids = idsResult.map((row) => row.id);

    let data: Comercio[] = [];
    if (ids.length) {
      const rawData = await this.comercioRepo.find({
        where: { id: In(ids) },
        relations: ['servicio'],
      });

      // Reordenar manualmente según el orden aleatorio original
      const dataMap = new Map(rawData.map(c => [c.id, c]));
      data = ids.map(id => dataMap.get(id)).filter(Boolean) as Comercio[];
    }

    const total = await subQb.getCount();

    return {
      data,
      total,
      page,
      lastPage: Math.ceil(total / take),
    };
  }





  // Obtener los horarios de un comercio por su ID
  async getHorariosByComercio(id: number): Promise<any> {
    const comercio = await this.comercioRepo.findOne({
      where: { id },
      select: ['horarios'], // Solo seleccionamos los horarios
    });

    if (!comercio) {
      throw new NotFoundException(`Comercio con ID ${id} no encontrado`);
    }

    return comercio.horarios;
  }

  // Actualizar los horarios de un comercio
  async updateHorarios(id: number, horarios: any): Promise<Comercio> {
    const comercio = await this.comercioRepo.findOne({ where: { id } });

    if (!comercio) {
      throw new NotFoundException(`Comercio con ID ${id} no encontrado`);
    }

    comercio.horarios = horarios; // Actualizamos los horarios
    return await this.comercioRepo.save(comercio);
  }


  async toggleActivarNumero(id: number): Promise<Comercio> {
    const comercio = await this.comercioRepo.findOneBy({ id });

    if (!comercio) {
      throw new NotFoundException(`Comercio con ID ${id} no encontrado`);
    }

    comercio.activar_numero = comercio.activar_numero === 1 ? 0 : 1;

    return this.comercioRepo.save(comercio);
  }


  async toggleEstados(ids: number[]): Promise<{ actualizados: number[] }> {
    const comercios = await this.comercioRepo.findBy({ id: In(ids) });

    if (!comercios.length) {
      throw new NotFoundException('No se encontraron comercios con los IDs proporcionados');
    }

    const actualizados = comercios.map((comercio) => {
      comercio.estado = comercio.estado === 'activo' ? 'inactivo' : 'activo';
      return comercio;
    });

    await this.comercioRepo.save(actualizados);

    return {
      actualizados: actualizados.map((c) => c.id),
    };
  }


async findByTelefono(telefono: string): Promise<{
  id: number;
  nombre: string;
  telefono: string;
  direccion: string;
  zonaId: number | null;
  zonaNombre: string | null;
}> {
  const comercio = await this.comercioRepo
    .createQueryBuilder('comercio')
    .leftJoin('comercio.zona', 'zona') // 👈 une la relación
    .select([
      'comercio.id',
      'comercio.nombre_comercial',
      'comercio.telefono',
      'comercio.direccion',
      'zona.id',
      'zona.nombre',
    ])
    .where('TRIM(comercio.telefono) = :telefono', { telefono })
    .getOne();

  if (!comercio) {
    throw new NotFoundException(`No se encontró un comercio con el teléfono ${telefono}`);
  }

  return {
    id: comercio.id,
    nombre: comercio.nombre_comercial,
    telefono: comercio.telefono,
    direccion: comercio.direccion,
    zonaId: comercio.zona ? (comercio.zona as any).id ?? null : null,
    zonaNombre: comercio.zona ? (comercio.zona as any).nombre ?? null : null,
  };
}

  async aumentarCLicks(id: number): Promise<void> {
    await this.comercioRepo.increment({ id }, 'clicks', 1)
  }



}
