// src/shortlinks/shortlinks.controller.ts
import { Controller, Get, Param, Res } from '@nestjs/common';
import { Response } from 'express';
import { ShortlinksService } from './shortlinks.service';

@Controller('s')
export class ShortlinksController {
  constructor(private readonly svc: ShortlinksService) {}

  @Get(':slug')
  async resolve(@Param('slug') slug: string, @Res() res: Response) {
    const link = await this.svc.findBySlug(slug);
    if (!link) return res.status(404).send('No encontrado');

    const now = new Date();
    const active =
      link.active &&
      (!link.validFrom || link.validFrom <= now) &&
      (!link.validTo || link.validTo >= now);

    if (!active) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(410).send('QR invalidado');
    }

    // Evita cache de la redirección
    res.setHeader('Cache-Control', 'no-store');
    return res.redirect(302, link.targetUrl);
  }
}
