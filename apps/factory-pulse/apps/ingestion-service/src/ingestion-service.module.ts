import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import {
  DEFAULT_RABBITMQ_URL,
  RABBITMQ_CLIENT,
  SENSOR_PULSE_QUEUE,
} from '@app/common';
import { IngestionServiceController } from './ingestion-service.controller';
import { IngestionServiceService } from './ingestion-service.service';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: RABBITMQ_CLIENT,
        transport: Transport.RMQ,
        options: {
          urls: [process.env.RABBITMQ_URL ?? DEFAULT_RABBITMQ_URL],
          queue: SENSOR_PULSE_QUEUE,
          queueOptions: {
            durable: true,
          },
        },
      },
    ]),
  ],
  controllers: [IngestionServiceController],
  providers: [IngestionServiceService],
})
export class IngestionServiceModule {}

