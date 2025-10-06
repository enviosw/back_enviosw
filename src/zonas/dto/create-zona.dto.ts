import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateZonaDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nombre: string;
}
