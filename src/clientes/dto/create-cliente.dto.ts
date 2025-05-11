import { IsEmail, IsNotEmpty, IsNumber, IsOptional, IsString, Length } from "class-validator";



export class CreateClienteDto {

    @IsString()
    @IsNotEmpty({ message: 'El nombre es obligatorio' })
    @Length(3, 150)
    name: string;

    @IsString()
    @IsNotEmpty({ message: 'El apellido es obligatorio' })
    @Length(3, 150)
    lastName: string;

    @IsEmail()
    @IsNotEmpty({ message: 'El email es obligatorio' })
    @Length(5, 255)
    email: string;

    @IsString()
    @IsNotEmpty({ message: 'La contraseña es obligatoria' })
    @Length(6, 255)
    password: string;

    @IsString()
    @IsNotEmpty({ message: 'El teléfono es obligatorio' })
    @Length(6, 20)
    phone: string;

    @IsString()
    @IsOptional()
    phone_2: string;

    @IsString()
    @IsNotEmpty({ message: 'La dirección es obligatoria' })
    @Length(6, 255)
    address: string;

    @IsString()
    @IsNotEmpty({ message: 'El estado es obligatorio' })
    @Length(3, 20)
    status: string;

    @IsNumber()
    @IsNotEmpty({ message: 'El rol es obligatorio' })
    rol_id: number;

}
