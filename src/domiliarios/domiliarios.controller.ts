import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { DomiliariosService } from './domiliarios.service';
import { CreateDomiliarioDto } from './dto/create-domiliario.dto';
import { UpdateDomiliarioDto } from './dto/update-domiliario.dto';

@Controller('domiliarios')
export class DomiliariosController {
  constructor(private readonly domiliariosService: DomiliariosService) {}

  @Post()
  create(@Body() createDomiliarioDto: CreateDomiliarioDto) {
    return this.domiliariosService.create(createDomiliarioDto);
  }

  @Get()
  findAll() {
    return this.domiliariosService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.domiliariosService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateDomiliarioDto: UpdateDomiliarioDto) {
    return this.domiliariosService.update(+id, updateDomiliarioDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.domiliariosService.remove(+id);
  }
}
