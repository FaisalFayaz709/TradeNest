import { SetMetadata } from '@nestjs/common';
import type { AuthRole } from '../../modules/auth/public/index.js';

export const REQUIRED_ROLES_KEY = 'tradenest.requiredRoles';
export const RequireRoles = (...roles: AuthRole[]) => SetMetadata(REQUIRED_ROLES_KEY, roles);
