import { Injectable, inject, computed } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { SessionContextService } from './session-context.service';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  private session = inject(SessionContextService);

  // ─────────────────────────────────────────────────────────────
  // QUÉ HACE: Calcula la URL base reactivamente según el Tenant activo.
  // POR QUÉ:  Permite que el mismo bundle llame a diferentes subdominios de API
  //           sin depender de variables globales no seguras en SSR.
  // ─────────────────────────────────────────────────────────────
  readonly baseUrl = computed(() => 
    this.session.isBrotalia() ? environment.apiBrotalia : environment.apiIntegrales
  );

  get<T>(path: string, params?: Record<string, string>) {
    let httpParams = new HttpParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => httpParams = httpParams.set(k, v));
    }
    return this.http.get<T>(`${this.baseUrl()}${path}`, { params: httpParams });
  }

  getSettings() {
    return this.get<{ usd_exchange_rate: number, updated_at: string }>('/settings');
  }

  post<T>(path: string, body: any) {
    return this.http.post<T>(`${this.baseUrl()}${path}`, body);
  }
}


