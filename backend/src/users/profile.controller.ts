import { Body, Controller, Get, Put } from '@nestjs/common';
import { ProfileService, ProfileResponse } from './profile.service';
import { UpsertProfileDto } from './dto/upsert-profile.dto';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt.strategy';

@Controller('users/me/profile')
export class ProfileController {
  constructor(private readonly profile: ProfileService) {}

  @Get()
  get(@CurrentUser() current: AuthenticatedUser): Promise<ProfileResponse> {
    return this.profile.get(current.id);
  }

  @Put()
  put(
    @CurrentUser() current: AuthenticatedUser,
    @Body() body: UpsertProfileDto,
  ): Promise<ProfileResponse> {
    return this.profile.upsert(current.id, body);
  }
}
