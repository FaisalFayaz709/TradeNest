import { Injectable } from '@nestjs/common';
import { parseApiEnvironment } from '@tradenest/config';
import type {
  AuthSession,
  ChangePasswordInput,
  ChangePasswordResult,
  LoginInput,
  LogoutAllResult,
  LogoutResult,
  RefreshInput,
  RegisterInput,
} from '@tradenest/contracts/auth';
import { randomUUID } from 'node:crypto';
import { ApiException } from '../../common/http/api-exception.js';
import type { DatabaseTransactionContext } from '../../database/database-transaction.service.js';
import { AccessTokenService } from './access-token.service.js';
import { DuplicateEmailRepositoryError } from './auth.errors.js';
import { AuthRepository } from './auth.repository.js';
import type { AuthUserRecord, SessionMetadata } from './auth.types.js';
import { PasswordService } from './password.service.js';
import { RefreshTokenService } from './refresh-token.service.js';
import type { AuthModuleApi, AuthPrincipal } from './public/module-api.js';

@Injectable()
export class AuthService implements AuthModuleApi {
  private readonly environment = parseApiEnvironment(process.env);

  constructor(
    private readonly repository: AuthRepository,
    private readonly passwords: PasswordService,
    private readonly refreshTokens: RefreshTokenService,
    private readonly accessTokens: AccessTokenService,
  ) {}

  async register(input: RegisterInput, metadata: SessionMetadata): Promise<AuthSession> {
    if (input.role === ('ADMIN' as typeof input.role)) {
      throw new ApiException(403, {
        code: 'ADMIN_PUBLIC_REGISTRATION_FORBIDDEN',
        message: 'Administrator accounts cannot be created through public registration.',
      });
    }

    const email = this.normalizeEmail(input.email);
    const passwordHash = await this.passwords.hash(input.password);
    const refresh = this.refreshTokens.create();
    const userId = randomUUID();

    try {
      const user = await this.repository.createUserWithSession({
        userId,
        sessionId: refresh.sessionId,
        email,
        passwordHash,
        name: input.name.trim(),
        role: input.role,
        refreshTokenHash: refresh.hash,
        expiresAt: this.refreshExpiry(),
        metadata,
      });
      return this.sessionResponse(user, refresh.sessionId, refresh.token);
    } catch (error) {
      if (error instanceof DuplicateEmailRepositoryError) {
        throw new ApiException(409, {
          code: 'EMAIL_ALREADY_REGISTERED',
          message: 'An account with this email already exists.',
        });
      }
      throw error;
    }
  }

  async login(input: LoginInput, metadata: SessionMetadata): Promise<AuthSession> {
    const email = this.normalizeEmail(input.email);
    const user = await this.repository.findUserByEmail(email);
    if (!user || !(await this.passwords.compare(input.password, user.passwordHash))) {
      throw new ApiException(401, {
        code: 'INVALID_CREDENTIALS',
        message: 'Email or password is incorrect.',
      });
    }
    this.assertActive(user);

    const refresh = this.refreshTokens.create();
    await this.repository.createSession({
      sessionId: refresh.sessionId,
      userId: user.id,
      refreshTokenHash: refresh.hash,
      expiresAt: this.refreshExpiry(),
      metadata,
    });
    return this.sessionResponse(user, refresh.sessionId, refresh.token);
  }

  async refresh(input: RefreshInput, metadata: SessionMetadata): Promise<AuthSession> {
    const sessionId = this.refreshTokens.extractSessionId(input.refreshToken);
    if (!sessionId) throw this.invalidRefresh();

    const session = await this.repository.findSession(sessionId);
    if (
      !session ||
      session.revokedAt !== null ||
      session.expiresAt <= new Date() ||
      !this.refreshTokens.matches(input.refreshToken, session.refreshTokenHash)
    ) {
      throw this.invalidRefresh();
    }
    this.assertActive(session.user);

    const rotated = this.refreshTokens.rotate(session.id);
    const didRotate = await this.repository.rotateRefreshToken({
      sessionId: session.id,
      expectedHash: session.refreshTokenHash,
      newHash: rotated.hash,
      expiresAt: this.refreshExpiry(),
      metadata,
    });
    if (!didRotate) throw this.invalidRefresh();

    return this.sessionResponse(session.user, session.id, rotated.token);
  }

  async isAccountActive(userId: string, transaction?: DatabaseTransactionContext): Promise<boolean> {
    return this.repository.isAccountActive(userId, transaction);
  }

  async authenticateAccessToken(token: string): Promise<AuthPrincipal> {
    let claims;
    try {
      claims = await this.accessTokens.verify(token);
    } catch {
      throw new ApiException(401, {
        code: 'INVALID_ACCESS_TOKEN',
        message: 'The access token is invalid or expired.',
      });
    }

    const session = await this.repository.findSession(claims.sessionId);
    if (
      !session ||
      session.userId !== claims.userId ||
      session.revokedAt !== null ||
      session.expiresAt <= new Date()
    ) {
      throw new ApiException(401, {
        code: 'SESSION_NOT_ACTIVE',
        message: 'The authenticated session is no longer active.',
      });
    }
    this.assertActive(session.user);

    return {
      userId: session.user.id,
      sessionId: session.id,
      email: session.user.email,
      name: session.user.name,
      role: session.user.role,
    };
  }

  async logout(principal: AuthPrincipal): Promise<LogoutResult> {
    return { revoked: await this.repository.revokeSession(principal.sessionId, principal.userId) };
  }

  async logoutAll(principal: AuthPrincipal): Promise<LogoutAllResult> {
    return { revokedSessions: await this.repository.revokeAllSessions(principal.userId) };
  }

  async me(principal: AuthPrincipal): Promise<AuthSession['user']> {
    return {
      id: principal.userId,
      email: principal.email,
      name: principal.name,
      role: principal.role,
    };
  }

  async changePassword(principal: AuthPrincipal, input: ChangePasswordInput): Promise<ChangePasswordResult> {
    const user = await this.repository.findUserById(principal.userId);
    if (!user || !(await this.passwords.compare(input.currentPassword, user.passwordHash))) {
      throw new ApiException(400, {
        code: 'CURRENT_PASSWORD_INCORRECT',
        message: 'The current password is incorrect.',
      });
    }
    this.assertActive(user);

    const passwordHash = await this.passwords.hash(input.newPassword);
    const sessionsRevoked = await this.repository.changePasswordAndRevokeSessions(user.id, passwordHash);
    return { changed: true, sessionsRevoked };
  }

  private async sessionResponse(user: AuthUserRecord, sessionId: string, refreshToken: string): Promise<AuthSession> {
    const accessToken = await this.accessTokens.sign({
      userId: user.id,
      sessionId,
      role: user.role,
    });
    return {
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      tokens: {
        accessToken,
        refreshToken,
        accessTokenExpiresIn: this.accessTokens.expiresInSeconds,
        refreshTokenExpiresIn: this.environment.REFRESH_TOKEN_TTL_SECONDS,
      },
    };
  }

  private refreshExpiry(): Date {
    return new Date(Date.now() + this.environment.REFRESH_TOKEN_TTL_SECONDS * 1000);
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private assertActive(user: AuthUserRecord): void {
    if (user.status !== 'ACTIVE') {
      throw new ApiException(403, {
        code: 'ACCOUNT_NOT_ACTIVE',
        message: 'This account is not permitted to authenticate.',
      });
    }
  }

  private invalidRefresh(): ApiException {
    return new ApiException(401, {
      code: 'INVALID_REFRESH_TOKEN',
      message: 'The refresh token is invalid, expired, revoked, or already rotated.',
    });
  }
}
