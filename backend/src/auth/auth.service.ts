import {
  Injectable, ConflictException, UnauthorizedException, BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { UserRole } from '../users/user.entity';

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
  ) {}

  async register(name: string, email: string, password: string) {
    const existing = await this.users.findByEmail(email);
    if (existing) throw new ConflictException('Email is already registered');

    const hash = await bcrypt.hash(password, 10);
    const user = await this.users.create({
      name,
      email: email.toLowerCase().trim(),
      password_hash: hash,
      role: UserRole.FARMER,
    });

    const token = this.issueToken(user.id, user.email, user.role);
    return {
      access_token: token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    };
  }

  async login(email: string, password: string) {
    const user = await this.users.findByEmail(email.toLowerCase().trim());
    if (!user || !user.is_active) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    const token = this.issueToken(user.id, user.email, user.role);
    return {
      access_token: token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    };
  }

  async requestRole(userId: number, targetRole: UserRole) {
    // Prevent farmers from requesting farmer or admin directly
    const forbidden = [UserRole.FARMER, UserRole.ADMIN];
    if (forbidden.includes(targetRole)) {
      throw new BadRequestException(
        `Cannot request role '${targetRole}'. Requestable roles: broker, exporter, buyer, analyst`,
      );
    }
    return this.users.createRoleRequest(userId, targetRole);
  }

  private issueToken(userId: number, email: string, role: string): string {
    return this.jwt.sign({ sub: userId, email, role });
  }
}
