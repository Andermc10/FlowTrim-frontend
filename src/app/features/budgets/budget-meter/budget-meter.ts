import { Component, computed, input } from '@angular/core';

import { BudgetState } from '../budgets.models';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';

/**
 * Barra de avance de un presupuesto (EP-15 HU-76): color según el estado y siempre con texto (porcentaje y estado),
 * nunca solo color. La comparten la página de presupuestos y la tarjeta de Hoy.
 */
@Component({
  selector: 'app-budget-meter',
  imports: [TranslatePipe],
  template: `
    <div class="meter" [class.meter--warning]="state() === 'Warning'" [class.meter--exceeded]="state() === 'Exceeded'">
      <span class="meter__track" aria-hidden="true"><span class="meter__fill" [style.width.%]="width()"></span></span>
      <span class="meter__label">{{ percent() }} % · {{ ('budgets.state.' + state()) | translate }}</span>
    </div>
  `,
  styles: `
    .meter {
      display: grid;
      gap: 0.3rem;
      --meter-color: var(--color-primary);
    }
    .meter--warning {
      --meter-color: var(--color-warning);
    }
    .meter--exceeded {
      --meter-color: var(--color-danger);
    }
    .meter__track {
      overflow: hidden;
      height: 0.45rem;
      border-radius: 999px;
      background: var(--color-surface-soft);
    }
    .meter__fill {
      display: block;
      height: 100%;
      border-radius: inherit;
      background: var(--meter-color);
    }
    .meter__label {
      color: var(--meter-color);
      font-size: 0.72rem;
      font-weight: 800;
    }
  `,
})
export class BudgetMeter {
  readonly percent = input.required<number>();
  readonly state = input.required<BudgetState>();

  /** El relleno nunca pasa del 100 % aunque el gasto lo supere (el texto sí muestra el valor real). */
  protected readonly width = computed(() => Math.min(100, Math.max(0, this.percent())));
}
