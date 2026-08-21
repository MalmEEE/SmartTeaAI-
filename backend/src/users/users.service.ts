import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from './user.entity';
import { RoleRequest, RequestStatus } from './role-request.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(RoleRequest)
    private readonly roleRequestRepo: Repository<RoleRequest>,
  ) {}

  findByEmail(email: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { email } });
  }

  findById(id: number): Promise<User | null> {
    return this.userRepo.findOne({ where: { id } });
  }

  findAll(): Promise<User[]> {
    // Select all fields except password_hash
    return this.userRepo.find({
      select: { id: true, name: true, email: true, role: true, is_active: true, created_at: true },
      order: { created_at: 'DESC' },
    });
  }

  create(data: Partial<User>): Promise<User> {
    return this.userRepo.save(this.userRepo.create(data));
  }

  async updateRole(userId: number, role: UserRole): Promise<User> {
    await this.userRepo.update(userId, { role });
    return (await this.userRepo.findOne({ where: { id: userId } }))!;
  }

  findPendingRequests(): Promise<RoleRequest[]> {
    return this.roleRequestRepo.find({
      where:     { status: RequestStatus.PENDING },
      relations: { user: true },
      order:     { created_at: 'ASC' },
    });
  }

  findRoleRequestById(id: number): Promise<RoleRequest | null> {
    return this.roleRequestRepo.findOne({ where: { id }, relations: { user: true } });
  }

  createRoleRequest(user_id: number, requested_role: UserRole): Promise<RoleRequest> {
    return this.roleRequestRepo.save(
      this.roleRequestRepo.create({ user_id, requested_role, status: RequestStatus.PENDING }),
    );
  }

  async updateRequestStatus(id: number, status: RequestStatus): Promise<RoleRequest> {
    await this.roleRequestRepo.update(id, { status });
    return (await this.roleRequestRepo.findOne({ where: { id }, relations: { user: true } }))!;
  }
}
