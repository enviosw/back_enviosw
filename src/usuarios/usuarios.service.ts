import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Usuario } from './entities/usuario.entity';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import { UsuarioQuery } from './interfaces/usuario.interface';

@Injectable()
export class UsuariosService {
  constructor(
    @InjectRepository(Usuario)
    private readonly usuarioRepository: Repository<Usuario>,
  ) {}

  // Crear un nuevo usuario
  async create(createUsuarioDto: CreateUsuarioDto): Promise<Usuario> {
    const { comercio_id, ...resto } = createUsuarioDto;
  
    const nuevoUsuario = this.usuarioRepository.create(resto);
  
    if (comercio_id) {
      nuevoUsuario.comercio = { id: comercio_id } as any; // Solo enlaza por ID sin cargar todo el comercio
    }
  
    return await this.usuarioRepository.save(nuevoUsuario);
  }
  

  // Obtener todos los usuarios con filtros y paginación
  async findAll(query: UsuarioQuery) {
    const take = 20; // Definir registros por página
    const skip = (query.page - 1) * take; // Calcular el offset basado en la página

    const qb = this.usuarioRepository.createQueryBuilder('usuario');

    // Filtro de búsqueda
    if (query.search) {
      const palabras = query.search.trim().split(/\s+/);
      palabras.forEach((palabra, index) => {
        const param = `palabra${index}`;
        qb.andWhere(
          `(
            usuario.nombre ILIKE :${param} OR
            usuario.email ILIKE :${param} OR
            usuario.rol ILIKE :${param} OR
            usuario.estado ILIKE :${param}
          )`,
          { [param]: `%${palabra}%` },
        );
      });
    }

    // Filtro por estado
    if (query.estado) {
      qb.andWhere('usuario.estado = :estado', { estado: query.estado });
    }

    // Filtro por fecha de creación
    if (query.fechaInicio && query.fechaFin) {
      qb.andWhere('usuario.fecha_creacion BETWEEN :inicio AND :fin', {
        inicio: query.fechaInicio,
        fin: query.fechaFin,
      });
    }

    qb.skip(skip).take(take).orderBy('usuario.fecha_creacion', 'DESC');

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      total,
      page: query.page,
      lastPage: Math.ceil(total / take),
    };
  }

  // Obtener un usuario por ID
  async findOne(id: number): Promise<Usuario> {
    const usuario = await this.usuarioRepository.findOne({ where: { id } });
    if (!usuario) {
      throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
    }
    return usuario;
  }

  // Obtener un usuario por su email
  async findOneByEmail(email: string) {
    return this.usuarioRepository.findOne({
      where: { email },
      relations: ['comercio'], // <-- incluye la relación
    });
  }


// Actualizar un usuario
  async update(id: number, updateUsuarioDto: UpdateUsuarioDto): Promise<Usuario> {
    const usuario = await this.findOne(id);
    const { comercio_id, ...resto } = updateUsuarioDto;
  
    const actualizado = this.usuarioRepository.merge(usuario, resto);
  
    if (comercio_id !== undefined) {
      actualizado.comercio = { id: comercio_id } as any;
    }
  
    return await this.usuarioRepository.save(actualizado);
  }
  
  // Eliminar un usuario
  async remove(id: number): Promise<void> {
    const usuario = await this.findOne(id);
    await this.usuarioRepository.remove(usuario);
  }
}
