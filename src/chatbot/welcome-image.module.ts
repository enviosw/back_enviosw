// welcome-image.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WelcomeImage } from './entities/welcome-image.entity';
import { WelcomeImageService } from './welcome-image.service';
import { WelcomeImageController } from './welcome-image.controller';
import { FileUploadModule } from '../common/file-upload.module';

@Module({
  imports: [TypeOrmModule.forFeature([WelcomeImage]), FileUploadModule],
  providers: [WelcomeImageService],
  controllers: [WelcomeImageController],
  exports: [WelcomeImageService],
})
export class WelcomeImageModule {}
