import { IsNotEmpty, IsString } from 'class-validator';

export class CreateImagenDto {
  @IsString({ message: 'El nombre debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  nombre: string;
}
