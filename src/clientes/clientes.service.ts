import { Injectable } from '@nestjs/common';
import { CreateClienteDto } from './dto/create-cliente.dto';
import { UpdateClienteDto } from './dto/update-cliente.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cliente } from './entities/cliente.entity';

@Injectable()
export class ClientesService {
  constructor(
    @InjectRepository(Cliente)
    private readonly clienteRepository: Repository<Cliente>,
  ) {}

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

  async findAll() {
    const clientes = await this.clienteRepository.find({
      relations: ['rol'],
    });
    return clientes.map(cliente => {
      const { password, ...clienteSinPassword } = cliente;
      return clienteSinPassword;
    });
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
