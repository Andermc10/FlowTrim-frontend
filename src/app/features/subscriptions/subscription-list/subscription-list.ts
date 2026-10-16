import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { SubscriptionResponse } from '../models/subscription.models';
import { SubscriptionService } from '../services/subscription-service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';

type ListStatus = 'loading' | 'success' | 'error';

@Component({
  selector: 'app-subscription-list',
  imports: [RouterLink, TranslatePipe],
  templateUrl: './subscription-list.html',
  styleUrl: './subscription-list.scss',
})
export class SubscriptionList implements OnInit {
  private readonly service = inject(SubscriptionService);

  protected readonly status = signal<ListStatus>('loading');
  protected readonly all = signal<SubscriptionResponse[]>([]);
  protected readonly totalCount = signal(0);
  protected readonly search = signal('');
  protected readonly confirmingId = signal<string | null>(null);
  protected readonly deleteError = signal<string | null>(null);

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
}
