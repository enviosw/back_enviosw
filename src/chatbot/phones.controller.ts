import { Body, Controller, Get, Patch, Post } from '@nestjs/common';
import { PhonesService } from './phones.service';
import { CreatePhoneDto } from './dto/create-phone.dto';
import { UpdatePhoneDto } from './dto/update-phone.dto';

@Controller('phones')
export class PhonesController {
  constructor(private readonly phonesService: PhonesService) {}

  // (opcional) crear genérico
  @Post()
  create(@Body() dto: CreatePhoneDto) {
    return this.phonesService.create(dto);
  }

  // ✅ CUENTAS
  @Get('cuentas')
  getCuentas() {
    return this.phonesService.getCuentas();
  }

  @Patch('cuentas')
  updateCuentas(@Body() dto: UpdatePhoneDto) {
    return this.phonesService.updateCuentas(dto.value);
  }

  // ✅ QUEJAS
  @Get('quejas')
  getQuejas() {
    return this.phonesService.getQuejas();
  }

  @Patch('quejas')
  updateQuejas(@Body() dto: UpdatePhoneDto) {
    return this.phonesService.updateQuejas(dto.value);
  }
}
