import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { SensorPayload } from '@app/common';
import { IngestionServiceService } from './ingestion-service.service';

@Controller()
export class IngestionServiceController {
  constructor(
    private readonly ingestionService: IngestionServiceService,
  ) {}

  @Get('health')
  health() {
    return { status: 'ok', service: 'ingestion-service' };
  }

  @Post('ingest')
  @HttpCode(HttpStatus.ACCEPTED)
  ingest(@Body() payload: SensorPayload) {
    return this.ingestionService.ingestSensorPulse(payload);
  }
}

