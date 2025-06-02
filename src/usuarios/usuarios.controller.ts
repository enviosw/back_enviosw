import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { UsuariosService } from './usuarios.service';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import { UsuarioQuery } from './interfaces/usuario.interface';
import { RolesGuard } from 'src/auth/roles.guard';
import { Roles } from 'src/auth/roles.decorator';
import { AuthGuard } from 'src/auth/auth.guard';

@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) { }

  // Crear un nuevo usuario
  @Post()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('administrador')
  create(@Body() createUsuarioDto: CreateUsuarioDto) {
    return this.usuariosService.create(createUsuarioDto);
  }

  // Obtener todos los usuarios con filtros y paginación
  @Get()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('administrador')
  findAll(@Query() query: UsuarioQuery) {
    return this.usuariosService.findAll(query);
  }

  // Obtener un usuario por ID
  @Get(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('administrador')
  findOne(@Param('id') id: number) {
    return this.usuariosService.findOne(id);
  }

  // Actualizar un usuario
  @Patch(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('administrador')
  update(
    @Param('id') id: number,
    @Body() updateUsuarioDto: UpdateUsuarioDto,
  ) {
    return this.usuariosService.update(id, updateUsuarioDto);
  }

  // Eliminar un usuario
  @Delete(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('administrador')
  remove(@Param('id') id: number) {
    return this.usuariosService.remove(id);
  }
}
