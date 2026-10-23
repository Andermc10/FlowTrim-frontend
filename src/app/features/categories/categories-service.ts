import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { I18nService } from '../../core/i18n/i18n.service';
import { CategoryKind, CategoryResponse, CreateCategoryRequest, UpdateCategoryRequest } from './categories.models';

/** Capa HTTP tipada para categorías (HU-65). */
@Injectable({ providedIn: 'root' })
export class CategoriesService {
  private readonly http = inject(HttpClient);
  private readonly i18n = inject(I18nService);
  private readonly baseUrl = `${environment.apiUrl}/api/categories`;

  /**
   * Categorías del usuario. La primera lista de un usuario sin categorías crea el set por defecto: se envía el idioma
   * de la interfaz (no el del navegador) para que los nombres salgan en el idioma que el usuario está viendo.
   */
  list(options: { kind?: CategoryKind; includeArchived?: boolean } = {}): Observable<CategoryResponse[]> {
    let params = new HttpParams();
    if (options.kind) {
      params = params.set('kind', options.kind);
    }
    if (options.includeArchived) {
      params = params.set('includeArchived', true);
    }
    const headers = new HttpHeaders({ 'Accept-Language': this.i18n.language() });
    return this.http.get<CategoryResponse[]>(this.baseUrl, { params, headers });
  }

  /** Crea una categoría (201 / 400). */
  create(request: CreateCategoryRequest): Observable<CategoryResponse> {
    return this.http.post<CategoryResponse>(this.baseUrl, request);
  }

  /** Actualiza una categoría (200 / 400 / 404 / 409 category_kind_locked). */
  update(id: string, request: UpdateCategoryRequest): Observable<CategoryResponse> {
    return this.http.put<CategoryResponse>(`${this.baseUrl}/${id}`, request);
  }

  /** Borra una categoría sin movimientos (204 / 404 / 409 category_in_use). */
  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
