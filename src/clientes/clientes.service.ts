import { Injectable } from '@nestjs/common';
import { CreateClienteDto } from './dto/create-cliente.dto';
import { UpdateClienteDto } from './dto/update-cliente.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cliente } from './entities/cliente.entity';
import { ClienteQuery } from './interfaces/cliente.interface';

@Injectable()
export class ClientesService {
  constructor(
    @InjectRepository(Cliente)
    private readonly clienteRepository: Repository<Cliente>,
  ) { }

  async create(createClienteDto: CreateClienteDto): Promise<Cliente> {
    const { rol, ...resto } = createClienteDto;

    const nuevoCliente = this.clienteRepository.create({
      ...resto,
      rol: { id: 3 } as any, // Solo enlaza por ID sin cargar todo el rol
    });

    // if (comercio_id) {
    //   nuevoUsuario.comercio = { id: comercio_id } as any; // Solo enlaza por ID sin cargar todo el comercio
    // }

    return await this.clienteRepository.save(nuevoCliente);
  }

  async findAll(query: ClienteQuery) {
    const take = 20; // Definir registros por página
    const skip = (query.page - 1) * take; // Calcular el offset basado en la página

    const qb = this.clienteRepository.createQueryBuilder('cliente');

    // Filtro de búsqueda
    if (query.search) {
      const palabras = query.search.trim().split(/\s+/);
      palabras.forEach((palabra, index) => {
        const param = `palabra${index}`;
        qb.andWhere(
          `(
              cliente.name ILIKE :${param} OR
              cliente.lastName ILIKE :${param} OR
              cliente.email ILIKE :${param} OR
              cliente.rol ILIKE :${param} OR
              cliente.state ILIKE :${param} OR
              cliente.phone ILIKE :${param} OR
              cliente.phone_2 ILIKE :${param} OR
              cliente.address ILIKE :${param}
            )`,
          { [param]: `%${palabra}%` },
        );
      });
    }


    // Filtro por estado
    if (query.estado) {
      qb.andWhere('cliente.state = :estado', { state: query.estado });
    }

    // Filtro por fecha de creación
    if (query.fechaInicio && query.fechaFin) {
      qb.andWhere('cliente.fecha_creacion BETWEEN :inicio AND :fin', {
        inicio: query.fechaInicio,
        fin: query.fechaFin,
      });
    }

    qb.skip(skip).take(take).orderBy('cliente.fecha_creacion', 'DESC');

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      total,
      page: query.page,
      lastPage: Math.ceil(total / take),
    };
  }

  findOne(id: number) {
    return `This action returns a #${id} cliente`;
  }

  async findOneByEmail(email: string) {
    return this.clienteRepository.findOne({
      where: { email },
      relations: ['rol'],
    });
  }

  update(id: number, updateClienteDto: UpdateClienteDto) {
    return `This action updates a #${id} cliente`;
  }

  remove(id: number) {
    return `This action removes a #${id} cliente`;
  }
}
