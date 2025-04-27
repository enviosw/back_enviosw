import { PartialType } from '@nestjs/mapped-types';
import { CreateRolDto } from './create-role.dto';

export class UpdateRolDto extends PartialType(CreateRolDto) {}
