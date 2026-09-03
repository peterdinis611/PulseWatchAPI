import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { GqlAuthGuard } from '../auth/guards/gql-auth.guard';
import { UuidArgs } from '../common/uuid-args';
import type { PublicUser } from '../user/public-user';
import { CreateStressTestInput } from './dto/create-stress-test.input';
import { UpdateStressTestInput } from './dto/update-stress-test.input';
import { StressTestRun } from './stress-test-run.model';
import { StressTest } from './stress-test.model';
import {
  StressTestRunView,
  StressTestService,
  StressTestView,
} from './stress-test.service';

@Resolver(() => StressTest)
export class StressTestResolver {
  constructor(private readonly stressTestService: StressTestService) {}

  @Query(() => [StressTest], {
    description: 'k6 stress tests owned by the signed-in user',
  })
  @UseGuards(GqlAuthGuard)
  stressTests(@CurrentUser() user: PublicUser): Promise<StressTestView[]> {
    return this.stressTestService.listForUser(user.id);
  }

  @Query(() => StressTest, {
    description: 'A single k6 stress test owned by the signed-in user',
  })
  @UseGuards(GqlAuthGuard)
  stressTest(
    @CurrentUser() user: PublicUser,
    @UuidArgs() id: string,
  ): Promise<StressTestView> {
    return this.stressTestService.findForUser(user.id, id);
  }

  @Query(() => [StressTestRun], {
    description: 'Past k6 runs for a stress test',
  })
  @UseGuards(GqlAuthGuard)
  stressTestRuns(
    @CurrentUser() user: PublicUser,
    @UuidArgs() id: string,
  ): Promise<StressTestRunView[]> {
    return this.stressTestService.listRunsForUser(user.id, id);
  }

  @Mutation(() => StressTest, { description: 'Create a k6 stress test' })
  @UseGuards(GqlAuthGuard)
  createStressTest(
    @CurrentUser() user: PublicUser,
    @Args('input') input: CreateStressTestInput,
  ): Promise<StressTestView> {
    return this.stressTestService.createForUser(user.id, input);
  }

  @Mutation(() => StressTest, { description: 'Update a k6 stress test' })
  @UseGuards(GqlAuthGuard)
  updateStressTest(
    @CurrentUser() user: PublicUser,
    @UuidArgs() id: string,
    @Args('input') input: UpdateStressTestInput,
  ): Promise<StressTestView> {
    return this.stressTestService.updateForUser(user.id, id, input);
  }

  @Mutation(() => Boolean, { description: 'Delete a k6 stress test' })
  @UseGuards(GqlAuthGuard)
  deleteStressTest(
    @CurrentUser() user: PublicUser,
    @UuidArgs() id: string,
  ): Promise<boolean> {
    return this.stressTestService.deleteForUser(user.id, id);
  }

  @Mutation(() => StressTest, {
    description:
      'Start a k6 run. Returns immediately with RUNNING; results land on lastStatus.',
  })
  @UseGuards(GqlAuthGuard)
  runStressTest(
    @CurrentUser() user: PublicUser,
    @UuidArgs() id: string,
  ): Promise<StressTestView> {
    return this.stressTestService.runForUser(user.id, id);
  }
}
