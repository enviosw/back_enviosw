import { IsString, IsOptional, IsNotEmpty, IsHexColor, IsInt } from 'class-validator';

export class CreateServicioDto {
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @IsString()
  estado: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsHexColor()
  color?: string;

  @IsOptional()
  @IsInt()
  orden?: number;

  @IsOptional()
  @IsString()
  foto?: string; // <-- Añadido aquí
}
