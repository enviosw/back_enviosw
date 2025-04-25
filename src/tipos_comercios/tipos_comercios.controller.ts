import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
} from '@nestjs/common';
import { TiposComerciosService } from './tipos_comercios.service';
import { CreateTiposComercioDto } from './dto/create-tipos_comercio.dto';
import { UpdateTiposComercioDto } from './dto/update-tipos_comercio.dto';

@Controller('tipos-comercios')
export class TiposComerciosController {
  constructor(private readonly tiposComerciosService: TiposComerciosService) {}

  @Post()
  create(@Body() dto: CreateTiposComercioDto) {
    return this.tiposComerciosService.create(dto);
  }

  @Get()
  findAll() {
    return this.tiposComerciosService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.tiposComerciosService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTiposComercioDto,
  ) {
    return this.tiposComerciosService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.tiposComerciosService.remove(id);
  }
}
