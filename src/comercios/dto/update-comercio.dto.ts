import { PartialType } from '@nestjs/mapped-types';
import { CreateComercioDto } from './create-comercio.dto';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateComercioDto extends PartialType(CreateComercioDto) {


      // Campo para el estado de comercio (abierto o cerrado)
  @IsOptional()
  @IsBoolean()
  estado_comercio?: boolean; // true = abierto, false = cerrado
}
