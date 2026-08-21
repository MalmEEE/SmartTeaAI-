import {
  Controller, Get, Post, Patch, Param, Body,
  UseGuards, ParseIntPipe, BadRequestException,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/user.entity';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  /** List all users (excluding password hashes). */
  @Get('users')
  listUsers() {
    return this.admin.listUsers();
  }

  /** Directly assign any role to a user. */
  @Patch('users/:id/role')
  setRole(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { role: UserRole },
  ) {
    const valid = Object.values(UserRole);
    if (!body?.role || !valid.includes(body.role)) {
      throw new BadRequestException(`role must be one of: ${valid.join(', ')}`);
    }
    return this.admin.setUserRole(id, body.role);
  }

  /** List pending role-upgrade requests. */
  @Get('role-requests')
  listRequests() {
    return this.admin.listPendingRequests();
  }

  /** Approve a role-upgrade request — immediately upgrades the user's role. */
  @Post('role-requests/:id/approve')
  approve(@Param('id', ParseIntPipe) id: number) {
    return this.admin.approveRequest(id);
  }

  /** Reject a role-upgrade request — user stays on their current role. */
  @Post('role-requests/:id/reject')
  reject(@Param('id', ParseIntPipe) id: number) {
    return this.admin.rejectRequest(id);
  }
}
