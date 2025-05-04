// src/productos/dto/create-producto.dto.ts
import { IsString, IsNumber, IsOptional, IsEnum } from 'class-validator';

export class CreateProductoDto {
  @IsString()
  readonly nombre: string;

  @IsString()
  readonly descripcion: string;

  @IsNumber()
  readonly precio: number;

  @IsOptional() // Hacer el campo opcional
  @IsNumber()
  readonly precio_descuento?: number;

  @IsOptional() // Hacer el campo opcional
  @IsEnum(['activo', 'inactivo']) // Validar que el estado sea "activo" o "inactivo"
  readonly estado?: string;

  @IsOptional() // Hacer el campo opcional
  @IsEnum(['activo', 'inactivo']) // Validar que el estado del descuento sea "activo" o "inactivo"
  readonly estado_descuento?: string;

  @IsString()
  readonly unidad: string;

  @IsNumber()
  readonly categoriaId: number; // ID de la categoría asociada al producto

  @IsNumber()
  readonly comercioId: number; // ID del comercio con el que se asocia el producto
}
