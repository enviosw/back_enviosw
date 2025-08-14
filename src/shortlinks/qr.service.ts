// src/qr/qr.service.ts
import { Injectable } from '@nestjs/common';
import * as QRCode from 'qrcode';
import { promises as fs } from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';

@Injectable()
export class QrService {
  private uploadDir = process.env.QR_UPLOAD_DIR || path.resolve(process.cwd(), 'uploads', 'qrs');
  private publicBase = process.env.PUBLIC_BASE_URL || 'http://localhost:3000';

  private fileFor(content: string) {
    const hash = createHash('sha256').update(content).digest('hex').slice(0, 16);
    return `${hash}.png`;
  }

  // NUEVO: genera QR para cualquier URL FINAL
  async forUrl(url: string) {
    const fileName = this.fileFor(url);
    const out = path.join(this.uploadDir, fileName);

    await fs.mkdir(this.uploadDir, { recursive: true });
    try { await fs.access(out); } catch {
      const buf = await QRCode.toBuffer(url, { width: 512, errorCorrectionLevel: 'M', margin: 1 });
      await fs.writeFile(out, buf);
    }

    return {
      url,
      imagePath: `/api/qrs/${fileName}`,
      imageUrl: `${this.publicBase}/api/qrs/${fileName}`,
    };
  }

  // (opcional) dejas este si aún quieres soportar shortlinks
  async forShortUrl(shortUrl: string) {
    return this.forUrl(shortUrl);
  }
}
