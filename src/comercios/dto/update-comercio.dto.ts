import { PartialType } from '@nestjs/mapped-types';
import { CreateComercioDto } from './create-comercio.dto';
import { IsBoolean, IsInt, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateComercioDto extends PartialType(CreateComercioDto) {
  @IsOptional()
  @IsBoolean()
  estado_comercio?: boolean;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === '' || value === undefined) return null;
    const n = Number(value);
    return Number.isNaN(n) ? value : n;
  })
  @IsInt()
  zonaId?: number | null;
}
