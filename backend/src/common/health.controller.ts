import { Controller, Get } from '@nestjs/common';
import { Public } from './decorators/public.decorator';

@Public()
@Controller('health')
export class HealthController {
  @Get()
  status() {
    return {
      status: 'ok',
      version: '0.1.0',
      timestamp: new Date().toISOString(),
    };
  }
}
