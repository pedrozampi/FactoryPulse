import { Test, TestingModule } from '@nestjs/testing';
import { RABBITMQ_CLIENT, SENSOR_PULSE_PATTERN, SensorPayload } from '@app/common';
import { IngestionServiceController } from './ingestion-service.controller';
import { IngestionServiceService } from './ingestion-service.service';

describe('IngestionServiceController', () => {
  let controller: IngestionServiceController;
  const mockRabbitClient = {
    emit: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const app: TestingModule = await Test.createTestingModule({
      controllers: [IngestionServiceController],
      providers: [
        IngestionServiceService,
        {
          provide: RABBITMQ_CLIENT,
          useValue: mockRabbitClient,
        },
      ],
    }).compile();

    controller = app.get<IngestionServiceController>(IngestionServiceController);
  });

  it('deve validar e publicar o payload do sensor com timestamptz no RabbitMQ', () => {
    const samplePayload: SensorPayload = {
      '1': [{ time: '2026-11-05T14:10:00.000Z', stack: 1 }],
      '0': [{ time: '2026-11-05T14:10:00.000Z', stack: 0 }],
      '3': [{ time: '2026-11-05T14:10:00.000Z', stack: 0 }],
      '2': [{ time: '2026-11-05T14:10:00.000Z', stack: 0 }],
    };

    const result = controller.ingest(samplePayload);

    expect(result.status).toBe('queued');
    expect(result.channelsCount).toBe(4);
    expect(mockRabbitClient.emit).toHaveBeenCalledTimes(1);
    expect(mockRabbitClient.emit).toHaveBeenCalledWith(
      SENSOR_PULSE_PATTERN,
      expect.objectContaining({
        payload: samplePayload,
      }),
    );
  });
});
