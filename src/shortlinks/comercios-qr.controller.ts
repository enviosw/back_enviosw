// src/comercios/comercios-qr.controller.ts
import { Controller, Param, Post, Patch } from '@nestjs/common';
import { QrService } from './qr.service';
import { ShortlinksService } from '../shortlinks/shortlinks.service';

@Controller('comercios')
export class ComerciosQrController {
  constructor(
    private readonly qr: QrService,
    private readonly sl: ShortlinksService,
  ) {}

  // Genera (o reusa) el QR de un comercio
  @Post(':id/qr')
  async issueQr(@Param('id') id: string) {
    const commerceId = Number(id);

    // construye la URL final usando tu env DESTINO_BASE
    const base = process.env.DESTINO_BASE || 'https://domiciliosw.com/comercio';
    const targetUrl = `${base}/${commerceId}/productos`;

    const png = await this.qr.forUrl(targetUrl);
    return {
      comercioId: commerceId,
      targetUrl,            // <- ahora el QR apunta directo aquí
      imageUrl: png.imageUrl,
      imagePath: png.imagePath,
    };
  }

  // Invalidar (deja de funcionar sin reimprimir)
  @Patch(':id/qr/invalidate')
  async invalidate(@Param('id') id: string) {
    const r = await this.sl.invalidate(Number(id));
    return r ? { ok: true } : { ok: false, error: 'not_found' };
  }

  // Activar nuevamente
  @Patch(':id/qr/activate')
  async activate(@Param('id') id: string) {
    const r = await this.sl.activate(Number(id));
    return r ? { ok: true } : { ok: false, error: 'not_found' };
  }

  // (Opcional) Actualizar destino si cambia la ruta real
  @Patch(':id/qr/retarget')
  async retarget(@Param('id') id: string) {
    const r = await this.sl.updateTargetToCurrent(Number(id));
    return r ? { ok: true } : { ok: false, error: 'not_found' };
  }
}
