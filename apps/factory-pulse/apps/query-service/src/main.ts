import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { QueryServiceModule } from './query-service.module';

async function bootstrap() {
  const logger = new Logger('QueryService');
  const app = await NestFactory.create(QueryServiceModule);
  app.enableCors();
  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  logger.log(`Query Service rodando na porta ${port}`);
}
void bootstrap();

