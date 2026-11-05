import { Test, TestingModule } from '@nestjs/testing';
import { RmqContext } from '@nestjs/microservices';
import { IngestedPulseEvent } from '@app/common';
import { ConsumerWorkerController } from './consumer-worker.controller';
import { ConsumerWorkerService } from './consumer-worker.service';
import { TimescaleDbService } from './timescaledb.service';

describe('ConsumerWorkerController', () => {
  let controller: ConsumerWorkerController;
  const mockTimescaleDbService = {
    insertReadingsBatch: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const app: TestingModule = await Test.createTestingModule({
      controllers: [ConsumerWorkerController],
      providers: [
        ConsumerWorkerService,
        {
          provide: TimescaleDbService,
          useValue: mockTimescaleDbService,
        },
      ],
    }).compile();

    controller = app.get<ConsumerWorkerController>(ConsumerWorkerController);
  });

  it('deve persistir as leituras em lote no TimescaleDB e confirmar (ack) a mensagem no RabbitMQ', async () => {
    mockTimescaleDbService.insertReadingsBatch.mockResolvedValue(4);

    const ackMock = jest.fn();
    const mockRmqContext = {
      getChannelRef: () => ({ ack: ackMock }),
      getMessage: () => ({ content: Buffer.from('{}') }),
    } as unknown as RmqContext;

    const sampleEvent: IngestedPulseEvent = {
      receivedAt: '2026-11-05T14:10:00.000Z',
      payload: {
        '1': [{ time: '2026-11-05T14:10:00.000Z', stack: 1 }],
        '0': [{ time: '2026-11-05T14:10:00.000Z', stack: 0 }],
        '3': [{ time: '2026-11-05T14:10:00.000Z', stack: 0 }],
        '2': [{ time: '2026-11-05T14:10:00.000Z', stack: 0 }],
      },
    };

    const summary = await controller.handleSensorPulse(
      sampleEvent,
      mockRmqContext,
    );

    expect(mockTimescaleDbService.insertReadingsBatch).toHaveBeenCalledTimes(1);
    expect(mockTimescaleDbService.insertReadingsBatch).toHaveBeenCalledWith([
      {
        time: '2026-11-05T14:10:00.000Z',
        channel: '0',
        stack: 0,
        receivedAt: '2026-11-05T14:10:00.000Z',
      },
      {
        time: '2026-11-05T14:10:00.000Z',
        channel: '1',
        stack: 1,
        receivedAt: '2026-11-05T14:10:00.000Z',
      },
      {
        time: '2026-11-05T14:10:00.000Z',
        channel: '2',
        stack: 0,
        receivedAt: '2026-11-05T14:10:00.000Z',
      },
      {
        time: '2026-11-05T14:10:00.000Z',
        channel: '3',
        stack: 0,
        receivedAt: '2026-11-05T14:10:00.000Z',
      },
    ]);
    expect(ackMock).toHaveBeenCalledTimes(1);
    expect(summary.insertedRows).toBe(4);
    expect(summary.channels).toHaveLength(4);
  });
});
