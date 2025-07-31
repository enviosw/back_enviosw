import { IsString, IsOptional, IsInt, IsDateString } from 'class-validator';

export class CreateDomicilioDto {
    @IsString()
    mensaje_confirmacion: string;

    @IsInt()
    estado: number;


    @IsOptional()
    fecha?: string;

    @IsString()
    @IsOptional()
    hora?: string;

    @IsString()
    numero_cliente: string;

     @IsOptional()
    @IsInt()
    id_domiciliario?: number | null;

    @IsOptional()
    @IsInt()
    id_cliente?: number | null;


    @IsString()
    tipo_servicio: string;

    @IsString()
    origen_direccion: string;

    @IsString()
    destino_direccion: string;

    @IsString()
    @IsOptional()
    telefono_contacto_origen?: string;

    @IsString()
    @IsOptional()
    telefono_contacto_destino?: string;

    @IsString()
    @IsOptional()
    notas?: string;

    @IsString()
    @IsOptional()
    detalles_pedido?: string;

    @IsString()
    @IsOptional()
    foto_entrega_url?: string;
}
