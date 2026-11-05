export interface SensorReading {
  /** Timestamp com fuso horário (TIMESTAMPTZ, ex: "2026-11-05T14:10:00.000Z") */
  time: string;
  stack: number;
}

/**
 * Formato enviado pelo sensor a cada 10 minutos:
 * {
 *   "1": [{ "time": "2026-11-05T14:10:00.000Z", "stack": 1 }],
 *   "0": [{ "time": "2026-11-05T14:10:00.000Z", "stack": 0 }],
 *   "3": [{ "time": "2026-11-05T14:10:00.000Z", "stack": 0 }],
 *   "2": [{ "time": "2026-11-05T14:10:00.000Z", "stack": 0 }]
 * }
 */
export type SensorPayload = Record<string, SensorReading[]>;

export interface IngestedPulseEvent {
  receivedAt: string;
  payload: SensorPayload;
}

export interface QueryReadingsFilter {
  startTime?: string;
  endTime?: string;
  channels?: string[];
  limit?: number;
}

export interface SensorChannelStats {
  readings: SensorReading[];
  total: number;
  average: number;
}

export type QueryReadingsResponse = Record<string, SensorChannelStats>;
