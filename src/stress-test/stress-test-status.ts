import { registerEnumType } from '@nestjs/graphql';

export enum StressTestStatus {
  IDLE = 'IDLE',
  RUNNING = 'RUNNING',
  PASSED = 'PASSED',
  FAILED = 'FAILED',
}

registerEnumType(StressTestStatus, {
  name: 'StressTestStatus',
  description: 'Latest k6 run result for a stress test',
});
