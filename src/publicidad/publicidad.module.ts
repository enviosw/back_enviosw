import { Module } from '@nestjs/common';
import { PublicidadService } from './publicidad.service';
import { PublicidadController } from './publicidad.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Publicidad } from './entities/publicidad.entity';
import { FileUploadModule } from '../common/file-upload.module'; // ajusta ruta

@Module({
  imports: [
    TypeOrmModule.forFeature([Publicidad]),
    FileUploadModule, // ✅ para tener FileUploadService accesible
  ],
  controllers: [PublicidadController],
  providers: [PublicidadService],
})
export class PublicidadModule {}
