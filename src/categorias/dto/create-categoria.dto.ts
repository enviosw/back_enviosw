// src/categories/dto/create-categoria.dto.ts
import { IsString, IsInt, IsNotEmpty } from 'class-validator';

export class CreateCategoriaDto {
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @IsInt()
  comercioId: number; // ID del comercio con el que se asocia la categoría
}
