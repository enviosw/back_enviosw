// src/comercios/comercios-qr.module.ts
import { Module } from '@nestjs/common';
import { ComerciosQrController } from './comercios-qr.controller';
import { QrModule } from './qr.module';
import { ShortlinksModule } from '../shortlinks/shortlinks.module';

@Module({
  imports: [QrModule, ShortlinksModule],
  controllers: [ComerciosQrController],
})
export class ComerciosQrModule {}
