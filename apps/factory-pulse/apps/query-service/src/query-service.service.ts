import {
  BadRequestException,
  Injectable,
  OnModuleDestroy,
} from '@nestjs/common';
import { Pool } from 'pg';
import {
  DEFAULT_DATABASE_URL,
  QueryReadingsFilter,
  QueryReadingsResponse,
} from '@app/common';

interface DbSensorRow {
  time: Date | string;
  channel: string;
  stack: number;
}

@Injectable()
export class QueryServiceService implements OnModuleDestroy {
  private readonly pool: Pool;

  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL,
      max: 20,
    });
  }

  async queryReadings(
    filter: QueryReadingsFilter = {},
  ): Promise<QueryReadingsResponse> {
    const startTime = this.parseOptionalTimestamp(
      filter?.startTime,
      'startTime',
    );
    const endTime = this.parseOptionalTimestamp(filter?.endTime, 'endTime');
    const channels = this.parseOptionalChannels(filter?.channels);
    const limit = this.parseOptionalLimit(filter?.limit);

    const sql = `
      SELECT time, channel, stack
      FROM sensor_readings
      WHERE ($1::timestamptz IS NULL OR time >= $1::timestamptz)
        AND ($2::timestamptz IS NULL OR time <= $2::timestamptz)
        AND ($3::text[] IS NULL OR channel = ANY($3::text[]))
      ORDER BY time ASC, channel ASC
      LIMIT $4;
    `;

    const result = await this.pool.query<DbSensorRow>(sql, [
      startTime,
      endTime,
      channels,
      limit,
    ]);

    const grouped: QueryReadingsResponse = {};

    for (const row of result.rows) {
      if (!grouped[row.channel]) {
        grouped[row.channel] = {
          readings: [],
          total: 0,
          average: 0,
        };
      }

      const stackValue = Number(row.stack);
      const channelData = grouped[row.channel];

      channelData.readings.push({
        time:
          row.time instanceof Date
            ? row.time.toISOString()
            : new Date(row.time).toISOString(),
        stack: stackValue,
      });

      channelData.total += stackValue;
    }

    for (const channelData of Object.values(grouped)) {
      const count = channelData.readings.length;
      channelData.average =
        count > 0 ? Number((channelData.total / count).toFixed(4)) : 0;
    }

    return grouped;
  }

  private parseOptionalTimestamp(
    value: unknown,
    fieldName: string,
  ): string | null {
    if (value === undefined || value === null || value === '') {
      return null;
    }
    if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
      throw new BadRequestException(
        `O campo "${fieldName}" deve ser um timestamptz válido (ex: "2026-11-05T14:10:00.000Z").`,
      );
    }
    return value;
  }

  private parseOptionalChannels(value: unknown): string[] | null {
    if (value === undefined || value === null) {
      return null;
    }
    if (
      !Array.isArray(value) ||
      value.some((ch) => typeof ch !== 'string' || ch.trim().length === 0)
    ) {
      throw new BadRequestException(
        'O campo "channels" deve ser um array de strings (ex: ["0", "1"]).',
      );
    }
    return value.length > 0 ? value : null;
  }

  private parseOptionalLimit(value: unknown): number | null {
    if (value === undefined || value === null) {
      return null;
    }
    if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
      throw new BadRequestException(
        'O campo "limit" deve ser um número inteiro positivo.',
      );
    }
    return value;
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
