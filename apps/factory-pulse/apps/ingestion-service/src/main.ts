import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { IngestionServiceModule } from './ingestion-service.module';

async function bootstrap() {
  const logger = new Logger('IngestionService');
  const app = await NestFactory.create(IngestionServiceModule);
  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  logger.log(`Ingestion Service rodando na porta ${port}`);
}
void bootstrap();

