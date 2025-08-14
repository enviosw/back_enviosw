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

  async forShortUrl(shortUrl: string) {
    const fileName = this.fileFor(shortUrl);
    const out = path.join(this.uploadDir, fileName);

    await fs.mkdir(this.uploadDir, { recursive: true });
    try { await fs.access(out); } catch {
      const buf = await QRCode.toBuffer(shortUrl, { width: 512, errorCorrectionLevel: 'M', margin: 1 });
      await fs.writeFile(out, buf);
    }

    return {
      shortUrl,
      imagePath: `/static/qrs/${fileName}`,                   // lo sirve Nginx
      imageUrl: `${this.publicBase}/static/qrs/${fileName}`,  // URL pública
    };
  }
}
