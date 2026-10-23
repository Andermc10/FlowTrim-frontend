import { Injectable, signal } from '@angular/core';
import { Observable, Subject } from 'rxjs';

import { TransactionResponse } from '../transactions.models';

/** Clave de localStorage con la última cuenta usada en el registro rápido (se recuerda por navegador). */
export const lastAccountStorageKey = 'flowtrim.quickAdd.lastAccountId';

/**
 * Estado compartido del registro rápido (HU-67): si el modal está abierto, la última cuenta usada y el aviso de que se
 * registró un movimiento, para que la pantalla abierta (Movimientos, Cuentas, Hoy) recargue sus datos sin recargar
 * la página.
 */
@Injectable({ providedIn: 'root' })
export class QuickAddService {
  private readonly openState = signal(false);
  private readonly savedSubject = new Subject<TransactionResponse>();

  readonly isOpen = this.openState.asReadonly();

  /** Emite cada movimiento registrado desde el modal. */
  readonly saved$: Observable<TransactionResponse> = this.savedSubject.asObservable();

  open(): void {
    this.openState.set(true);
  }

  close(): void {
    this.openState.set(false);
  }

  notifySaved(transaction: TransactionResponse): void {
    this.rememberAccount(transaction.accountId);
    this.savedSubject.next(transaction);
  }

  /** Última cuenta usada; null si no hay o el almacenamiento no está disponible (modo privado). */
  lastAccountId(): string | null {
    try {
      return localStorage.getItem(lastAccountStorageKey);
    } catch {
      return null;
    }
  }

  private rememberAccount(accountId: string): void {
    try {
      localStorage.setItem(lastAccountStorageKey, accountId);
    } catch {
      // Sin almacenamiento solo se pierde la preferencia; el registro ya se hizo.
    }
  }
}
