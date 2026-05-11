import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Scan } from './scan.entity';

@Injectable()
export class ScansService {
  constructor(
    @InjectRepository(Scan) private readonly scans: Repository<Scan>,
  ) {}

  create(data: Partial<Scan>): Promise<Scan> {
    return this.scans.save(this.scans.create(data));
  }

  findAll(): Promise<Scan[]> {
    return this.scans.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: string): Promise<Scan> {
    const scan = await this.scans.findOne({ where: { id } });
    if (!scan) throw new NotFoundException('Scan not found');
    return scan;
  }

  async remove(id: string): Promise<void> {
    const result = await this.scans.delete(id);
    if (!result.affected) throw new NotFoundException('Scan not found');
  }
}
