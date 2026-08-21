import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../users/user.entity';

export const ROLES_KEY = 'roles';

/** Attach allowed roles to a route handler or controller class. */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
