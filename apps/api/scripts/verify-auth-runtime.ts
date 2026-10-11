import 'dotenv/config';
import { AccessTokenService } from '../src/modules/auth/access-token.service.js';
import { PasswordService } from '../src/modules/auth/password.service.js';
import { RefreshTokenService } from '../src/modules/auth/refresh-token.service.js';

async function main(): Promise<void> {
  const passwords = new PasswordService();
  const refreshTokens = new RefreshTokenService();
  const accessTokens = new AccessTokenService();

  const passwordHash = await passwords.hash('TradeNest-runtime-check-1!');
  if (!(await passwords.compare('TradeNest-runtime-check-1!', passwordHash))) {
    throw new Error('bcrypt runtime verification failed.');
  }
  if (await passwords.compare('wrong-password', passwordHash)) {
    throw new Error('bcrypt accepted an incorrect password.');
  }

  const firstRefresh = refreshTokens.create();
  if (!refreshTokens.matches(firstRefresh.token, firstRefresh.hash)) {
    throw new Error('Refresh-token hash verification failed.');
  }
  const rotatedRefresh = refreshTokens.rotate(firstRefresh.sessionId);
  if (refreshTokens.matches(firstRefresh.token, rotatedRefresh.hash)) {
    throw new Error('Refresh-token rotation produced an equivalent token hash.');
  }

  const jwt = await accessTokens.sign({
    userId: '00000000-0000-4000-8000-000000000001',
    sessionId: '00000000-0000-4000-8000-000000000002',
    role: 'BUYER',
  });
  const claims = await accessTokens.verify(jwt);
  if (claims.userId !== '00000000-0000-4000-8000-000000000001' || claims.role !== 'BUYER') {
    throw new Error('JWT runtime verification failed.');
  }

  console.log('AUTH RUNTIME CRYPTO VERIFICATION PASSED');
}

void main();
