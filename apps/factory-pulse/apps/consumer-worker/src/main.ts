import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { DEFAULT_RABBITMQ_URL, SENSOR_PULSE_QUEUE } from '@app/common';
import { ConsumerWorkerModule } from './consumer-worker.module';

async function bootstrap() {
  const logger = new Logger('ConsumerWorker');
  const rabbitmqUrl = process.env.RABBITMQ_URL ?? DEFAULT_RABBITMQ_URL;

  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    ConsumerWorkerModule,
    {
      transport: Transport.RMQ,
      options: {
        urls: [rabbitmqUrl],
        queue: SENSOR_PULSE_QUEUE,
        noAck: false,
        prefetchCount: 1,
        queueOptions: {
          durable: true,
        },
      },
    },
  );

  await app.listen();
  logger.log(
    `Consumer Worker escutando fila "${SENSOR_PULSE_QUEUE}" no RabbitMQ`,
  );
}
void bootstrap();

