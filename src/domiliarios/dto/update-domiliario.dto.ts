import { PartialType } from '@nestjs/mapped-types';
import { CreateDomiliarioDto } from './create-domiliario.dto';

export class UpdateDomiliarioDto extends PartialType(CreateDomiliarioDto) {}
