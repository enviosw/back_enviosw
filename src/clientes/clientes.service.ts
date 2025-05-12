import { Injectable, NotFoundException } from '@nestjs/common';
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
    const { rol_id, ...resto } = createClienteDto;

    const nuevoCliente = this.clienteRepository.create({
      ...resto,
      rol: { id: rol_id } as any, // Solo enlaza por ID sin cargar todo el rol
    });

    if (rol_id) {
      nuevoCliente.rol = { id: rol_id } as any; // Solo enlaza por ID sin cargar todo el comercio
    }

    return await this.clienteRepository.save(nuevoCliente);
  }

  async findAll(query: ClienteQuery): Promise<{ data: Cliente[]; total: number; page: number; lastPage: number }> {
    const take = 20; // Definir registros por página
    const skip = (query.page - 1) * take; // Calcular el offset basado en la página

    const clientes = this.clienteRepository.createQueryBuilder('cliente');

    // clientes.leftJoinAndSelect('cliente.rol', 'rol');

    // Filtro de búsqueda
    if (query.search) {
      const palabras = query.search.trim().split(/\s+/);
      palabras.forEach((palabra, index) => {
        const param = `palabra${index}`;
        clientes.andWhere(
          `(
              cliente.name ILIKE :${param} OR
              cliente.lastName ILIKE :${param} OR
              cliente.email ILIKE :${param} OR
              cliente.status ILIKE :${param} OR
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
      clientes.andWhere('cliente.state = :estado', { state: query.estado });
    }

    // Filtro por fecha de creación
    if (query.fechaInicio && query.fechaFin) {
      clientes.andWhere('cliente.fecha_creacion BETWEEN :inicio AND :fin', {
        inicio: query.fechaInicio,
        fin: query.fechaFin,
      });
    }

    clientes.skip(skip).take(take).orderBy('cliente.fecha_creacion', 'DESC');

    const [data, total] = await clientes.getManyAndCount();

    return {
      data,
      total,
      page: query.page,
      lastPage: Math.ceil(total / take),
    };
  }

  async findOne(id: number): Promise<Cliente> {
    const cliente = await this.clienteRepository.findOne({
      where: { id },
      relations: ['rol'],
    });

    if (!cliente) {
      throw new Error(`Cliente con ID ${id} no encontrado`);
    }

    return cliente;
  }

  async findOneByEmail(email: string): Promise<Cliente | null> {
    const cliente = await this.clienteRepository.findOne({
      where: { email },
      relations: ['rol'],
    });

    return cliente;
  }

  async update(id: number, updateClienteDto: UpdateClienteDto) {
    
    const { rol_id, ...resto } = updateClienteDto;

    const cliente = await this.clienteRepository.findOneBy({ id });
    if (!cliente) {
      throw new NotFoundException(`El cliente ${updateClienteDto.name} no encontrado para actualizarlo.`);
    }
    
    const clienteActualizado = { ...cliente, ...resto };
    if (rol_id) {
      clienteActualizado.rol = { id: rol_id } as any; // Solo enlaza por ID sin cargar todo el comercio
    }

    return this.clienteRepository.save(clienteActualizado);
  }

  async remove(id: number) {
    const cliente = await this.clienteRepository.findOneBy({ id });

    if (!cliente) {
      throw new NotFoundException(`Cliente con ya habia sido eliminado anteriormente`);
    }

    await this.clienteRepository.remove(cliente);
    return `Este cliente con ID #${id} ha sido eliminado`;
  }
}
