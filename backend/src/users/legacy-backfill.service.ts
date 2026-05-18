import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { User } from './user.entity';
import { Scan } from '../scans/scan.entity';

const LEGACY_EMAIL = 'legacy@nt-checker.local';

/**
 * BE-001 one-shot data migration. When `RUN_LEGACY_BACKFILL=1`, on application
 * bootstrap:
 *   1) Idempotently ensure a "legacy" user exists with a random password hash.
 *      Its email cannot collide with a real signup (the .local TLD is reserved).
 *   2) Update every `scans` row whose `userId IS NULL` to point at that user.
 *
 * The flag exists so dev/test boots don't seed unwanted rows. The operation is
 * idempotent: re-running is safe and a no-op if there are no orphans.
 */
@Injectable()
export class LegacyBackfillService implements OnApplicationBootstrap {
  private readonly logger = new Logger(LegacyBackfillService.name);

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Scan) private readonly scans: Repository<Scan>,
    private readonly config: ConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const flag = this.config.get<string>('RUN_LEGACY_BACKFILL') ?? '0';
    if (flag !== '1') return;

    const legacy = await this.ensureLegacyUser();
    const result = await this.scans
      .createQueryBuilder()
      .update(Scan)
      .set({ userId: legacy.id })
      .where({ userId: IsNull() })
      .execute();

    const assigned = result.affected ?? 0;
    this.logger.log(`[backfill] ${assigned} scans assigned to legacy user`);
  }

  private async ensureLegacyUser(): Promise<User> {
    const existing = await this.users.findOne({
      where: { email: LEGACY_EMAIL },
    });
    if (existing) return existing;

    // Long random password; bcrypt-hashed. Nobody is intended to log in as this
    // user — the hash exists only to satisfy the NOT-NULL constraint.
    const random = randomBytes(48).toString('hex');
    const passwordHash = await bcrypt.hash(random, 10);
    return this.users.save(
      this.users.create({
        email: LEGACY_EMAIL,
        passwordHash,
        name: 'Legacy User',
        subscriptionTier: 'free',
      }),
    );
  }
}
