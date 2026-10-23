import { NgTemplateOutlet } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { AccountResponse, AccountType } from '../accounts.models';
import { AccountsService } from '../accounts-service';
import { accountErrorToast } from '../account-errors';
import { totalsByCurrency } from '../account-totals';
import { AccountForm } from '../account-form/account-form';
import { QuickAddService } from '../../transactions/quick-add/quick-add.service';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { MoneyPipe } from '../../../core/format/money.pipe';
import { Icon, IconName } from '../../../core/ui/icon/icon';
import { Modal } from '../../../core/ui/modal/modal';
import { ToastService } from '../../../core/ui/toast/toast.service';

type PageStatus = 'loading' | 'success' | 'error';

const typeIcons: Record<AccountType, IconName> = {
  Cash: 'cash',
  Bank: 'bank',
  CreditCard: 'card',
  Savings: 'savings',
};

/**
 * Cuentas con su saldo calculado (HU-64): totales por moneda (tarjetas aparte), tarjetas por cuenta y acciones de
 * crear, editar, archivar/restaurar y borrar. Una cuenta con movimientos no se borra: el diálogo ofrece archivarla.
 */
@Component({
  selector: 'app-accounts-page',
  imports: [NgTemplateOutlet, TranslatePipe, MoneyPipe, Icon, Modal, AccountForm],
  templateUrl: './accounts-page.html',
  styleUrl: './accounts-page.scss',
})
export class AccountsPage implements OnInit {
  private readonly service = inject(AccountsService);
  private readonly toast = inject(ToastService);
  private readonly quickAdd = inject(QuickAddService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly i18n = inject(I18nService);

  protected readonly status = signal<PageStatus>('loading');
  protected readonly accounts = signal<AccountResponse[]>([]);
  protected readonly editorOpen = signal(false);
  protected readonly editing = signal<AccountResponse | null>(null);
  protected readonly editorDirty = signal(false);
  protected readonly discardConfirmation = signal(false);
  protected readonly deleteTarget = signal<AccountResponse | null>(null);
  // Cuenta con una acción en curso (archivar, restaurar o borrar): evita el doble clic.
  protected readonly busyId = signal<string | null>(null);

  protected readonly active = computed(() => this.accounts().filter((account) => !account.isArchived));
  protected readonly archived = computed(() => this.accounts().filter((account) => account.isArchived));
  protected readonly totals = computed(() => totalsByCurrency(this.accounts()));

  ngOnInit(): void {
    this.load();
    // Un movimiento registrado desde el registro rápido cambia los saldos: se recargan.
    this.quickAdd.saved$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.load());
  }

  protected load(): void {
    this.status.set('loading');
    // Una sola petición con las archivadas: la página las separa en su propia sección.
    this.service.list(true).subscribe({
      next: (accounts) => {
        this.accounts.set(accounts);
        this.status.set('success');
      },
      error: () => this.status.set('error'),
    });
  }

  protected typeIcon(type: AccountType): IconName {
    return typeIcons[type];
  }

  /** Una tarjeta con saldo negativo muestra la deuda en positivo con la etiqueta "Debes". */
  protected isOwed(account: AccountResponse): boolean {
    return account.type === 'CreditCard' && account.balance < 0;
  }

  protected openCreate(): void {
    this.editing.set(null);
    this.editorDirty.set(false);
    this.editorOpen.set(true);
  }

  protected openEdit(account: AccountResponse): void {
    this.editing.set(account);
    this.editorDirty.set(false);
    this.editorOpen.set(true);
  }

  protected requestEditorClose(): void {
    if (this.editorDirty()) {
      this.discardConfirmation.set(true);
      return;
    }
    this.closeEditor();
  }

  protected closeEditor(): void {
    this.editorOpen.set(false);
    this.editing.set(null);
    this.editorDirty.set(false);
    this.discardConfirmation.set(false);
  }

  protected handleSaved(): void {
    this.closeEditor();
    this.load();
  }

  /** Archiva o restaura sin tocar los demás campos (PUT completo con los valores actuales). */
  protected setArchived(account: AccountResponse, isArchived: boolean): void {
    this.busyId.set(account.id);
    this.service
      .update(account.id, {
        name: account.name,
        type: account.type,
        currency: account.currency,
        openingBalance: account.openingBalance,
        isArchived,
      })
      .subscribe({
        next: () => {
          this.busyId.set(null);
          this.deleteTarget.set(null);
          this.toast.success(this.i18n.translate(isArchived ? 'toast.accountArchived' : 'toast.accountRestored', { name: account.name }));
          this.load();
        },
        error: (error: HttpErrorResponse) => {
          this.busyId.set(null);
          accountErrorToast(this.toast, this.i18n, error);
        },
      });
  }

  protected openDelete(account: AccountResponse): void {
    this.deleteTarget.set(account);
  }

  protected closeDelete(): void {
    this.deleteTarget.set(null);
  }

  protected confirmDelete(): void {
    const target = this.deleteTarget();
    if (!target) {
      return;
    }
    this.busyId.set(target.id);
    this.service.delete(target.id).subscribe({
      next: () => {
        this.busyId.set(null);
        this.closeDelete();
        this.toast.success(this.i18n.translate('toast.accountDeleted', { name: target.name }));
        this.load();
      },
      error: (error: HttpErrorResponse) => {
        // 409: se registró un movimiento mientras el diálogo estaba abierto; la recarga muestra la opción de archivar.
        this.busyId.set(null);
        this.closeDelete();
        accountErrorToast(this.toast, this.i18n, error);
        this.load();
      },
    });
  }
}
