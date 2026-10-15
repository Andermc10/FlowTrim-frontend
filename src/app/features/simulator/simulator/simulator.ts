import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { SubscriptionResponse } from '../../subscriptions/models/subscription.models';
import { SubscriptionService } from '../../subscriptions/services/subscription-service';
import { SimulationResponse } from '../simulation.models';
import { SimulationService } from '../simulation-service';

type SimulatorStatus = 'loading' | 'ready' | 'error';

@Component({
  selector: 'app-simulator',
  imports: [RouterLink],
  templateUrl: './simulator.html',
  styleUrl: './simulator.scss',
})
export class Simulator implements OnInit {
  private static readonly Horizons = [1, 12, 24];

  private readonly subscriptionService = inject(SubscriptionService);
  private readonly simulationService = inject(SimulationService);

  protected readonly status = signal<SimulatorStatus>('loading');
  protected readonly subscriptions = signal<SubscriptionResponse[]>([]);
  protected readonly selected = signal<ReadonlySet<string>>(new Set());
  protected readonly result = signal<SimulationResponse | null>(null);
  protected readonly isEmpty = computed(
    () => this.status() === 'ready' && this.subscriptions().length === 0,
  );

  ngOnInit(): void {
    this.loadSubscriptions();
  }

  protected loadSubscriptions(): void {
    this.status.set('loading');
    this.subscriptionService.list(1, 100).subscribe({
      next: (page) => {
        // El simulador solo opera sobre suscripciones activas.
        this.subscriptions.set(page.items.filter((s) => s.status === 'Active'));
        this.status.set('ready');
        this.simulate();
      },
      error: () => this.status.set('error'),
    });
  }

  protected isSelected(id: string): boolean {
    return this.selected().has(id);
  }

  protected toggle(id: string): void {
    const next = new Set(this.selected());
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    this.selected.set(next);
    this.simulate();
  }

  private simulate(): void {
    this.simulationService
      .simulate({ subscriptionIds: [...this.selected()], horizons: Simulator.Horizons })
      .subscribe({
        next: (response) => this.result.set(response),
        error: () => this.result.set(null),
      });
  }
}
