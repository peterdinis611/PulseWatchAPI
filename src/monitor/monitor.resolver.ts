import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { GqlAuthGuard } from '../auth/guards/gql-auth.guard';
import { UuidArgs } from '../common/uuid-args';
import type { PublicUser } from '../user/public-user';
import { CreateMonitorInput } from './dto/create-monitor.input';
import { UpdateMonitorInput } from './dto/update-monitor.input';
import { Monitor } from './monitor.model';
import { MonitorService, MonitorView } from './monitor.service';

@Resolver(() => Monitor)
export class MonitorResolver {
  constructor(private readonly monitorService: MonitorService) {}

  @Query(() => [Monitor], {
    description: 'Monitors owned by the signed-in user',
  })
  @UseGuards(GqlAuthGuard)
  monitors(@CurrentUser() user: PublicUser): Promise<MonitorView[]> {
    return this.monitorService.listForUser(user.id);
  }

  @Query(() => Monitor, {
    description: 'A single monitor owned by the signed-in user',
  })
  @UseGuards(GqlAuthGuard)
  monitor(
    @CurrentUser() user: PublicUser,
    @UuidArgs() id: string,
  ): Promise<MonitorView> {
    return this.monitorService.findForUser(user.id, id);
  }

  @Mutation(() => Monitor, { description: 'Create a monitor' })
  @UseGuards(GqlAuthGuard)
  createMonitor(
    @CurrentUser() user: PublicUser,
    @Args('input') input: CreateMonitorInput,
  ): Promise<MonitorView> {
    return this.monitorService.createForUser(user.id, input);
  }

  @Mutation(() => Monitor, { description: 'Update a monitor' })
  @UseGuards(GqlAuthGuard)
  updateMonitor(
    @CurrentUser() user: PublicUser,
    @UuidArgs() id: string,
    @Args('input') input: UpdateMonitorInput,
  ): Promise<MonitorView> {
    return this.monitorService.updateForUser(user.id, id, input);
  }

  @Mutation(() => Boolean, { description: 'Delete a monitor' })
  @UseGuards(GqlAuthGuard)
  deleteMonitor(
    @CurrentUser() user: PublicUser,
    @UuidArgs() id: string,
  ): Promise<boolean> {
    return this.monitorService.deleteForUser(user.id, id);
  }

  @Mutation(() => Monitor, {
    description: 'Run a monitor check immediately',
  })
  @UseGuards(GqlAuthGuard)
  runMonitorCheck(
    @CurrentUser() user: PublicUser,
    @UuidArgs() id: string,
  ): Promise<MonitorView> {
    return this.monitorService.checkForUser(user.id, id);
  }
}
