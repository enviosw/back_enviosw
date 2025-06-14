// src/productos/productos.controller.ts
import { Controller, Get, Post, Body, Param, Query, UseInterceptors, UploadedFile, Patch, UseGuards } from '@nestjs/common';
import { ProductosService } from './productos.service';
import { CreateProductoDto } from './dto/create-producto.dto';
import { Producto } from './entities/producto.entity';
import { ProductoQuery } from './interfaces/producto-query.interface';
import { FileInterceptor } from '@nestjs/platform-express';
import { FileUploadService } from '../common/file-upload.service'; // Importar el servicio de subida
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AuthGuard } from '../auth/auth.guard';

@Controller('productos')
export class ProductosController {
  constructor(private readonly productosService: ProductosService,
    private readonly fileUploadService: FileUploadService,
  ) { }

  @Post()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('aliado')
  @UseInterceptors(
    FileInterceptor('logo', { storage: FileUploadService.storage }),
  )
  async create(
    @Body() createProductoDto: CreateProductoDto,
    @UploadedFile() file: Express.Multer.File,
  ) {

    console.log('🖼️ Archivo recibido:', file);

    if (file) {
      createProductoDto.imagen_url = file.filename; // o la propiedad que uses para guardar la imagen
    }

    return this.productosService.create(createProductoDto);
  }

  @Get()
  findAll(@Query() query: ProductoQuery) {
    return this.productosService.findAll(query);
  }

  @Get('comercio')
  async findAllProductos(
    @Query('comercio_id') comercioId: number,
    @Query('categoria_id') categoriaId?: number,
    @Query('search') search?: string,
    @Query('page') page: number = 1,
  ) {
    return this.productosService.findProductosByComercio(comercioId, categoriaId, search, page);
  }



  @Patch(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('aliado')
  @UseInterceptors(FileInterceptor('logo', { storage: FileUploadService.storage }))
  async update(
    @Param('id') id: number,
    @Body() updateProductoDto: CreateProductoDto, // puedes usar UpdateProductoDto si prefieres
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (file) {
      updateProductoDto.imagen_url = file.filename;
    }

    return this.productosService.update(id, updateProductoDto);
  }



  @Get('/buscar/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('aliado')
  findOne(@Param('id') id: string): Promise<Producto> {
    return this.productosService.findOne(+id);
  }
}
