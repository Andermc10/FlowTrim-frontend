import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AlertWindow, UpcomingChargeItem } from '../models/subscription.models';
import { SubscriptionService } from '../services/subscription-service';

type PanelStatus = 'loading' | 'success' | 'error';

@Component({
  selector: 'app-upcoming-panel',
  imports: [RouterLink],
  templateUrl: './upcoming-panel.html',
  styleUrl: './upcoming-panel.scss',
})
export class UpcomingPanel implements OnInit {
  private readonly service = inject(SubscriptionService);

  protected readonly status = signal<PanelStatus>('loading');
  protected readonly items = signal<UpcomingChargeItem[]>([]);
  protected readonly referenceDate = signal<string>('');
  protected readonly isEmpty = computed(
    () => this.status() === 'success' && this.items().length === 0,
  );

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.status.set('loading');
    this.service.getUpcoming().subscribe({
      next: (response) => {
        this.items.set(response.items);
        this.referenceDate.set(response.referenceDate);
        this.status.set('success');
      },
      error: () => this.status.set('error'),
    });
  }

  /** Texto de la cuenta regresiva a partir de los días calculados por el servidor. */
  protected countdownLabel(days: number): string {
    if (days < 0) {
      return `${Math.abs(days)} day(s) overdue`;
    }
    if (days === 0) {
      return 'Today';
    }
    return `in ${days} day(s)`;
  }

  /** Clase CSS del badge según la ventana de alerta. */
  protected badgeClass(window: AlertWindow): string {
    switch (window) {
      case 'Overdue':
        return 'badge badge--overdue';
      case 'Today':
        return 'badge badge--today';
      case 'DueWithin3Days':
        return 'badge badge--soon3';
      case 'DueWithin7Days':
        return 'badge badge--soon7';
      default:
        return 'badge badge--later';
    }
  }
}
