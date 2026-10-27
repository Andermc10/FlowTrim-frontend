import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { BankImportChoices, BankImportConfirmation, BankImportPreview } from './bank-import.models';

/** Capa HTTP de la importación del CSV del banco (EP-16 HU-79): multipart con el archivo y las elecciones. */
@Injectable({ providedIn: 'root' })
export class BankImportService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/api/transaction-imports`;

  /** Valida el archivo sin guardar nada. */
  preview(file: File, choices: BankImportChoices): Observable<BankImportPreview> {
    return this.http.post<BankImportPreview>(`${this.baseUrl}/preview`, this.form(file, choices));
  }

  /** Reenvía el mismo archivo y elecciones; crea las filas válidas en una sola operación. */
  confirm(file: File, choices: BankImportChoices): Observable<BankImportConfirmation> {
    return this.http.post<BankImportConfirmation>(`${this.baseUrl}/confirm`, this.form(file, choices));
  }

  private form(file: File, choices: BankImportChoices): FormData {
    const form = new FormData();
    form.append('file', file, file.name);
    form.append('accountId', choices.accountId);
    form.append('expenseCategoryId', choices.expenseCategoryId);
    form.append('incomeCategoryId', choices.incomeCategoryId);
    return form;
  }
}
