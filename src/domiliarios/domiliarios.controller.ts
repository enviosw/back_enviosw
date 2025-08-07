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
}
