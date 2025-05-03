import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Patch,
} from '@nestjs/common';
import { ServiciosService } from './servicios.service';
import { CreateServicioDto } from './dto/create-servicio.dto';
import { UpdateServicioDto } from './dto/update-servicio.dto';
import { Servicio } from './entities/servicio.entity';

@Controller('servicios')
export class ServiciosController {
  constructor(private readonly serviciosService: ServiciosService) {}

  @Post()
  async create(
    @Body() createServicioDto: CreateServicioDto,
  ): Promise<Servicio> {
    return this.serviciosService.create(createServicioDto);
  }

  @Get()
  async findAll(): Promise<Servicio[]> {
    return this.serviciosService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: number): Promise<Servicio> {
    return this.serviciosService.findOne(id);
  }

  @Patch(':id')
  async update(
    @Param('id') id: number,
    @Body() updateServicioDto: UpdateServicioDto,
  ): Promise<Servicio> {
    return this.serviciosService.update(id, updateServicioDto);
  }

  @Delete(':id')
  async remove(@Param('id') id: number): Promise<void> {
    return this.serviciosService.remove(id);
  }
}
