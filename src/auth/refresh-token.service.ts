import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

interface StoredToken {
  userId: number;
  hashedToken: string;
}

@Injectable()
export class RefreshTokenService {
  private tokens: StoredToken[] = [];

  async save(userId: number, token: string) {
    const hashed = await bcrypt.hash(token, 10);

    // Reemplaza token existente del usuario
    this.tokens = this.tokens.filter((t) => t.userId !== userId);
    this.tokens.push({ userId, hashedToken: hashed });
  }

  async verify(userId: number, token: string): Promise<boolean> {
    const entry = this.tokens.find((t) => t.userId === userId);
    if (!entry) return false;

    const match = await bcrypt.compare(token, entry.hashedToken);
    return match;
  }

  async remove(userId: number) {
    this.tokens = this.tokens.filter((t) => t.userId !== userId);
  }
}
