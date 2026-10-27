import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import { SubscriptionKind, SubscriptionResponse, subscriptionKinds } from '../models/subscription.models';
import { SubscriptionService } from '../services/subscription-service';
import { MarkPaidDialog } from '../mark-paid-dialog/mark-paid-dialog';
import { I18nService } from '../../../core/i18n/i18n.service';
import { ToastService } from '../../../core/ui/toast/toast.service';
import { Icon } from '../../../core/ui/icon/icon';
import { Modal } from '../../../core/ui/modal/modal';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { SubscriptionForm } from '../subscription-form/subscription-form';
import { MoneyPipe } from '../../../core/format/money.pipe';

type ListStatus = 'loading' | 'success' | 'error';

@Component({
  selector: 'app-subscription-list',
  imports: [RouterLink, TranslatePipe, Icon, Modal, SubscriptionForm, MoneyPipe, MarkPaidDialog],
  templateUrl: './subscription-list.html',
  styleUrl: './subscription-list.scss',
})
export class SubscriptionList implements OnInit {
  private readonly service = inject(SubscriptionService);
  protected readonly i18n = inject(I18nService);
  private readonly toast = inject(ToastService);

  protected readonly status = signal<ListStatus>('loading');
  protected readonly all = signal<SubscriptionResponse[]>([]);
  protected readonly search = signal('');
  // Filtro por tipo (EP-14 HU-72); vacío = todos.
  protected readonly kindFilter = signal<SubscriptionKind | ''>('');
  protected readonly kinds = subscriptionKinds;
  protected readonly editorMode = signal<'create' | 'edit' | null>(null);
  protected readonly editorId = signal<string | null>(null);
  protected readonly editorDirty = signal(false);
  protected readonly discardConfirmation = signal(false);
  protected readonly deleteTarget = signal<SubscriptionResponse | null>(null);
  // Pago cuyo diálogo "Marcar como pagado" está abierto.
  protected readonly payTargetId = signal<string | null>(null);

  // Búsqueda y filtro por tipo en el cliente sobre todos los pagos cargados.
  protected readonly filtered = computed(() => {
    const term = this.search().trim().toLowerCase();
    const kind = this.kindFilter();
    return this.all().filter(
      (s) => (!term || s.name.toLowerCase().includes(term)) && (!kind || s.kind === kind),
    );
  });

  protected readonly isEmpty = computed(
    () => this.status() === 'success' && this.all().length === 0,
  );

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.status.set('loading');
    this.service.listAll().subscribe({
      next: (subscriptions) => {
        this.all.set(subscriptions);
        this.status.set('success');
      },
      error: () => this.status.set('error'),
    });
  }

  /** Abre el diálogo de pago (EP-14 HU-73): registrar el gasto en una cuenta o solo mover la fecha. */
  protected markPaid(subscription: SubscriptionResponse): void {
    this.payTargetId.set(subscription.id);
  }

  /** Plan de cuotas con todas sus cuotas pagadas (EP-14 HU-74). */
  protected isCompleted(subscription: SubscriptionResponse): boolean {
    return subscription.kind === 'Instalment' && subscription.totalInstalments !== null
      && subscription.paidInstalments >= subscription.totalInstalments;
  }

  protected handlePaid(): void {
    this.payTargetId.set(null);
    this.load();
  }

  protected openCreate(): void {
    this.editorId.set(null);
    this.editorDirty.set(false);
    this.editorMode.set('create');
  }

  protected openEdit(id: string): void {
    this.editorId.set(id);
    this.editorDirty.set(false);
    this.editorMode.set('edit');
  }

  protected requestEditorClose(): void {
    if (this.editorDirty()) {
      this.discardConfirmation.set(true);
      return;
    }
    this.closeEditor();
  }

  protected closeEditor(): void {
    this.editorMode.set(null);
    this.editorId.set(null);
    this.editorDirty.set(false);
    this.discardConfirmation.set(false);
  }

  protected handleEditorSaved(): void {
    this.closeEditor();
    this.load();
  }

  protected openDelete(subscription: SubscriptionResponse): void {
    this.deleteTarget.set(subscription);
  }

  protected closeDelete(): void {
    this.deleteTarget.set(null);
  }

  protected confirmDeleteTarget(): void {
    const target = this.deleteTarget();
    if (!target) {
      return;
    }
    this.service.delete(target.id).subscribe({
      next: () => {
        this.closeDelete();
        this.toast.success(this.i18n.translate('toast.subscriptionDeleted', { name: target.name }));
        this.load();
      },
      error: (error: HttpErrorResponse) => {
        this.toast.httpError(error);
        this.closeDelete();
      },
    });
  }
}
