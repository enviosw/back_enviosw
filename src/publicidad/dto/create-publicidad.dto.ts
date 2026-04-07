// src/publicidad/dto/create-publicidad.dto.ts
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsDateString,
  Min,
  MaxLength,
} from 'class-validator';

export class CreatePublicidadDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  imagen?: string;

  @IsString()
  ruta: string;

  @IsOptional()
  @Type(() => Number)  // ✅ convierte "1" -> 1
  @IsInt()
  estado?: number;

  @IsOptional()
  @Type(() => Number)  // ✅ convierte "1" -> 1
  @IsInt()
  @Min(1)
  orden?: number;

  @IsOptional()
  @IsDateString()
  fecha_inicio?: string;

  @IsOptional()
  @IsDateString()
  fecha_fin?: string;
}
