import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { DomicilioEstado } from '../entities/domicilio.entity';

export class RegistrarDomiPlataformaDto {
  @IsEnum(DomicilioEstado)
  estado: DomicilioEstado;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  fecha?: Date;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  numero_cliente: string;

  @IsOptional()
  tipo_servicio: any;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  origen_direccion: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  destino_direccion: string;

  @IsOptional()
  @IsString()
  detalles_pedido?: string;
}
