import { PartialType } from '@nestjs/mapped-types';
import { CreatePublicidadDto } from './create-publicidad.dto';

export class UpdatePublicidadDto extends PartialType(CreatePublicidadDto) {}
