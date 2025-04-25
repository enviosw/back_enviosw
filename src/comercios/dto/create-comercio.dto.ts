// src/comercios/dto/create-comercio.dto.ts
import { IsString, IsEmail, IsOptional, IsBoolean, Length, IsNotEmpty } from 'class-validator';

export class CreateComercioDto {
    @IsString()
    @Length(3, 150)
    @IsNotEmpty()
    nombre_comercial: string;

    @IsString()
    @Length(3, 200)
    @IsNotEmpty()
    razon_social: string;

    @IsString()
    @Length(5, 20)
    @IsNotEmpty()
    nit: string;

    @IsString()
    @Length(10, 255)
    @IsNotEmpty()
    descripcion: string;

    @IsString()
    @IsNotEmpty()
    categoria: string;

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
    telefono_secundario: string

    @IsString()
    @Length(10, 255)
    direccion: string;

    @IsOptional()
    @IsString()
    logo_url?: string;

    @IsOptional()
    @IsBoolean()
    activo?: boolean;
}
