import {
  IEntityMetadata,
  IStratosEntityDefinition,
  EntityCatalogueSchemas,
  IStratosEndpointDefinition,
  IStratosEntityBuilder,
  IStratosEndpointWithoutSchemaDefinition,
  IStratosBaseEntityDefinition
} from './entity-catalogue.types';
import { Store } from '@ngrx/store';
import { AppState } from '../../../../store/src/app-state';
import { EntityCatalogueHelpers } from './entity-catalogue.helper';
import { IEndpointFavMetadata } from '../../../../store/src/types/user-favorites.types';
import { EndpointModel } from '../../../../store/src/types/endpoint.types';
import { getFullEndpointApiUrl } from '../../features/endpoints/endpoint-helpers';
import { endpointEntitySchema } from '../../base-entity-schemas';
import { EntitySchema } from '../../../../store/src/helpers/entity-schema';
import { EntityMonitor } from '../../shared/monitors/entity-monitor';
import { OrchestratedActionBuilders, ActionOrchestrator } from './action-orchestrator/action-orchestrator';

export interface EntityCatalogueBuilders<T extends IEntityMetadata = IEntityMetadata, Y = any> {
  entityBuilder?: IStratosEntityBuilder<T, Y>;
  actionBuilders?: OrchestratedActionBuilders;
}
type DefinitionTypes = IStratosEntityDefinition<EntityCatalogueSchemas> |
  IStratosEndpointDefinition |
  IStratosBaseEntityDefinition<EntityCatalogueSchemas>;
export class StratosBaseCatalogueEntity<T extends IEntityMetadata = IEntityMetadata, Y = any> {
  public readonly entityKey: string;
  public readonly type: string;
  public readonly definition: DefinitionTypes;
  public readonly isEndpoint: boolean;
  public readonly actionOrchestrator: ActionOrchestrator;
  constructor(
    definition: IStratosEntityDefinition | IStratosEndpointDefinition | IStratosBaseEntityDefinition,
    public readonly builders: EntityCatalogueBuilders<T, Y> = {}
  ) {
    this.definition = this.populateEntity(definition);
    this.type = this.definition.type || this.definition.schema.default.entityType;
    const baseEntity = definition as IStratosEntityDefinition;
    this.isEndpoint = !baseEntity.endpoint;
    this.entityKey = this.isEndpoint ?
      EntityCatalogueHelpers.buildEntityKey(EntityCatalogueHelpers.endpointType, baseEntity.type) :
      EntityCatalogueHelpers.buildEntityKey(baseEntity.type, baseEntity.endpoint.type);
    this.actionOrchestrator = new ActionOrchestrator(this.entityKey, this.builders.actionBuilders);
  }

  private populateEntity(entity: IStratosEntityDefinition | IStratosEndpointDefinition | IStratosBaseEntityDefinition)
    : DefinitionTypes {
    const schema = entity.schema instanceof EntitySchema ? {
      default: entity.schema
    } : entity.schema;

    return {
      ...entity,
      type: entity.type || schema.default.entityType,
      label: entity.label || 'Unknown',
      labelPlural: entity.labelPlural || entity.label || 'Unknown',
      schema
    };
  }
  /**
   * Gets the schema associated with the entity type.
   * If no schemaKey is provided then the default schema will be returned
   */
  public getSchema(schemaKey?: string) {
    // TODO(NJ) We should do a better job at typeing schemax
    // schema always gets changed to a EntityCatalogueSchamas.
    const catalogueSchema = (this.definition.schema as EntityCatalogueSchemas);
    if (!schemaKey || this.isEndpoint) {
      return catalogueSchema.default;
    }
    const entityCatalogue = this.definition as IStratosEntityDefinition;
    const tempId = EntityCatalogueHelpers.buildEntityKey(entityCatalogue.endpoint.type, schemaKey);
    if (!catalogueSchema[schemaKey] && tempId === this.entityKey) {
      // We've requested the default by passing the schema key that matches the entity type
      return catalogueSchema.default;
    }
    return catalogueSchema[schemaKey];
  }

  public getGuidFromEntity(entity: Y) {
    if (!this.builders.entityBuilder || !this.builders.entityBuilder.getGuid || !this.builders.entityBuilder.getMetadata) {
      return null;
    }
    const metadata = this.builders.entityBuilder.getMetadata(entity);
    return this.builders.entityBuilder.getGuid(metadata);
  }

  public getEntityMonitor<Q extends AppState>(
    store: Store<Q>,
    entityId: string,
    {
      schemaKey = '',
      startWithNull = false
    } = {}
  ) {
    return new EntityMonitor(store, entityId, this.entityKey, this.getSchema(schemaKey), startWithNull);
  }

  public getTypeAndSubtype() {
    const type = this.definition.parentType || this.definition.type;
    const subType = this.definition.parentType ? this.definition.type : null;
    return {
      type,
      subType
    };
  }
}

export class StratosCatalogueEntity<T extends IEntityMetadata = IEntityMetadata, Y = any> extends StratosBaseCatalogueEntity<T, Y> {
  public definition: IStratosEntityDefinition<EntityCatalogueSchemas>;
  constructor(
    entity: IStratosEntityDefinition,
    config?: EntityCatalogueBuilders<T, Y>
  ) {
    super(entity, config);
  }
}

export class StratosCatalogueEndpointEntity extends StratosBaseCatalogueEntity<IEndpointFavMetadata, EndpointModel> {
  static readonly baseEndpointRender = {
    getMetadata: endpoint => ({
      name: endpoint.name,
      guid: endpoint.guid,
      address: getFullEndpointApiUrl(endpoint),
      user: endpoint.user ? endpoint.user.name : undefined,
      subType: endpoint.sub_type,
      admin: endpoint.user ? endpoint.user.admin ? 'Yes' : 'No' : undefined
    }),
    getLink: () => null,
    getGuid: metadata => metadata.guid,
    getLines: metadata => [
      ['Address', metadata.address],
      ['User', metadata.user],
      ['Admin', metadata.admin]
    ]
  } as IStratosEntityBuilder<IEndpointFavMetadata, EndpointModel>;
  // This is needed here for typing
  public definition: IStratosEndpointDefinition;
  constructor(
    entity: IStratosEndpointWithoutSchemaDefinition | IStratosEndpointDefinition,
    getLink?: (metadata: IEndpointFavMetadata) => string
  ) {
    const fullEntity = {
      ...entity,
      schema: {
        default: endpointEntitySchema
      }
    } as IStratosEndpointDefinition;
    super(fullEntity, {
      entityBuilder: {
        ...StratosCatalogueEndpointEntity.baseEndpointRender,
        getLink: getLink || StratosCatalogueEndpointEntity.baseEndpointRender.getLink
      }
    });
  }
}
