import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { DomiciliosService } from './domicilios.service';
import { CreateDomicilioDto } from './dto/create-domicilio.dto';
import { UpdateDomicilioDto } from './dto/update-domicilio.dto';
import { RegistrarDomiPlataformaDto } from './dto/registrar-domi-plataforma.dto';
import { Domicilio } from './entities/domicilio.entity';

@Controller('domicilios')
export class DomiciliosController {
  constructor(private readonly domiciliosService: DomiciliosService) { }

  @Post()
  create(@Body() createDomicilioDto: CreateDomicilioDto) {
    return this.domiciliosService.create(createDomicilioDto);
  }


  @Post('plataforma')
  registrarDomiPlataforma(@Body() dto: RegistrarDomiPlataformaDto): Promise<Domicilio> {
    return this.domiciliosService.registrarDomiPlataforma(dto);
  }

  @Get()
  findAll() {
    return this.domiciliosService.findAll();
  }

@Get('plataforma')
listarPlataforma(@Query('estado') estado: number): Promise<Domicilio[]> {
  return this.domiciliosService.findTipoPlataforma(estado);
}


  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.domiciliosService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateDomicilioDto: UpdateDomicilioDto) {
    return this.domiciliosService.update(+id, updateDomicilioDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.domiciliosService.remove(+id);
  }
}
