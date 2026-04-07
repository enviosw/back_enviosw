// welcome-image.controller.ts
import { Controller, Post, Get, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { WelcomeImageService } from './welcome-image.service';
import { FileUploadService } from '../common/file-upload.service';

@Controller('welcome-image')
export class WelcomeImageController {
  constructor(private service: WelcomeImageService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('image', {
      storage: FileUploadService.storage,
    }),
  )
  async upload(@UploadedFile() file: Express.Multer.File) {
    return this.service.saveImage(`/uploads/${file.filename}`);
  }

  @Get()
  get() {
    return this.service.getImage();
  }
}
