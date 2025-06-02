import { forwardRef, Module } from '@nestjs/common';
import { ImagenesService } from './imagenes.service';
import { ImagenesController } from './imagenes.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Imagen } from './entities/imagene.entity';
import { FileUploadModule } from 'src/common/file-upload.module';
import { AuthModule } from 'src/auth/auth.module';

@Module({
    imports: [TypeOrmModule.forFeature([Imagen]), FileUploadModule, forwardRef(() => AuthModule)],

  controllers: [ImagenesController],
  providers: [ImagenesService],
})
export class ImagenesModule {}
