import { Injectable } from '@nestjs/common';
import { parseApiEnvironment } from '@tradenest/config';
import { jwtVerify, SignJWT } from 'jose';
import { randomUUID } from 'node:crypto';
import type { UserRole } from './auth.types.js';

export interface AccessTokenClaims {
  userId: string;
  sessionId: string;
  role: UserRole;
}

@Injectable()
export class AccessTokenService {
  private readonly environment = parseApiEnvironment(process.env);
  private readonly secret = new TextEncoder().encode(this.environment.JWT_ACCESS_SECRET);

  async sign(input: AccessTokenClaims): Promise<string> {
    return new SignJWT({ sid: input.sessionId, role: input.role })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject(input.userId)
      .setIssuer(this.environment.JWT_ISSUER)
      .setAudience(this.environment.JWT_AUDIENCE)
      .setJti(randomUUID())
      .setIssuedAt()
      .setExpirationTime(`${this.environment.JWT_ACCESS_TTL_SECONDS}s`)
      .sign(this.secret);
  }

  async verify(token: string): Promise<AccessTokenClaims> {
    const { payload } = await jwtVerify(token, this.secret, {
      algorithms: ['HS256'],
      issuer: this.environment.JWT_ISSUER,
      audience: this.environment.JWT_AUDIENCE,
    });

    const role = payload.role;
    const sessionId = payload.sid;
    if (!payload.sub || typeof sessionId !== 'string' || !this.isRole(role)) {
      throw new Error('Invalid access token claims.');
    }

    return { userId: payload.sub, sessionId, role };
  }

  get expiresInSeconds(): number {
    return this.environment.JWT_ACCESS_TTL_SECONDS;
  }

  private isRole(value: unknown): value is UserRole {
    return value === 'BUYER' || value === 'SELLER' || value === 'ADMIN';
  }
}
