import { Module } from '@nestjs/common';
import { ConsumerWorkerController } from './consumer-worker.controller';
import { ConsumerWorkerService } from './consumer-worker.service';
import { TimescaleDbService } from './timescaledb.service';

@Module({
  controllers: [ConsumerWorkerController],
  providers: [ConsumerWorkerService, TimescaleDbService],
})
export class ConsumerWorkerModule {}
