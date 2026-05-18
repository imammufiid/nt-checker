import { Body, Controller, Get, Patch } from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import { User } from './user.entity';

interface UserResponse {
  id: string;
  email: string;
  name: string | null;
  subscription_tier: string;
  created_at: Date;
}

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  async me(@CurrentUser() current: AuthenticatedUser): Promise<UserResponse> {
    const u = await this.users.findById(current.id);
    return this.toResponse(u);
  }

  @Patch('me')
  async updateMe(
    @CurrentUser() current: AuthenticatedUser,
    @Body() body: UpdateUserDto,
  ): Promise<UserResponse> {
    const u = await this.users.updateName(current.id, body.name);
    return this.toResponse(u);
  }

  private toResponse(u: User): UserResponse {
    return {
      id: u.id,
      email: u.email,
      name: u.name,
      subscription_tier: u.subscriptionTier,
      created_at: u.createdAt,
    };
  }
}
