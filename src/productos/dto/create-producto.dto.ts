import { IsString, IsNumber, IsOptional, IsEnum } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateProductoDto {
  @IsString()
  readonly nombre: string;

  @IsString()
  readonly descripcion: string;

  @Transform(({ value }) => Number(value))
  @IsNumber()
  readonly precio: number;

  @IsOptional()
  @Transform(({ value }) =>
    value !== undefined && value !== null && value !== '' ? Number(value) : undefined,
  )
  @IsNumber()
  readonly precio_descuento?: number;

  @IsOptional()
  @IsEnum(['activo', 'inactivo'])
  readonly estado?: string;

  @IsOptional()
  @IsEnum(['activo', 'inactivo'])
  readonly estado_descuento?: string;

  @IsString()
  readonly unidad: string;

  @Transform(({ value }) => Number(value))
  @IsNumber()
  readonly categoriaId: number;

  @Transform(({ value }) => Number(value))
  @IsNumber()
  readonly comercioId: number;

  @IsOptional()
  imagen_url?: string; // nombre del archivo
}
