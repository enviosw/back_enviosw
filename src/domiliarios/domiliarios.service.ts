import { Injectable } from '@nestjs/common';
import { CreateDomiliarioDto } from './dto/create-domiliario.dto';
import { UpdateDomiliarioDto } from './dto/update-domiliario.dto';

@Injectable()
export class DomiliariosService {
  create(createDomiliarioDto: CreateDomiliarioDto) {
    return 'This action adds a new domiliario';
  }

  findAll() {
    return `This action returns all domiliarios`;
  }

  findOne(id: number) {
    return `This action returns a #${id} domiliario`;
  }

  update(id: number, updateDomiliarioDto: UpdateDomiliarioDto) {
    return `This action updates a #${id} domiliario`;
  }

  remove(id: number) {
    return `This action removes a #${id} domiliario`;
  }
}
