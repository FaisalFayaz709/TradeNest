import { Injectable } from '@nestjs/common';
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';

@Injectable()
export class RefreshTokenService {
  create(): { sessionId: string; token: string; hash: string } {
    const sessionId = randomUUID();
    return this.rotate(sessionId);
  }

  rotate(sessionId: string): { sessionId: string; token: string; hash: string } {
    const secret = randomBytes(32).toString('base64url');
    const token = `${sessionId}.${secret}`;
    return { sessionId, token, hash: this.hash(token) };
  }

  extractSessionId(token: string): string | null {
    const separator = token.indexOf('.');
    if (separator <= 0) return null;
    const sessionId = token.slice(0, separator);
    return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sessionId)
      ? sessionId
      : null;
  }

  hash(token: string): string {
    return createHash('sha256').update(token, 'utf8').digest('hex');
  }

  matches(token: string, expectedHash: string): boolean {
    const actual = Buffer.from(this.hash(token), 'hex');
    const expected = Buffer.from(expectedHash, 'hex');
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }
}
