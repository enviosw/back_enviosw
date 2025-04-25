import { PartialType } from '@nestjs/mapped-types';
import { CreateComercioDto } from './create-comercio.dto';

export class UpdateComercioDto extends PartialType(CreateComercioDto) {}
