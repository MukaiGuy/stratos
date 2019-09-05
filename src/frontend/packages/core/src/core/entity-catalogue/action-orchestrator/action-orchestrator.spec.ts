import { PaginatedAction } from '../../../../../store/src/types/pagination.types';
import { EntityActionDispatcherManager } from '../action-dispatcher/action-dispatcher';
import { ActionOrchestrator, OrchestratedActionBuilders } from './action-orchestrator';
import { getPaginationAction, getRequestAction, hasActions } from './action-orchestrator.spec.helpers';
import { EntityRequestAction } from '../../../../../store/src/types/request.types';

describe('ActionOrchestrator', () => {
  it('should not have action builders', () => {
    const actionOrchestrator = new ActionOrchestrator('Empty');
    hasActions(actionOrchestrator);
  });

  it('should have base action builders', () => {
    const actionBuilders: OrchestratedActionBuilders = {
      get: guid => getRequestAction(),
      remove: guid => getRequestAction(),
      update: guid => getRequestAction(),
      create: () => getRequestAction(),
      getAll: () => getPaginationAction()
    };
    const actionOrchestrator = new ActionOrchestrator('Base', actionBuilders);
    hasActions(actionOrchestrator, ['get', 'remove', 'update', 'create', 'getAll']);
  });

  it('should have custom actions builders', () => {
    interface Test1OrchestratedActionBuilders extends OrchestratedActionBuilders {
      customAction202: (guid: string) => EntityRequestAction;
      customAction101: (guid: string) => PaginatedAction;
    }
    const actionBuilders: Test1OrchestratedActionBuilders = {
      customAction101: () => getPaginationAction(),
      customAction202: guid => getRequestAction()
    };
    const actionOrchestrator = new ActionOrchestrator('Custom', actionBuilders);
    hasActions(actionOrchestrator, ['customAction101', 'customAction202']);
  });

  it('should have custom and base actions builders', () => {
    const actionBuilders: OrchestratedActionBuilders = {
      get: guid => getRequestAction(),
      remove: guid => getRequestAction(),
      update: guid => getRequestAction(),
      create: () => getRequestAction(),
      getAll: () => getPaginationAction(),
      customAction101: () => getPaginationAction(),
      customAction202: guid => getRequestAction()
    };
    const actionOrchestrator = new ActionOrchestrator('BasePlusCustom', actionBuilders);
    hasActions(actionOrchestrator, ['get', 'remove', 'update', 'create', 'getAll', 'customAction101', 'customAction202']);
  });

  it('should get entity action dispatcher', () => {
    const actionBuilders: OrchestratedActionBuilders = {
      get: guid => getRequestAction(),
      remove: guid => getRequestAction(),
      update: guid => getRequestAction(),
      create: () => getRequestAction(),
      getAll: () => getPaginationAction(),
      customAction101: () => getPaginationAction(),
      customAction202: guid => getRequestAction()
    };
    const actionOrchestrator = new ActionOrchestrator('BasePlusCustom', actionBuilders);
    const dispatcher = actionOrchestrator.getEntityActionDispatcher(() => { });
    expect(dispatcher instanceof EntityActionDispatcherManager).toBe(true);
  });
});