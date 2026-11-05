import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Pool } from 'pg';
import { DEFAULT_DATABASE_URL } from '@app/common';

export interface SensorReadingRow {
  time: string;
  channel: string;
  stack: number;
  receivedAt: string;
}

@Injectable()
export class TimescaleDbService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TimescaleDbService.name);
  private readonly pool: Pool;

  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL,
      max: 20,
    });
  }

  async onModuleInit(): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('CREATE EXTENSION IF NOT EXISTS timescaledb;');

      await client.query(`
        CREATE TABLE IF NOT EXISTS sensor_readings (
          time TIMESTAMPTZ NOT NULL,
          channel TEXT NOT NULL,
          stack INTEGER NOT NULL,
          received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          PRIMARY KEY (time, channel)
        );
      `);

      await client.query(`
        SELECT create_hypertable(
          'sensor_readings',
          by_range('time'),
          if_not_exists => TRUE
        );
      `);

      await client.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS uq_sensor_readings_time_channel
          ON sensor_readings (time, channel);
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_sensor_readings_channel_time
          ON sensor_readings (channel, time DESC);
      `);

      this.logger.log(
        'Extensão TimescaleDB e hypertable "sensor_readings" (sem duplicatas por time+channel) inicializadas com sucesso.',
      );
    } finally {
      client.release();
    }
  }

  async insertReadingsBatch(rows: SensorReadingRow[]): Promise<number> {
    if (rows.length === 0) {
      return 0;
    }

    const times = rows.map((r) => r.time);
    const channels = rows.map((r) => r.channel);
    const stacks = rows.map((r) => r.stack);
    const receivedAts = rows.map((r) => r.receivedAt);

    const query = `
      INSERT INTO sensor_readings (time, channel, stack, received_at)
      SELECT DISTINCT ON (time, channel) time, channel, stack, received_at
      FROM UNNEST(
        $1::timestamptz[],
        $2::text[],
        $3::int[],
        $4::timestamptz[]
      ) AS t(time, channel, stack, received_at)
      ON CONFLICT (time, channel) DO NOTHING;
    `;

    const result = await this.pool.query(query, [
      times,
      channels,
      stacks,
      receivedAts,
    ]);

    return result.rowCount ?? 0;
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
