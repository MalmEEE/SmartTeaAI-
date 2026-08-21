import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { AuthModule } from '../auth/auth.module';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';

@Module({
  imports:     [UsersModule, AuthModule],
  providers:   [AdminService],
  controllers: [AdminController],
})
export class AdminModule {}
