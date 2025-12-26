import {
  Controller, Get, Post, Body, Patch, Param, Delete,
  ParseIntPipe, UseInterceptors, UploadedFile
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PublicidadService } from './publicidad.service';
import { CreatePublicidadDto } from './dto/create-publicidad.dto';
import { UpdatePublicidadDto } from './dto/update-publicidad.dto';
import { FileUploadService } from '../common/file-upload.service'; // AJUSTA RUTA

@Controller('publicidad')
export class PublicidadController {
  constructor(private readonly publicidadService: PublicidadService) {}

  @Post()
  @UseInterceptors(FileInterceptor('imagen', { storage: FileUploadService.storage }))
  create(
    @Body() dto: CreatePublicidadDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.publicidadService.create(dto, file);
  }

  @Get()
  findAll() {
    return this.publicidadService.findAll();
  }

  @Get('vigentes/slider')
  findSlider() {
    return this.publicidadService.findVigentesParaSlider();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.publicidadService.findOne(id);
  }

  @Patch(':id')
  @UseInterceptors(FileInterceptor('imagen', { storage: FileUploadService.storage }))
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePublicidadDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.publicidadService.update(id, dto, file);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.publicidadService.remove(id);
  }
}
