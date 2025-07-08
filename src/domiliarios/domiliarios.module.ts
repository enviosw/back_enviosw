import { Module } from '@nestjs/common';
import { DomiliariosService } from './domiliarios.service';
import { DomiliariosController } from './domiliarios.controller';

@Module({
  controllers: [DomiliariosController],
  providers: [DomiliariosService],
})
export class DomiliariosModule {}
