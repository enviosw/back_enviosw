import { PartialType } from '@nestjs/mapped-types';
import { CreateTiposComercioDto } from './create-tipos_comercio.dto';

export class UpdateTiposComercioDto extends PartialType(CreateTiposComercioDto) {}
