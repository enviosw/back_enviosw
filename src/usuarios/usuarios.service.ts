import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Usuario } from './entities/usuario.entity';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import { UsuarioQuery } from './interfaces/usuario.interface';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UsuariosService {
  constructor(
    @InjectRepository(Usuario)
    private readonly usuarioRepository: Repository<Usuario>,
  ) { }

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
    const page = Number(query.page) || 1; // Asegura que sea número y por defecto 1
    const skip = (page - 1) * take; // Calcular offset

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
            usuario.estado ILIKE :${param} OR
            usuario.telefono ILIKE :${param} OR
            usuario.direccion ILIKE :${param}
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
      page,
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
    return await this.usuarioRepository
      .createQueryBuilder('usuario')
      .addSelect('usuario.password') // <-- Forzamos traer password (aunque tenga select: false)
      .leftJoinAndSelect('usuario.comercio', 'comercio') // <-- Cargamos comercio si existe
      .where('usuario.email = :email', { email })
      .getOne();
  }



  // Actualizar un usuario
  async update(id: number, updateUsuarioDto: UpdateUsuarioDto): Promise<Usuario> {
    const usuario = await this.findOne(id);
    const { comercio_id, password, ...resto } = updateUsuarioDto;

    const datosActualizar: Partial<Usuario> = { ...resto };

    // Solo actualiza la contraseña si no está vacía
    if (password && password.trim() !== '') {
      datosActualizar.password = await bcrypt.hash(password, 10);
    }

    const actualizado = this.usuarioRepository.merge(usuario, datosActualizar);

    // Relación con comercio si viene comercio_id
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


  async toggleEstados(ids: number[]): Promise<{ actualizados: number[] }> {
  const usuarios = await this.usuarioRepository.findByIds(ids);

  if (!usuarios.length) {
    throw new NotFoundException('No se encontraron usuarios con los IDs proporcionados');
  }

  const actualizados = usuarios.map((usuario) => {
    usuario.estado = usuario.estado === 'activo' ? 'inactivo' : 'activo';
    return usuario;
  });

  await this.usuarioRepository.save(actualizados);

  return {
    actualizados: actualizados.map((u) => u.id),
  };
}

}
