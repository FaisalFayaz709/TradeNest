import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import type { DatabaseTransactionContext } from '../../database/database-transaction.service.js';
import { DuplicateEmailRepositoryError } from './auth.errors.js';
import type {
  AuthSessionRecord,
  AuthUserRecord,
  SessionMetadata,
  UserRole,
} from './auth.types.js';

interface CreateUserWithSessionInput {
  userId: string;
  sessionId: string;
  email: string;
  passwordHash: string;
  name: string;
  role: Exclude<UserRole, 'ADMIN'>;
  refreshTokenHash: string;
  expiresAt: Date;
  metadata: SessionMetadata;
}

interface CreateSessionInput {
  sessionId: string;
  userId: string;
  refreshTokenHash: string;
  expiresAt: Date;
  metadata: SessionMetadata;
}

@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  async isAccountActive(userId: string, transaction?: DatabaseTransactionContext): Promise<boolean> {
    return (await (transaction?.client ?? this.prisma).user.count({
      where: { id: userId, status: 'ACTIVE' },
    })) === 1;
  }

  async findUserByEmail(email: string): Promise<AuthUserRecord | null> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    return user ? this.mapUser(user) : null;
  }

  async findUserById(userId: string): Promise<AuthUserRecord | null> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    return user ? this.mapUser(user) : null;
  }

  async createUserWithSession(input: CreateUserWithSessionInput): Promise<AuthUserRecord> {
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const user = await transaction.user.create({
          data: {
            id: input.userId,
            email: input.email,
            passwordHash: input.passwordHash,
            name: input.name,
            role: input.role,
            status: 'ACTIVE',
          },
        });

        await transaction.userSession.create({
          data: {
            id: input.sessionId,
            userId: input.userId,
            refreshTokenHash: input.refreshTokenHash,
            expiresAt: input.expiresAt,
            ...(input.metadata.ipAddress ? { ipAddress: input.metadata.ipAddress } : {}),
            ...(input.metadata.userAgent ? { userAgent: input.metadata.userAgent } : {}),
          },
        });

        return this.mapUser(user);
      });
    } catch (error) {
      if (this.isUniqueConstraintError(error)) throw new DuplicateEmailRepositoryError();
      throw error;
    }
  }

  async createSession(input: CreateSessionInput): Promise<void> {
    await this.prisma.userSession.create({
      data: {
        id: input.sessionId,
        userId: input.userId,
        refreshTokenHash: input.refreshTokenHash,
        expiresAt: input.expiresAt,
        ...(input.metadata.ipAddress ? { ipAddress: input.metadata.ipAddress } : {}),
        ...(input.metadata.userAgent ? { userAgent: input.metadata.userAgent } : {}),
      },
    });
  }

  async findSession(sessionId: string): Promise<AuthSessionRecord | null> {
    const session = await this.prisma.userSession.findUnique({
      where: { id: sessionId },
      include: { user: true },
    });
    if (!session) return null;
    return {
      id: session.id,
      userId: session.userId,
      refreshTokenHash: session.refreshTokenHash,
      expiresAt: session.expiresAt,
      revokedAt: session.revokedAt,
      user: this.mapUser(session.user),
    };
  }

  async rotateRefreshToken(input: {
    sessionId: string;
    expectedHash: string;
    newHash: string;
    expiresAt: Date;
    metadata: SessionMetadata;
  }): Promise<boolean> {
    const result = await this.prisma.userSession.updateMany({
      where: {
        id: input.sessionId,
        refreshTokenHash: input.expectedHash,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: {
        refreshTokenHash: input.newHash,
        expiresAt: input.expiresAt,
        ...(input.metadata.ipAddress ? { ipAddress: input.metadata.ipAddress } : {}),
        ...(input.metadata.userAgent ? { userAgent: input.metadata.userAgent } : {}),
      },
    });
    return result.count === 1;
  }

  async revokeSession(sessionId: string, userId: string): Promise<boolean> {
    const result = await this.prisma.userSession.updateMany({
      where: { id: sessionId, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return result.count === 1;
  }

  async revokeAllSessions(userId: string): Promise<number> {
    const result = await this.prisma.userSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return result.count;
  }

  async changePasswordAndRevokeSessions(userId: string, passwordHash: string): Promise<number> {
    return this.prisma.$transaction(async (transaction) => {
      await transaction.user.update({ where: { id: userId }, data: { passwordHash } });
      const result = await transaction.userSession.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      return result.count;
    });
  }

  private mapUser(user: {
    id: string;
    email: string;
    passwordHash: string;
    name: string;
    role: UserRole;
    status: 'ACTIVE' | 'SUSPENDED' | 'BANNED';
  }): AuthUserRecord {
    return {
      id: user.id,
      email: user.email,
      passwordHash: user.passwordHash,
      name: user.name,
      role: user.role,
      status: user.status,
    };
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: unknown }).code === 'P2002';
  }
}
