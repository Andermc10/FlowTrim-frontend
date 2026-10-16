import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { SubscriptionResponse } from '../models/subscription.models';
import { SubscriptionService } from '../services/subscription-service';
import { I18nService } from '../../../core/i18n/i18n.service';
import { Icon } from '../../../core/ui/icon/icon';
import { Modal } from '../../../core/ui/modal/modal';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { SubscriptionForm } from '../subscription-form/subscription-form';

type ListStatus = 'loading' | 'success' | 'error';

@Component({
  selector: 'app-subscription-list',
  imports: [RouterLink, TranslatePipe, Icon, Modal, SubscriptionForm],
  templateUrl: './subscription-list.html',
  styleUrl: './subscription-list.scss',
})
export class SubscriptionList implements OnInit {
  private readonly service = inject(SubscriptionService);
  protected readonly i18n = inject(I18nService);

  protected readonly status = signal<ListStatus>('loading');
  protected readonly all = signal<SubscriptionResponse[]>([]);
  protected readonly totalCount = signal(0);
  protected readonly search = signal('');
  protected readonly confirmingId = signal<string | null>(null);
  protected readonly deleteError = signal<string | null>(null);
  protected readonly editorMode = signal<'create' | 'edit' | null>(null);
  protected readonly editorId = signal<string | null>(null);
  protected readonly editorDirty = signal(false);
  protected readonly discardConfirmation = signal(false);
  protected readonly deleteTarget = signal<SubscriptionResponse | null>(null);

  // Búsqueda cliente sobre la página actual (servidor diferido a una historia posterior).
  protected readonly filtered = computed(() => {
    const term = this.search().trim().toLowerCase();
    const items = this.all();
    return term ? items.filter((s) => s.name.toLowerCase().includes(term)) : items;
  });

  protected readonly isEmpty = computed(() => this.status() === 'success' && this.all().length === 0);

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.status.set('loading');
    this.deleteError.set(null);
    this.service.list(1, 100).subscribe({
      next: (page) => {
        this.all.set(page.items);
        this.totalCount.set(page.totalCount);
        this.status.set('success');
      },
      error: () => this.status.set('error'),
    });
  }

  protected askDelete(id: string): void {
    this.deleteError.set(null);
    this.confirmingId.set(id);
  }

  protected cancelDelete(): void {
    this.confirmingId.set(null);
  }

  protected confirmDelete(id: string): void {
    this.service.delete(id).subscribe({
      next: () => {
        this.confirmingId.set(null);
        this.load();
      },
      error: () => this.deleteError.set('Could not delete the subscription. Please try again.'),
    });
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
        this.load();
      },
      error: () => {
        this.deleteError.set(this.i18n.translate('subscriptions.deleteError'));
        this.closeDelete();
      },
    });
  }
}
