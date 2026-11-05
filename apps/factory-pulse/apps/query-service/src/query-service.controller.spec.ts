import { Test, TestingModule } from '@nestjs/testing';
import { QueryReadingsResponse } from '@app/common';
import { QueryServiceController } from './query-service.controller';
import { QueryServiceService } from './query-service.service';

describe('QueryServiceController', () => {
  let controller: QueryServiceController;
  let service: QueryServiceService;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [QueryServiceController],
      providers: [
        {
          provide: QueryServiceService,
          useValue: {
            queryReadings: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = app.get<QueryServiceController>(QueryServiceController);
    service = app.get<QueryServiceService>(QueryServiceService);
  });

  it('deve retornar as leituras, o total e a média agrupados por sensor via POST', async () => {
    const expectedPayload: QueryReadingsResponse = {
      '0': {
        readings: [{ time: '2026-11-05T14:10:00.000Z', stack: 0 }],
        total: 0,
        average: 0,
      },
      '1': {
        readings: [
          { time: '2026-11-05T14:10:00.000Z', stack: 1 },
          { time: '2026-11-05T14:20:00.000Z', stack: 3 },
        ],
        total: 4,
        average: 2,
      },
    };

    jest.spyOn(service, 'queryReadings').mockResolvedValue(expectedPayload);

    const filter = {
      startTime: '2026-11-05T14:00:00.000Z',
      endTime: '2026-11-05T15:00:00.000Z',
      channels: ['0', '1'],
      limit: 100,
    };

    const result = await controller.getReadings(filter);

    expect(service.queryReadings).toHaveBeenCalledWith(filter);
    expect(result).toEqual(expectedPayload);
  });
});
