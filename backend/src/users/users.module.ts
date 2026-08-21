import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './user.entity';
import { RoleRequest } from './role-request.entity';
import { UsersService } from './users.service';

@Module({
  imports:   [TypeOrmModule.forFeature([User, RoleRequest])],
  providers: [UsersService],
  exports:   [UsersService],
})
export class UsersModule {}
