import { IsString, IsEmail, MinLength, IsOptional, IsNumber } from 'class-validator';

export class CreateUsuarioDto {
  @IsString()
  readonly nombre: string;

  @IsEmail()
  readonly email: string;

  @IsString()
  @MinLength(6)
  readonly password: string;

  @IsString()
  @IsOptional()
  readonly rol?: string;

  @IsOptional()
  readonly estado?: string;

  @IsOptional()
  @IsNumber()
  readonly comercio_id?: number; // 👈 agrega esto

  @IsString()
  @IsOptional()
  readonly telefono?: string;

  @IsString()
  @IsOptional()
  readonly direccion?: string;
}
