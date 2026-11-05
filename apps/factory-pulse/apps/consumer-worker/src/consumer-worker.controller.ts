import { Controller, Logger } from '@nestjs/common';
import { Ctx, EventPattern, Payload, RmqContext } from '@nestjs/microservices';
import { IngestedPulseEvent, SENSOR_PULSE_PATTERN } from '@app/common';
import { ConsumerWorkerService } from './consumer-worker.service';

@Controller()
export class ConsumerWorkerController {
  private readonly logger = new Logger(ConsumerWorkerController.name);

  constructor(private readonly consumerService: ConsumerWorkerService) {}

  @EventPattern(SENSOR_PULSE_PATTERN)
  async handleSensorPulse(
    @Payload() event: IngestedPulseEvent,
    @Ctx() context: RmqContext,
  ) {
    const channel = context.getChannelRef() as {
      ack: (msg: unknown) => void;
    };
    const originalMsg = context.getMessage();

    try {
      const summary = await this.consumerService.processSensorPulse(event);
      channel.ack(originalMsg);
      return summary;
    } catch (error) {
      this.logger.error(
        'Erro ao persistir pulso do sensor no TimescaleDB',
        error,
      );
      throw error;
    }
  }
}
