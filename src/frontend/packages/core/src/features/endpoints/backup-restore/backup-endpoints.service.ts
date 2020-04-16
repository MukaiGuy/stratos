import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import { BehaviorSubject, Observable } from 'rxjs';
import { filter, first, map, switchMap } from 'rxjs/operators';

import { GeneralEntityAppState } from '../../../../../store/src/app-state';
import { entityCatalog } from '../../../../../store/src/entity-catalog/entity-catalog.service';
import { AuthState } from '../../../../../store/src/reducers/auth.reducer';
import { SessionData } from '../../../../../store/src/types/auth.types';
import { EndpointModel } from '../../../../../store/src/types/endpoint.types';
import { BrowserStandardEncoder } from '../../../helper';
import {
  BackupEndpointConfigUI,
  BackupEndpointConnectionTypes,
  BackupEndpointsConfig,
  BackupEndpointTypes,
  BaseEndpointConfig,
} from './backup-restore.types';


interface BackupRequest {
  state: BackupEndpointsConfig<BaseEndpointConfig>;
  userId: string;
  password: string;
}

@Injectable()
export class BackupEndpointsService {

  hasChanges = new BehaviorSubject(false);
  hasChanges$ = this.hasChanges.asObservable();
  allChanged = new BehaviorSubject(false);
  allChanged$ = this.allChanged.asObservable();

  state: BackupEndpointsConfig<BackupEndpointConfigUI> = {};
  password: string;

  constructor(
    private store: Store<GeneralEntityAppState>,
    private http: HttpClient
  ) {
  }

  // State Related
  initialize(endpoints: EndpointModel[]) {
    endpoints.forEach(entity => {
      this.state[entity.guid] = {
        [BackupEndpointTypes.ENDPOINT]: false,
        [BackupEndpointTypes.CONNECT]: BackupEndpointConnectionTypes.NONE,
        entity
      };
    });
    this.validate();
  }

  validate() {
    const endpoints = Object.values(this.state);
    endpoints.forEach(endpoint => {
      if (!endpoint[BackupEndpointTypes.ENDPOINT]) {
        endpoint[BackupEndpointTypes.CONNECT] = BackupEndpointConnectionTypes.NONE;
      }
    });

    const hasChanges = !!endpoints.find(endpoint =>
      endpoint[BackupEndpointTypes.ENDPOINT] ||
      endpoint[BackupEndpointTypes.CONNECT] !== BackupEndpointConnectionTypes.NONE
    );
    this.hasChanges.next(hasChanges);
    const allChanged = endpoints.every(endpoint => {
      const e = !this.canBackup(endpoint.entity, BackupEndpointTypes.ENDPOINT) || endpoint[BackupEndpointTypes.ENDPOINT];
      const c = !this.canBackup(endpoint.entity, BackupEndpointTypes.CONNECT) || endpoint[BackupEndpointTypes.CONNECT] !== BackupEndpointConnectionTypes.NONE;
      return e && c;
    }

    );
    this.allChanged.next(allChanged);
  }

  canBackup(endpoint: EndpointModel, type: BackupEndpointTypes): boolean {
    // Can always back up endpoint
    if (type === BackupEndpointTypes.ENDPOINT) {
      return true;
    }

    // All other settings require endpoint to be backed up
    if (!this.state[endpoint.guid][BackupEndpointTypes.ENDPOINT]) {
      return false;
    }

    const epType = entityCatalog.getEndpoint(endpoint.cnsi_type, endpoint.sub_type).definition;
    // The endpoint type supports connection details
    if (epType.unConnectable) {
      return false;
    }

    return true;
  }

  selectAll() {
    Object.values(this.state).forEach(endpoint => {
      if (this.canBackup(endpoint.entity, BackupEndpointTypes.ENDPOINT)) {
        endpoint[BackupEndpointTypes.ENDPOINT] = true;
      }
      if (this.canBackup(endpoint.entity, BackupEndpointTypes.CONNECT)) {
        endpoint[BackupEndpointTypes.CONNECT] = BackupEndpointConnectionTypes.ALL;
      }
    });
    this.validate();
  }

  selectNone() {
    Object.values(this.state).forEach(endpoint => {
      endpoint[BackupEndpointTypes.ENDPOINT] = false;
      endpoint[BackupEndpointTypes.CONNECT] = BackupEndpointConnectionTypes.NONE;
    });
    this.validate();
  }

  hasConnectionDetails(): boolean {
    return !!Object.values(this.state).find(e => e[BackupEndpointTypes.CONNECT] !== BackupEndpointConnectionTypes.NONE);
  }

  // Request Related

  createBackup(): Observable<Blob> {
    const url = '/pp/v1/endpoints/backup';
    const fromObject = {};
    const params: HttpParams = new HttpParams({
      fromObject,
      encoder: new BrowserStandardEncoder()
    });

    return this.getSessionData().pipe(
      switchMap(ses => this.http.post(url, this.createBodyToSend(ses), {
        params
      })),
      map(res => {
        console.log('Response: ', res);
        return new Blob([JSON.stringify(res)]);
      }),
      first(),
    );
  }

  private createBodyToSend(sd: SessionData): BackupRequest {
    const state: BackupEndpointsConfig<BaseEndpointConfig> = Object.entries(this.state).reduce((res, [endpointId, endpoint]) => {
      if (endpoint[BackupEndpointTypes.ENDPOINT]) {
        const { entity, ...rest } = endpoint;
        const requestConfig: BaseEndpointConfig = {
          ...rest,
        };
        res[endpointId] = requestConfig;
      }
      return res;
    }, {});
    return {
      state,
      userId: this.getUserIdFromSessionData(sd),
      password: this.password,
    };
  }

  private getUserIdFromSessionData(sd: SessionData): string {
    if (sd && sd.user) {
      return sd.user.guid;
    }
    return null;
  }

  private getSessionData(): Observable<SessionData> {
    return this.store.select(s => s.auth).pipe(
      filter(auth => !!(auth && auth.sessionData)),
      map((auth: AuthState) => auth.sessionData),
      first()
    );
  }



}
