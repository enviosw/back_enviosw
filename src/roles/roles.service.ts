import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Rol } from './entities/role.entity';
import { CreateRolDto } from './dto/create-role.dto';
import { UpdateRolDto } from './dto/update-role.dto';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Rol)
    private readonly rolRepository: Repository<Rol>,
  ) {}

  // Crear un nuevo rol
  async create(createRolDto: CreateRolDto): Promise<Rol> {
    const rol = this.rolRepository.create(createRolDto);
    return this.rolRepository.save(rol);
  }

  // Obtener todos los roles
  async findAll(): Promise<Rol[]> {
    return this.rolRepository.find();
  }

  // Obtener un rol por su ID
  async findOne(id: number): Promise<Rol> {
    const rol = await this.rolRepository.findOne({
      where: { id }, // Aquí especificamos un objeto con la propiedad `where`
    });
    if (!rol) {
      throw new NotFoundException(`Rol con ID ${id} no encontrado`);
    }
    return rol;
  }

  // Actualizar un rol existente
  async update(id: number, updateRolDto: UpdateRolDto): Promise<Rol> {
    const rol = await this.rolRepository.preload({
      id,
      ...updateRolDto,
    });
    if (!rol) {
      throw new NotFoundException(`Rol con ID ${id} no encontrado`);
    }
    return this.rolRepository.save(rol);
  }

  // Eliminar un rol
  async remove(id: number): Promise<void> {
    const rol = await this.findOne(id);
    await this.rolRepository.remove(rol);
  }
}
