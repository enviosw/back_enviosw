import { IsString, IsEmail, MinLength, IsOptional, IsBoolean } from 'class-validator';

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

  @IsBoolean()
  @IsOptional()
  readonly estado?: boolean;
}
