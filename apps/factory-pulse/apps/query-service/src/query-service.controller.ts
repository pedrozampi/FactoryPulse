import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { QueryReadingsFilter, QueryReadingsResponse } from '@app/common';
import { QueryServiceService } from './query-service.service';

@Controller()
export class QueryServiceController {
  constructor(private readonly queryService: QueryServiceService) {}

  @Get('health')
  health() {
    return { status: 'ok', service: 'query-service' };
  }

  @Post(['readings', 'query'])
  @HttpCode(HttpStatus.OK)
  async getReadings(
    @Body() filter: QueryReadingsFilter = {},
  ): Promise<QueryReadingsResponse> {
    return this.queryService.queryReadings(filter);
  }
}
