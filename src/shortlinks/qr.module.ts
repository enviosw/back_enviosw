// src/qr/qr.module.ts
import { Module } from '@nestjs/common';
import { QrService } from './qr.service';

@Module({
  providers: [QrService],
  exports: [QrService],
})
export class QrModule {}
