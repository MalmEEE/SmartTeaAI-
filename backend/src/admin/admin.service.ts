import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { UserRole } from '../users/user.entity';
import { RequestStatus } from '../users/role-request.entity';

@Injectable()
export class AdminService {
  constructor(private readonly users: UsersService) {}

  listUsers() {
    return this.users.findAll();
  }

  async setUserRole(userId: number, role: UserRole) {
    const user = await this.users.findById(userId);
    if (!user) throw new NotFoundException(`User ${userId} not found`);
    return this.users.updateRole(userId, role);
  }

  listPendingRequests() {
    return this.users.findPendingRequests();
  }

  async approveRequest(id: number) {
    const req = await this.users.findRoleRequestById(id);
    if (!req) throw new NotFoundException(`Role request ${id} not found`);
    if (req.status !== RequestStatus.PENDING) {
      throw new BadRequestException(`Request ${id} is already ${req.status}`);
    }
    await this.users.updateRole(req.user_id, req.requested_role);
    return this.users.updateRequestStatus(id, RequestStatus.APPROVED);
  }

  async rejectRequest(id: number) {
    const req = await this.users.findRoleRequestById(id);
    if (!req) throw new NotFoundException(`Role request ${id} not found`);
    if (req.status !== RequestStatus.PENDING) {
      throw new BadRequestException(`Request ${id} is already ${req.status}`);
    }
    return this.users.updateRequestStatus(id, RequestStatus.REJECTED);
  }
}
