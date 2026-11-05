import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  IngestedPulseEvent,
  RABBITMQ_CLIENT,
  SENSOR_PULSE_PATTERN,
  SensorPayload,
} from '@app/common';

@Injectable()
export class IngestionServiceService {
  private readonly logger = new Logger(IngestionServiceService.name);

  constructor(
    @Inject(RABBITMQ_CLIENT) private readonly rabbitClient: ClientProxy,
  ) {}

  ingestSensorPulse(payload: SensorPayload) {
    this.validatePayload(payload);

    const event: IngestedPulseEvent = {
      receivedAt: new Date().toISOString(),
      payload,
    };

    this.rabbitClient.emit<void, IngestedPulseEvent>(
      SENSOR_PULSE_PATTERN,
      event,
    );

    const channels = Object.keys(payload);
    this.logger.log(
      `Pulso do sensor enfileirado com sucesso (${channels.length} canais: [${channels.join(', ')}])`,
    );

    return {
      status: 'queued',
      receivedAt: event.receivedAt,
      channelsCount: channels.length,
    };
  }

  private validatePayload(payload: unknown): asserts payload is SensorPayload {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new BadRequestException(
        'O payload deve ser um objeto JSON mapeando canais para leituras.',
      );
    }

    const entries = Object.entries(payload as Record<string, unknown>);
    if (entries.length === 0) {
      throw new BadRequestException('O payload do sensor não pode estar vazio.');
    }

    for (const [channel, readings] of entries) {
      if (!Array.isArray(readings)) {
        throw new BadRequestException(
          `O canal "${channel}" deve conter um array de leituras.`,
        );
      }

      for (const reading of readings) {
        const candidate = reading as { time?: unknown; stack?: unknown };
        const isValidTime =
          typeof candidate?.time === 'string' &&
          candidate.time.trim().length > 0 &&
          !Number.isNaN(Date.parse(candidate.time));

        if (
          !reading ||
          typeof reading !== 'object' ||
          !isValidTime ||
          typeof candidate.stack !== 'number'
        ) {
          throw new BadRequestException(
            `Leitura inválida no canal "${channel}". Esperado: { "time": string (timestamptz), "stack": number }.`,
          );
        }
      }
    }
  }
}
