import {
  Controller,
  Get,
  Post,
  Param,
  ParseIntPipe,
  NotFoundException,
  HttpCode,
  HttpStatus,
  Body,
  Put,
  Patch,
  Delete,
} from '@nestjs/common';
import { DomiciliariosService } from './domiliarios.service';
import { Domiciliario } from './entities/domiliario.entity';

@Controller('domiciliarios')
export class DomiciliariosController {
  constructor(private readonly domiciliariosService: DomiciliariosService) { }


  @Post()
  async crear(@Body() data: Partial<Domiciliario>) {
    return this.domiciliariosService.create(data);
  }


  // 🚀 Obtener el próximo domiciliario disponible y asignarlo
  @Post('asignar')
  async asignar(): Promise<Domiciliario> {
    return await this.domiciliariosService.asignarDomiciliarioDisponible();
  }

  // 🟢 Liberar un domiciliario por ID (lo marca como disponible)
  @Post('liberar/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async liberar(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.domiciliariosService.liberarDomiciliario(id);
  }

  // 🔁 (Opcional) Reinicia el orden de turnos
  @Post('reiniciar-turnos')
  @HttpCode(HttpStatus.NO_CONTENT)
  async reiniciarTurnos(): Promise<void> {
    await this.domiciliariosService.reiniciarTurnos();
  }

  // 🔍 Obtener todos los domiciliarios (útil para UI o testing)
  @Get()
  async listar(): Promise<Domiciliario[]> {
    return await this.domiciliariosService.getAll();
  }

  @Get('resumen')
  getResumen() {
    return this.domiciliariosService.listarResumen();

  }

  // 🔎 Listar por orden de disponibilidad
  @Get('orden/disponibilidad')
  async listarPorDisponibilidad(): Promise<Domiciliario[]> {
    return this.domiciliariosService.listarPorDisponibilidad();
  }

  @Get('siguiente')
  async siguiente() {
    return this.domiciliariosService.verSiguienteDisponible();
  }


  // ♻️ Reiniciar turnos a 0 y dejar no disponibles
  @Post('reiniciar-a-cero')
  @HttpCode(HttpStatus.NO_CONTENT)
  async reiniciarACero(): Promise<void> {
    await this.domiciliariosService.reiniciarTurnosACeroYNoDisponibles();
  }


  // ✏️ Actualizar domiciliario existente
  @Put(':id')
  async actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: Partial<Domiciliario>,
  ) {
    return this.domiciliariosService.update(id, data);
  }

  // 🔁 Activar/Desactivar domiciliario
  @Patch(':id/toggle-estado')
  async cambiarEstado(@Param('id', ParseIntPipe) id: number) {
    return this.domiciliariosService.toggleEstado(id);
  }

  // 🔍 Obtener un domiciliario por ID
  @Get(':id')
  async obtener(@Param('id', ParseIntPipe) id: number): Promise<Domiciliario> {
    const dom = await this.domiciliariosService.getById(id);
    if (!dom) throw new NotFoundException(`Domiciliario ID ${id} no existe`);
    return dom;
  }

  // 🗑️ Eliminar un domiciliario por ID
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async eliminar(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.domiciliariosService.deleteById(id);
  }
}
