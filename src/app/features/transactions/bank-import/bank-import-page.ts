import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, ElementRef, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Subscription, catchError, forkJoin, of } from 'rxjs';

import { BankImportChoices, BankImportConfirmation, BankImportPreview, BankImportRow } from './bank-import.models';
import { BankImportService } from './bank-import-service';
import { AccountsService } from '../../accounts/accounts-service';
import { AccountResponse } from '../../accounts/accounts.models';
import { CategoriesService } from '../../categories/categories-service';
import { CategoryResponse } from '../../categories/categories.models';
import { ImportError } from '../../imports/imports.models';
import { preCheckFile } from '../../imports/import-file';
import { correlationReference } from '../../../core/http-error.interceptor';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { MoneyPipe } from '../../../core/format/money.pipe';
import { ToastService } from '../../../core/ui/toast/toast.service';

type ImportAction = 'preview' | 'confirm';

/** Estados de la pantalla; cada uno lleva solo los datos que puede mostrar (igual que HU-46). */
type BankImportState =
  | { kind: 'idle' }
  | { kind: 'previewing' }
  | { kind: 'preview'; preview: BankImportPreview }
  | { kind: 'confirming'; preview: BankImportPreview }
  | { kind: 'done'; result: BankImportConfirmation; expected: number }
  | { kind: 'fileError'; code: string; detail: string | null }
  | { kind: 'choiceError'; fields: string[] }
  | { kind: 'serverError'; action: ImportAction; network: boolean; reference: string | null; preview: BankImportPreview | null };

/**
 * Importación del CSV del banco (EP-16 HU-79): elegir la cuenta y las categorías por defecto, revisar cada fila sin
 * guardar nada y confirmar reenviando lo mismo. Todo texto del archivo se muestra por interpolación, nunca como HTML.
 */
@Component({
  selector: 'app-bank-import-page',
  imports: [RouterLink, TranslatePipe, MoneyPipe],
  templateUrl: './bank-import-page.html',
  styleUrls: ['../../imports/import-page/import-page.scss', './bank-import-page.scss'],
})
export class BankImportPage implements OnInit {
  private readonly service = inject(BankImportService);
  private readonly accountsService = inject(AccountsService);
  private readonly categoriesService = inject(CategoriesService);
  private readonly toast = inject(ToastService);
  protected readonly i18n = inject(I18nService);

  protected readonly state = signal<BankImportState>({ kind: 'idle' });
  protected readonly fileName = signal<string | null>(null);
  protected readonly accounts = signal<AccountResponse[]>([]);
  private readonly categories = signal<CategoryResponse[]>([]);
  protected readonly choices = signal<BankImportChoices>({ accountId: '', expenseCategoryId: '', incomeCategoryId: '' });
  protected readonly expenseCategories = computed(() => this.categories().filter((c) => c.kind === 'Expense'));
  protected readonly incomeCategories = computed(() => this.categories().filter((c) => c.kind === 'Income'));
  protected readonly ready = computed(() => {
    const choices = this.choices();
    return !!(choices.accountId && choices.expenseCategoryId && choices.incomeCategoryId);
  });
  protected readonly currency = computed(() => this.accounts().find((a) => a.id === this.choices().accountId)?.currency ?? 'COP');

  private readonly picker = viewChild.required<ElementRef<HTMLInputElement>>('picker');
  private file: File | null = null;
  private request?: Subscription;

  constructor() {
    // Salir de la página cancela la petición en curso.
    inject(DestroyRef).onDestroy(() => this.request?.unsubscribe());
  }

  ngOnInit(): void {
    forkJoin({
      accounts: this.accountsService.list().pipe(catchError(() => of([] as AccountResponse[]))),
      categories: this.categoriesService.list().pipe(catchError(() => of([] as CategoryResponse[]))),
    }).subscribe(({ accounts, categories }) => {
      const activeAccounts = accounts.filter((a) => !a.isArchived);
      const activeCategories = categories.filter((c) => !c.isArchived);
      this.accounts.set(activeAccounts);
      this.categories.set(activeCategories);
      // "Other"/"Otros" de gastos y el primer ingreso como valores por defecto razonables; el usuario puede cambiarlos.
      const expense = activeCategories.filter((c) => c.kind === 'Expense');
      const income = activeCategories.filter((c) => c.kind === 'Income');
      this.choices.set({
        accountId: activeAccounts[0]?.id ?? '',
        expenseCategoryId: (expense.find((c) => c.icon === 'other') ?? expense[0])?.id ?? '',
        incomeCategoryId: (income.find((c) => c.icon === 'other') ?? income[0])?.id ?? '',
      });
    });
  }

  protected isBusy(): boolean {
    const kind = this.state().kind;
    return kind === 'previewing' || kind === 'confirming';
  }

  /** Cambiar una elección con un archivo ya elegido vuelve a validar (las categorías cambian el resultado). */
  protected choose(field: keyof BankImportChoices, value: string): void {
    this.choices.update((current) => ({ ...current, [field]: value }));
    if (this.file && this.state().kind !== 'done') {
      this.runPreview();
    }
  }

  protected onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    // Se limpia el input para que elegir de nuevo el mismo archivo (ya corregido) vuelva a disparar el evento.
    input.value = '';
    if (!file) {
      return;
    }

    this.request?.unsubscribe();
    this.file = file;
    this.fileName.set(file.name);
    const code = preCheckFile(file);
    if (code) {
      this.state.set({ kind: 'fileError', code, detail: null });
      return;
    }
    this.runPreview();
  }

  protected chooseFile(): void {
    this.picker().nativeElement.click();
  }

  protected confirm(): void {
    const current = this.state();
    if (current.kind !== 'preview' || current.preview.summary.valid === 0 || !this.file) {
      return;
    }

    const preview = current.preview;
    this.state.set({ kind: 'confirming', preview });
    this.request = this.service.confirm(this.file, this.choices()).subscribe({
      next: (result) => {
        this.state.set({ kind: 'done', result, expected: preview.summary.valid });
        this.toast.success(this.i18n.translate('bankImport.toastCreated', { count: result.created }));
      },
      error: (error: HttpErrorResponse) => this.showError(error, 'confirm', preview),
    });
  }

  protected retry(): void {
    const current = this.state();
    if (current.kind === 'serverError' && current.action === 'confirm' && current.preview) {
      this.state.set({ kind: 'preview', preview: current.preview });
      this.confirm();
    } else {
      this.runPreview();
    }
  }

  protected reset(): void {
    this.request?.unsubscribe();
    this.file = null;
    this.fileName.set(null);
    this.state.set({ kind: 'idle' });
  }

  protected fileErrorMessage(code: string, detail: string | null): string {
    return this.translateOr(`imports.fileError.${code}`, detail ?? this.i18n.translate('imports.fileError.generic'));
  }

  protected rowErrorMessage(error: ImportError): string {
    return this.translateOr(`imports.rowError.${error.code}`, error.message);
  }

  protected duplicateReason(row: BankImportRow): string {
    return row.duplicateOf === 'file'
      ? this.i18n.translate('imports.duplicate.file', { row: row.duplicateOfRow ?? '?' })
      : this.i18n.translate('bankImport.duplicateExisting');
  }

  private runPreview(): void {
    const file = this.file;
    if (!file || !this.ready()) {
      return;
    }

    this.request?.unsubscribe();
    this.state.set({ kind: 'previewing' });
    this.request = this.service.preview(file, this.choices()).subscribe({
      next: (preview) => this.state.set({ kind: 'preview', preview }),
      error: (error: HttpErrorResponse) => this.showError(error, 'preview', null),
    });
  }

  private showError(error: HttpErrorResponse, action: ImportAction, preview: BankImportPreview | null): void {
    const code = typeof error.error?.code === 'string' ? error.error.code : null;
    const fields = error.error?.errors ? Object.keys(error.error.errors as object) : [];
    if (error.status === 400 && !code && fields.length > 0) {
      // Cuenta o categorías inválidas (p. ej. archivadas entre la vista previa y la confirmación).
      this.state.set({ kind: 'choiceError', fields });
      return;
    }
    if (error.status === 400 || error.status === 413) {
      const detail = typeof error.error?.detail === 'string' ? error.error.detail : null;
      this.state.set({ kind: 'fileError', code: code ?? (error.status === 413 ? 'file_too_large' : 'generic'), detail });
      return;
    }
    if (error.status === 401) {
      this.state.set(preview ? { kind: 'preview', preview } : { kind: 'idle' });
      return;
    }
    this.state.set({ kind: 'serverError', action, network: error.status === 0, reference: correlationReference(error), preview });
  }

  private translateOr(key: string, fallback: string): string {
    const text = this.i18n.translate(key);
    return text === key ? fallback : text;
  }
}
