import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Scan } from './scan.entity';
import { ScansService } from './scans.service';
import { ScansController } from './scans.controller';
import { AnalysisModule } from '../analysis/analysis.module';

@Module({
  imports: [TypeOrmModule.forFeature([Scan]), AnalysisModule],
  controllers: [ScansController],
  providers: [ScansService],
})
export class ScansModule {}
