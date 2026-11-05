import { Module } from '@nestjs/common';
import { QueryServiceController } from './query-service.controller';
import { QueryServiceService } from './query-service.service';

@Module({
  controllers: [QueryServiceController],
  providers: [QueryServiceService],
})
export class QueryServiceModule {}

