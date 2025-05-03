// src/tipos-comercio/dto/create-tipos_comercio.dto.ts
import { IsString, Length } from 'class-validator';

export class CreateTiposComercioDto {
  @IsString()
  @Length(2, 100)
  nombre: string;

  @IsString()
  @Length(5, 255)
  descripcion: string;
}
