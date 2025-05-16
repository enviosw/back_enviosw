import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UploadedFile,
  UseInterceptors,
  ParseIntPipe,
} from '@nestjs/common';
import { ServiciosService } from './servicios.service';
import { CreateServicioDto } from './dto/create-servicio.dto';
import { UpdateServicioDto } from './dto/update-servicio.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { FileUploadService } from '../common/file-upload.service';
import { Servicio } from './entities/servicio.entity';

@Controller('servicios')
export class ServiciosController {
  constructor(
    private readonly serviciosService: ServiciosService,
    private readonly fileUploadService: FileUploadService,
  ) {}

  // Crear servicio con imagen
  @Post()
  @UseInterceptors(
    FileInterceptor('foto', { storage: FileUploadService.storage }),
  )
  async create(
    @Body() createServicioDto: CreateServicioDto,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<Servicio> {
    if (file) {
      createServicioDto.foto = file.filename; // Guarda el nombre del archivo en la columna foto
    }
    return this.serviciosService.create(createServicioDto);
  }

  @Get()
  async findAll(): Promise<Servicio[]> {
    return this.serviciosService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<Servicio> {
    return this.serviciosService.findOne(id);
  }

  // Actualizar servicio con imagen
  @Patch(':id')
  @UseInterceptors(
    FileInterceptor('foto', { storage: FileUploadService.storage }),
  )
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateServicioDto: UpdateServicioDto,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<Servicio> {
    if (file) {
      updateServicioDto.foto = file.filename; // Actualiza la columna foto
    }
    return this.serviciosService.update(id, updateServicioDto);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.serviciosService.remove(id);
  }
}
