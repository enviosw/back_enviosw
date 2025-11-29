import { IsString, IsNotEmpty, IsBoolean, IsInt, Length, IsOptional } from 'class-validator';

export class CreateDomiliarioDto {
  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  nombre: string;

  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  apellido: string;

  @IsString()
  @IsOptional()
  alias: string;

  @IsString()
  @IsNotEmpty()
  @Length(1, 15)
  telefono_whatsapp: string;

  @IsString()
  @IsNotEmpty()
  @Length(1, 15)
  placa_moto: string;

  @IsInt()
  @IsNotEmpty()
  numero_chaqueta: number;

  @IsString()
  @IsNotEmpty()
  @Length(1, 255)
  direccion_residencia: string;

  @IsBoolean()
  @IsOptional()
  estado?: boolean;

  @IsBoolean()
  @IsOptional()
  disponible?: boolean;

  @IsInt()
  @IsOptional()
  turno_orden?: number;


    // 👇 NUEVO: horario opcional (string o null)
  @IsString()
  @IsOptional()
  @Length(1, 50)
  horario?: string | null;

  // 👇 NUEVO: descanso opcional (string o null)
  @IsString()
  @IsOptional()
  @Length(1, 50)
  descanso?: string | null;
}
