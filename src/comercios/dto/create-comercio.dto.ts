import {
  IsString,
  IsEmail,
  IsOptional,
  Length,
  IsNotEmpty,
  IsBoolean,
  IsObject,
} from 'class-validator';

export class CreateComercioDto {
  @IsString()
  @Length(1, 150)
  @IsNotEmpty()
  nombre_comercial: string;

  @IsString()
  @Length(1, 200)
  @IsNotEmpty()
  razon_social: string;

  @IsString()
  @Length(4, 20)
  @IsNotEmpty()
  nit: string;

  @IsString()
  @Length(5, 255)
  @IsNotEmpty()
  descripcion: string;

  @IsString()
  @IsNotEmpty()
  responsable: string;

  @IsEmail()
  @IsNotEmpty()
  email_contacto: string;

  @IsString()
  @Length(7, 15)
  telefono: string;

  @IsString()
  @Length(7, 15)
  telefono_secundario: string;

  @IsString()
  @Length(4, 255)
  direccion: string;

  @IsOptional()
  @IsString()
  logo_url?: string;

  @IsNotEmpty()
  servicio_id: number;

  @IsOptional()
  estado?: string;

  // Nuevos campos para los horarios
  @IsOptional()
  @IsObject()
  horarios?: {
    lunes: { apertura: string, cierre: string };
    martes: { apertura: string, cierre: string };
    miercoles: { apertura: string, cierre: string };
    jueves: { apertura: string, cierre: string };
    viernes: { apertura: string, cierre: string };
    sabado: { apertura: string, cierre: string };
    domingo: { apertura: string, cierre: string };
  };

  // Campo para el estado de comercio (abierto o cerrado)
  @IsOptional()
  @IsBoolean()
  estado_comercio?: boolean; // true = abierto, false = cerrado
}
