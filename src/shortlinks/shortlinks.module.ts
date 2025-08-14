// src/shortlinks/shortlinks.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShortLink } from './entities/shortlink.entity';
import { ShortlinksService } from './shortlinks.service';
import { ShortlinksController } from './shortlinks.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ShortLink])],
  providers: [ShortlinksService],
  controllers: [ShortlinksController],
  exports: [ShortlinksService],
})
export class ShortlinksModule {}
