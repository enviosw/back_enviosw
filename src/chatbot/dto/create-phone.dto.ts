import { IsNotEmpty, Matches, Length } from 'class-validator';

export class CreatePhoneDto {
  @IsNotEmpty()
  @Matches(/^\d+$/)
  @Length(8, 15)
  value: string;
}
