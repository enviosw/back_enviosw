import { Transform } from 'class-transformer';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @IsString()
  @MinLength(1)
  nombre: string;

  @IsString()
  @IsOptional()
  @Transform(({ value }) => value ?? '')
  apellido?: string;

  @IsString()
  @IsOptional()
  @Transform(({ value }) => value ?? '')
  direccion?: string;

  @IsString()
  @IsOptional()
  @Transform(({ value }) => value ?? '')
  telefono?: string;

  @IsString()
  @IsOptional()
  @Transform(({ value }) => value ?? '')
  telefono2?: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  @Transform(({ value }) => value.trim())
  password: string;

  @IsString()
  rol: string;
}
