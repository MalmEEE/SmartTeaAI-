import {
  Controller, Post, Get, Body, UseGuards, Request, BadRequestException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { UserRole } from '../users/user.entity';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** Self-registration — assigns Farmer role immediately, returns JWT. */
  @Post('register')
  register(@Body() body: { name: string; email: string; password: string }) {
    const { name, email, password } = body ?? {};
    if (!name || !email || !password) {
      throw new BadRequestException('name, email, and password are required');
    }
    return this.auth.register(name, email, password);
  }

  /** Login — returns JWT + user info. */
  @Post('login')
  login(@Body() body: { email: string; password: string }) {
    const { email, password } = body ?? {};
    if (!email || !password) {
      throw new BadRequestException('email and password are required');
    }
    return this.auth.login(email, password);
  }

  /** Returns the logged-in user's info decoded from the JWT. */
  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Request() req: any) {
    return req.user;
  }

  /**
   * Logged-in user requests a role upgrade.
   * Creates a pending role_requests row; admin must approve before the role changes.
   */
  @UseGuards(JwtAuthGuard)
  @Post('request-role')
  requestRole(
    @Request() req: any,
    @Body() body: { role: string },
  ) {
    const requestable: UserRole[] = [
      UserRole.BROKER, UserRole.EXPORTER, UserRole.BUYER, UserRole.ANALYST,
    ];
    if (!body?.role || !requestable.includes(body.role as UserRole)) {
      throw new BadRequestException(
        `role must be one of: ${requestable.join(', ')}`,
      );
    }
    return this.auth.requestRole(req.user.id, body.role as UserRole);
  }
}
