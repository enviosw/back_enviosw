import { Controller, Post, Get, Delete, Param, UploadedFile, UseInterceptors, Body, UseGuards } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ImagenesService } from './imagenes.service';
import { CreateImagenDto } from './dto/create-imagene.dto';
import { FileUploadService } from '../common/file-upload.service';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AuthGuard } from '../auth/auth.guard';

@Controller('imagenes')
export class ImagenesController {
  constructor(private readonly imagenesService: ImagenesService) { }

  @Post('subir')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('administrador')
  @UseInterceptors(FileInterceptor('archivo', { storage: FileUploadService.storage }))
  async subir(
    @UploadedFile() archivo: Express.Multer.File,
    @Body() body: CreateImagenDto,
  ) {
    return this.imagenesService.crear(body, archivo.filename);
  }

  @Get()
  listar() {
    return this.imagenesService.listar();
  }

  @Delete(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('administrador')
  eliminar(@Param('id') id: number) {
    return this.imagenesService.eliminar(id);
  }
}
