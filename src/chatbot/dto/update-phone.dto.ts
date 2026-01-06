import { IsNotEmpty, Matches, Length } from 'class-validator';

export class UpdatePhoneDto {
  @IsNotEmpty()
  @Matches(/^\d+$/, { message: 'Solo números' })
  @Length(12, 13, { message: 'Debe venir con 57 (ej: 573108054942)' })
  value: string;
}
