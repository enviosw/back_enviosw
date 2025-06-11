import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateClienteDto } from './dto/create-cliente.dto';
import { UpdateClienteDto } from './dto/update-cliente.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
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
              cliente.nombre ILIKE :${param} OR
              cliente.apellido ILIKE :${param} OR
              cliente.email ILIKE :${param} OR
              cliente.estado ILIKE :${param} OR
              cliente.telefono ILIKE :${param} OR
              cliente.telefono_2 ILIKE :${param} OR
              cliente.direccion ILIKE :${param}
            )`,
          { [param]: `%${palabra}%` },
        );
      });
    }


    // Filtro por estado
    if (query.estado) {
      clientes.andWhere('cliente.estado = :estado', { estado: query.estado });
    }

    // Filtro por fecha de creación
    if (query.fechaInicio) {
      const inicio = new Date(query.fechaInicio + 'T00:00:00'); // ISO formato seguro
      clientes.andWhere('cliente.fecha_creacion >= :inicio', { inicio });
    }

    if (query.fechaFin) {
      const fin = new Date(query.fechaFin + 'T23:59:59.999'); // Final del día
      clientes.andWhere('cliente.fecha_creacion <= :fin', { fin });
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
      throw new NotFoundException(`El cliente ${updateClienteDto.nombre} no encontrado para actualizarlo.`);
    }

    const clienteActualizado = { ...cliente, ...resto };
    if (rol_id) {
      clienteActualizado.rol = { id: rol_id } as any; // Solo enlaza por ID sin cargar todo el comercio
    }

    return this.clienteRepository.save(clienteActualizado);
  }

  async hideClientes(ids: number[]) {
    return await this.clienteRepository.update(
      { id: In(ids) },
      { estado: 'inactivo' }
    );
  }

  async remove(id: number) {
    const cliente = await this.clienteRepository.findOneBy({ id });

    if (!cliente) {
      throw new NotFoundException(`Cliente con ya habia sido eliminado anteriormente`);
    }

    await this.clienteRepository.remove(cliente);
    return `Este cliente con ID #${id} ha sido eliminado`;
  }


  async toggleEstados(ids: number[]): Promise<{ actualizados: number[] }> {
    const clientes = await this.clienteRepository.findBy({ id: In(ids) });

    if (!clientes.length) {
      throw new NotFoundException('No se encontraron clientes con los IDs proporcionados');
    }

    const actualizados = clientes.map(cliente => {
      cliente.estado = cliente.estado === 'activo' ? 'inactivo' : 'activo';
      return cliente;
    });

    await this.clienteRepository.save(actualizados);

    return {
      actualizados: actualizados.map(c => c.id),
    };
  }

}
