import { Injectable, Logger } from '@nestjs/common';
import { IngestedPulseEvent } from '@app/common';
import {
  SensorReadingRow,
  TimescaleDbService,
} from './timescaledb.service';

export interface ProcessedChannelSummary {
  channel: string;
  readingsCount: number;
  activeStackCount: number;
}

export interface ProcessedPulseSummary {
  receivedAt: string;
  processedAt: string;
  insertedRows: number;
  channels: ProcessedChannelSummary[];
}

@Injectable()
export class ConsumerWorkerService {
  private readonly logger = new Logger(ConsumerWorkerService.name);

  constructor(private readonly timescaleDb: TimescaleDbService) {}

  async processSensorPulse(
    event: IngestedPulseEvent,
  ): Promise<ProcessedPulseSummary> {
    const channelsSummary: ProcessedChannelSummary[] = [];
    const rowsToInsert: SensorReadingRow[] = [];

    for (const [channel, readings] of Object.entries(event.payload)) {
      let activeStackCount = 0;

      for (const reading of readings) {
        if (reading.stack > 0) {
          activeStackCount += 1;
        }

        rowsToInsert.push({
          time: reading.time,
          channel,
          stack: reading.stack,
          receivedAt: event.receivedAt,
        });
      }

      channelsSummary.push({
        channel,
        readingsCount: readings.length,
        activeStackCount,
      });
    }

    const insertedRows =
      await this.timescaleDb.insertReadingsBatch(rowsToInsert);

    this.logger.log(
      `Pulso persistido no TimescaleDB -> ${insertedRows} leituras salvas em ${channelsSummary.length} canais`,
    );

    return {
      receivedAt: event.receivedAt,
      processedAt: new Date().toISOString(),
      insertedRows,
      channels: channelsSummary,
    };
  }
}
