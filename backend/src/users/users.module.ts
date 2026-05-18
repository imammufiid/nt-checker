import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './user.entity';
import { UserProfile } from './user-profile.entity';
import { Scan } from '../scans/scan.entity';
import { UsersService } from './users.service';
import { ProfileService } from './profile.service';
import { UsersController } from './users.controller';
import { ProfileController } from './profile.controller';
import { LegacyBackfillService } from './legacy-backfill.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, UserProfile, Scan])],
  controllers: [UsersController, ProfileController],
  providers: [UsersService, ProfileService, LegacyBackfillService],
  exports: [UsersService, ProfileService],
})
export class UsersModule {}
