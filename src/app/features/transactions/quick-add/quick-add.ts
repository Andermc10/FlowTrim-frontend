import { Component, effect, inject, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import { QuickAddService } from './quick-add.service';
import { TransactionForm } from '../transaction-form/transaction-form';
import { TransactionResponse } from '../transactions.models';
import { TransactionsService } from '../transactions-service';
import { AccountResponse } from '../../accounts/accounts.models';
import { AccountsService } from '../../accounts/accounts-service';
import { CategoryResponse } from '../../categories/categories.models';
import { CategoriesService } from '../../categories/categories-service';
import { productToday } from '../../../core/format/product-calendar';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { Modal } from '../../../core/ui/modal/modal';

type QuickAddStatus = 'loading' | 'ready' | 'error';

/** Días hacia atrás (hoy incluido) que se miran para ordenar las categorías por uso. */
export const usageWindowDays = 90;

/**
 * Registro rápido (HU-67): el atajo `N` (sin ningún campo con foco ni otro diálogo abierto) o el botón "+ Agregar" abren
 * un modal compacto con el formulario de movimientos. Carga cuentas y categorías activas y los movimientos de los
 * últimos 90 días para ordenar las categorías de más a menos usada.
 */
@Component({
  selector: 'app-quick-add',
  imports: [RouterLink, TranslatePipe, Modal, TransactionForm],
  host: { '(document:keydown)': 'onKeydown($event)' },
  template: `
    @if (quickAdd.isOpen()) {
      <app-modal [title]="'quickAdd.title' | translate" (closeRequested)="close()">
        @if (status() === 'loading') {
          <p class="muted" role="status">{{ 'common.loading' | translate }}</p>
        } @else if (status() === 'error') {
          <div class="banner banner--error" role="alert">
            {{ 'quickAdd.loadError' | translate }}
            <button type="button" class="link" (click)="load()">{{ 'common.retry' | translate }}</button>
          </div>
        } @else if (accounts().length === 0) {
          <div class="no-accounts">
            <p>{{ 'quickAdd.noAccounts' | translate }}</p>
            <a class="btn" routerLink="/app/accounts" (click)="close()">{{ 'accounts.addFirst' | translate }}</a>
          </div>
        } @else {
          <app-transaction-form
            [quickAdd]="true"
            [accounts]="accounts()"
            [categories]="categories()"
            [categoryUsage]="usage()"
            [initialAccountId]="quickAdd.lastAccountId()"
            (saved)="handleSaved($event, true)"
            (savedAndContinued)="handleSaved($event, false)"
            (closeRequested)="close()" />
        }
      </app-modal>
    }
  `,
  styles: `
    .muted { color: var(--color-muted); }
    .no-accounts { display: grid; gap: 1rem; justify-items: start; }
    .no-accounts p { margin: 0; color: var(--color-muted); line-height: 1.6; }
    .link { padding: 0 0.35rem; }
  `,
})
export class QuickAdd {
  protected readonly quickAdd = inject(QuickAddService);
  private readonly accountsService = inject(AccountsService);
  private readonly categoriesService = inject(CategoriesService);
  private readonly transactionsService = inject(TransactionsService);

  protected readonly status = signal<QuickAddStatus>('loading');
  protected readonly accounts = signal<AccountResponse[]>([]);
  protected readonly categories = signal<CategoryResponse[]>([]);
  protected readonly usage = signal<ReadonlyMap<string, number>>(new Map());

  constructor() {
    // Cada apertura recarga: las cuentas o categorías pudieron cambiar en otra pantalla.
    effect(() => {
      if (this.quickAdd.isOpen()) {
        untracked(() => this.load());
      }
    });
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key.toLowerCase() !== 'n' || event.ctrlKey || event.metaKey || event.altKey || event.repeat) {
      return;
    }
    if (isEditable(event.target) || document.querySelector('dialog[open]')) {
      return;
    }
    event.preventDefault();
    this.quickAdd.open();
  }

  protected load(): void {
    this.status.set('loading');
    const to = productToday();
    const from = shiftDays(to, -(usageWindowDays - 1));
    forkJoin([
      this.accountsService.list(),
      this.categoriesService.list(),
      this.transactionsService.list({ from, to }),
    ]).subscribe({
      next: ([accounts, categories, recent]) => {
        this.accounts.set(accounts);
        this.categories.set(categories);
        this.usage.set(countByCategory(recent.items));
        this.status.set('ready');
      },
      error: () => this.status.set('error'),
    });
  }

  protected handleSaved(transaction: TransactionResponse, closeAfter: boolean): void {
    this.quickAdd.notifySaved(transaction);
    if (closeAfter) {
      this.close();
    }
  }

  protected close(): void {
    this.quickAdd.close();
  }
}

// Un campo de texto, selector o contenido editable tiene el foco: la tecla N es para escribir, no un atajo.
function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

function shiftDays(date: string, delta: number): string {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + delta)).toISOString().slice(0, 10);
}

// Usos por categoría en los movimientos recibidos (hasta la página máxima de la API: los 200 más recientes).
function countByCategory(items: readonly TransactionResponse[]): ReadonlyMap<string, number> {
  const usage = new Map<string, number>();
  for (const item of items) {
    if (item.categoryId) {
      usage.set(item.categoryId, (usage.get(item.categoryId) ?? 0) + 1);
    }
  }
  return usage;
}
