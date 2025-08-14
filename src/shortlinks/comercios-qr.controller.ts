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
    const link = await this.sl.ensureForCommerce(commerceId);
    const shortUrl = `${process.env.PUBLIC_BASE_URL || 'http://localhost:3000'}/s/${link.slug}`;
    const png = await this.qr.forShortUrl(shortUrl);
    return {
      comercioId: commerceId,
      slug: link.slug,
      shortUrl,
      imageUrl: png.imageUrl,     // <- pega esto en tu panel / compártelo
      imagePath: png.imagePath,
      targetUrl: link.targetUrl,  // a donde redirige
      active: link.active,
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
