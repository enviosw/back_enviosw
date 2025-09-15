import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { IngresosService } from './ingresos.service';
import { CreateIngresoDto } from './dto/create-ingreso.dto';
import { UpdateIngresoDto } from './dto/update-ingreso.dto';

@Controller('ingresos')
export class IngresosController {
  constructor(private readonly ingresosService: IngresosService) {}

  @Post()
  create(@Body() createIngresoDto: CreateIngresoDto) {
    return this.ingresosService.create(createIngresoDto);
  }

  @Get()
  findAll() {
    return this.ingresosService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.ingresosService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateIngresoDto: UpdateIngresoDto) {
    return this.ingresosService.update(+id, updateIngresoDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.ingresosService.remove(+id);
  }
}
