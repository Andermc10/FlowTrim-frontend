import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';

import { ContributionResponse, GoalDetailResponse, GoalResponse } from '../goals.models';
import { GoalsService } from '../goals-service';
import { GoalForm } from '../goal-form/goal-form';
import { ContributionForm } from '../contribution-form/contribution-form';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { MoneyPipe } from '../../../core/format/money.pipe';
import { dateLabel, localeFor } from '../../../core/format/money';
import { Icon } from '../../../core/ui/icon/icon';
import { Modal } from '../../../core/ui/modal/modal';
import { ToastService } from '../../../core/ui/toast/toast.service';
import { conflictErrorToast } from '../../../core/ui/toast/conflict-toast';

type PageStatus = 'loading' | 'success' | 'error';

/**
 * Metas de ahorro (EP-15 HU-77): avance, cuánto hace falta por mes para llegar a la fecha y una fecha estimada con el
 * ritmo de los últimos 3 meses (estimaciones, no promesas). Los aportes son declarados: no mueven dinero entre cuentas.
 */
@Component({
  selector: 'app-goals-page',
  imports: [TranslatePipe, MoneyPipe, Icon, Modal, GoalForm, ContributionForm],
  templateUrl: './goals-page.html',
  styleUrl: './goals-page.scss',
})
export class GoalsPage implements OnInit {
  private readonly service = inject(GoalsService);
  private readonly i18n = inject(I18nService);
  private readonly toast = inject(ToastService);

  protected readonly status = signal<PageStatus>('loading');
  protected readonly goals = signal<GoalResponse[]>([]);
  /** null = sin editor; 'new' = crear; una meta = editarla. */
  protected readonly editor = signal<GoalResponse | 'new' | null>(null);
  protected readonly contributeTo = signal<GoalResponse | null>(null);
  protected readonly detail = signal<GoalDetailResponse | null>(null);
  protected readonly deleteTarget = signal<GoalResponse | null>(null);

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.status.set('loading');
    this.service.list().subscribe({
      next: (goals) => {
        this.goals.set(goals);
        this.status.set('success');
      },
      error: () => this.status.set('error'),
    });
  }

  protected editing(): GoalResponse | null {
    const editor = this.editor();
    return editor === 'new' ? null : editor;
  }

  protected date(value: string): string {
    return dateLabel(value, localeFor(this.i18n.language()));
  }

  /** Mes y año de la fecha estimada ("jun 2027"): es una estimación mensual, no un día exacto. */
  protected monthLabel(value: string): string {
    const [year, month] = value.split('-').map(Number);
    return new Intl.DateTimeFormat(localeFor(this.i18n.language()), { month: 'short', year: 'numeric', timeZone: 'UTC' })
      .format(new Date(Date.UTC(year, month - 1, 1)));
  }

  protected afterSave(): void {
    this.editor.set(null);
    this.contributeTo.set(null);
    this.load();
  }

  protected openDetail(goal: GoalResponse): void {
    this.service.get(goal.id).subscribe({
      next: (detail) => this.detail.set(detail),
      error: (error: HttpErrorResponse) => this.toast.httpError(error),
    });
  }

  protected deleteContribution(goal: GoalResponse, contribution: ContributionResponse): void {
    this.service.deleteContribution(goal.id, contribution.id).subscribe({
      next: () => {
        this.openDetail(goal);
        this.load();
      },
      error: (error: HttpErrorResponse) =>
        conflictErrorToast(this.toast, this.i18n, error, ['goal_saved_negative'], 'goals.conflict'),
    });
  }

  protected confirmDelete(): void {
    const target = this.deleteTarget();
    if (!target) {
      return;
    }
    this.service.delete(target.id).subscribe({
      next: () => {
        this.toast.success(this.i18n.translate('goals.toast.deleted', { name: target.name }));
        this.deleteTarget.set(null);
        this.load();
      },
      error: (error: HttpErrorResponse) => this.toast.httpError(error),
    });
  }
}
