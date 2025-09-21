import { Controller, Get, Query } from '@nestjs/common';
import { PrecioDomicilioService } from './precio-domicilio.service';

@Controller('precios-domicilio')
export class PrecioDomicilioController {
    constructor(private readonly svc: PrecioDomicilioService) { }

    @Get('sumas/hoy-por-domiciliario')
    async sumasHoyPorDomiciliario() {
        return this.svc.sumasDeHoyAgrupadasPorDomiciliario();
    }

    @Get('sumas/por-dia')
    async sumasPorDia(
        @Query('start') start?: string, // formato YYYY-MM-DD
        @Query('end') end?: string,     // formato YYYY-MM-DD
    ) {
        return this.svc.sumasPorDia(start, end);
    }
}
