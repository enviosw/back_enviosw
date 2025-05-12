import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseInterceptors,
  UploadedFile,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { ComerciosService } from './comercios.service';
import { CreateComercioDto } from './dto/create-comercio.dto';
import { UpdateComercioDto } from './dto/update-comercio.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { FileUploadService } from '../common/file-upload.service'; // Importar el servicio de subida
import { Comercio } from './entities/comercio.entity';

@Controller('comercios')
export class ComerciosController {
  constructor(
    private readonly comerciosService: ComerciosService,
    private readonly fileUploadService: FileUploadService,
  ) { }

  // Crear un nuevo comercio y subir una imagen
  @Post()
  @UseInterceptors(
    FileInterceptor('logo', { storage: FileUploadService.storage }),
  ) // 'logo' es el nombre del campo del formulario
  async create(
    @Body() createComercioDto: CreateComercioDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (file) {
      createComercioDto.logo_url = file.filename; // Guardamos el nombre del archivo en la base de datos
    }
    return this.comerciosService.create(createComercioDto);
  }

  // comercios.controller.ts
  @Get()
  findAll(
    @Query('page') page = 1,
    @Query('search') search?: string,
    @Query('estado') estado?: string,
    @Query('fechaInicio') fechaInicio?: string,
    @Query('fechaFin') fechaFin?: string,
  ) {
    return this.comerciosService.findAll({
      page: +page,
      search,
      estado,
      fechaInicio,
      fechaFin,
    });
  }

  @Get('publicos')
  async findAllComercios(
    @Query('servicio_id') servicioId: number,
    @Query('search') search?: string,
    @Query('page') page: number = 1,
  ) {
    return this.comerciosService.findComerciosByServicio(servicioId, search, page);
  }

  @Get('search')
  async searchAll(@Query('search') search: string) {
    return this.comerciosService.searchAll(search);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.comerciosService.findOne(id);
  }

  // Actualizar un comercio y su logo
  @Patch(':id')
  @UseInterceptors(
    FileInterceptor('logo', { storage: FileUploadService.storage }),
  ) // 'logo' es el nombre del campo del formulario
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateComercioDto: UpdateComercioDto,
    @UploadedFile() file: Express.Multer.File, // Aquí se recibe el archivo
  ) {
    if (file) {
      updateComercioDto.logo_url = file.filename; // Actualizamos el nombre del archivo
    }
    return this.comerciosService.update(id, updateComercioDto);
  }

  // Eliminar un comercio
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.comerciosService.remove(id);
  }


  // Obtener los horarios de un comercio por su ID
  @Get(':id/horarios')
  async getHorarios(@Param('id', ParseIntPipe) id: number) {
    return this.comerciosService.getHorariosByComercio(id);
  }

  // Actualizar los horarios de un comercio por su ID
  @Patch(':id/horarios')
  async updateHorarios(
    @Param('id', ParseIntPipe) id: number,
    @Body() horarios: any, // Se espera un objeto con los horarios a actualizar
  ) {
    return this.comerciosService.updateHorarios(id, horarios);
  }
}
