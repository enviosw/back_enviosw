import { Controller, Get, Post, Body, Patch, Param, Delete, UseInterceptors, UploadedFile, ParseIntPipe, Query } from '@nestjs/common';
import { ComerciosService } from './comercios.service';
import { CreateComercioDto } from './dto/create-comercio.dto';
import { UpdateComercioDto } from './dto/update-comercio.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { FileUploadService } from 'src/common/file-upload.service'; // Importar el servicio de subida
import { Comercio } from './entities/comercio.entity';

@Controller('comercios')
export class ComerciosController {
  constructor(
    private readonly comerciosService: ComerciosService,
    private readonly fileUploadService: FileUploadService,
  ) { }

  // Crear un nuevo comercio y subir una imagen
  @Post()
  @UseInterceptors(FileInterceptor('logo', { storage: FileUploadService.storage })) // 'logo' es el nombre del campo del formulario
  async create(@Body() createComercioDto: CreateComercioDto, @UploadedFile() file: Express.Multer.File) {
    if (file) {
      createComercioDto.logo_url = file.filename;  // Guardamos el nombre del archivo en la base de datos
    }
    return this.comerciosService.create(createComercioDto);
  }

  @Get()
  findAll() {
    return this.comerciosService.findAll();
  }


  @Get('publicos')
  async findAllComercios(@Query('servicio_id') servicioId: number): Promise<Comercio[]> {
      return this.comerciosService.findComerciosByServicio(servicioId);
  }
  

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.comerciosService.findOne(id);
  }

  // Actualizar un comercio y su logo
  @Patch(':id')
  @UseInterceptors(FileInterceptor('logo', { storage: FileUploadService.storage })) // 'logo' es el nombre del campo del formulario
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateComercioDto: UpdateComercioDto,
    @UploadedFile() file: Express.Multer.File,  // Aquí se recibe el archivo
  ) {
    if (file) {
      updateComercioDto.logo_url = file.filename;  // Actualizamos el nombre del archivo
    }
    return this.comerciosService.update(id, updateComercioDto);
  }

  // Eliminar un comercio
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.comerciosService.remove(id);
  }
}
