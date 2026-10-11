import { jest } from '@jest/globals';
import { z } from 'zod';
import { ApiException } from '../../src/common/http/api-exception.js';
import { ZodValidationPipe } from '../../src/common/http/zod-validation.pipe.js';
import { AccessTokenGuard } from '../../src/modules/auth/access-token.guard.js';
import { OptionalAccessTokenGuard } from '../../src/modules/auth/optional-access-token.guard.js';
import { RolesGuard } from '../../src/common/authorization/roles.guard.js';
import { REQUIRED_ROLES_KEY } from '../../src/common/authorization/roles.decorator.js';
import type { AuthService } from '../../src/modules/auth/auth.service.js';
import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';

const mockContext = (authorization?: string): ExecutionContext => ({
  switchToHttp: () => ({getRequest: () => ({header: () => authorization})}),
  getHandler: () => function test() {},
  getClass: () => class TestClass {},
} as unknown as ExecutionContext);
const service = {
  authenticateAccessToken: jest.fn().mockResolvedValue({userId:'test-user',role:'BUYER',sessionId:'test-session'}),
} as unknown as AuthService;

describe('Api contracts auth and validation boundary regressions', () => {
  beforeEach(() => jest.clearAllMocks());
  it('rejects missing or malformed bearer tokens before invoking auth service', async () => {
    const guard = new AccessTokenGuard(service);
    await expect(guard.canActivate(mockContext())).rejects.toMatchObject({status:401});
    await expect(guard.canActivate(mockContext('Basic pass'))).rejects.toMatchObject({status:401});
    expect(service.authenticateAccessToken).not.toHaveBeenCalled();
  });
  it('accepts exactly one valid bearer token and passes it to authentication', async () => {
    const guard = new AccessTokenGuard(service);
    await expect(guard.canActivate(mockContext('Bearer good-token'))).resolves.toBe(true);
    expect(service.authenticateAccessToken).toHaveBeenCalledWith('good-token');
  });
  it('permits anonymous optional auth, but never swallows an invalid explicit token', async () => {
    const guard = new OptionalAccessTokenGuard(service);
    await expect(guard.canActivate(mockContext())).resolves.toBe(true);
    await expect(guard.canActivate(mockContext('Bearer token extra'))).rejects.toMatchObject({status:401});
    expect(service.authenticateAccessToken).not.toHaveBeenCalled();
  });
  it('denies unrecognized roles and missing principal', () => {
    const reflect = {getAllAndOverride: jest.fn().mockReturnValue(['ADMIN'])} as unknown as Reflector;
    const guard = new RolesGuard(reflect);
    expect(() => guard.canActivate(mockContext())).toThrow(ApiException);
    const context = {
      getHandler: () => function handler() {}, getClass: () => class Controller {},
      switchToHttp: () => ({getRequest: () => ({auth:{role:'BUYER'}})}),
    } as unknown as ExecutionContext;
    expect(() => guard.canActivate(context)).toThrow(ApiException);
    expect(reflect.getAllAndOverride).toHaveBeenCalledWith(REQUIRED_ROLES_KEY,expect.any(Array));
  });
  it('normalizes a valid payload and rejects invalid body/query content using Zod 4', () => {
    const pipe = new ZodValidationPipe(z.object({quantity:z.number().int().positive()}));
    expect(pipe.transform({quantity:3})).toEqual({quantity:3});
    expect(() => pipe.transform({quantity:-1})).toThrow(ApiException);
    expect(() => pipe.transform({quantity:'3'})).toThrow(ApiException);
  });
});
