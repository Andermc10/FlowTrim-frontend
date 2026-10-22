import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  DestroyRef,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';

import { saveFile } from '../../../core/files/save-file';
import { correlationReference } from '../../../core/http-error.interceptor';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { MoneyPipe } from '../../../core/format/money.pipe';
import { ToastService } from '../../../core/ui/toast/toast.service';
import { buildImportTemplate, importTemplateFileName, preCheckFile } from '../import-file';
import { productToday } from '../../../core/format/product-calendar';
import {
  ImportError,
  ImportRow,
  SubscriptionImportConfirmation,
  SubscriptionImportPreview,
} from '../imports.models';
import { ImportsService } from '../imports-service';

type ImportAction = 'preview' | 'confirm';

/** Estados de la pantalla; cada uno lleva solo los datos que puede mostrar. */
export type ImportState =
  | { kind: 'idle' }
  | { kind: 'previewing' }
  | { kind: 'preview'; preview: SubscriptionImportPreview }
  | { kind: 'confirming'; preview: SubscriptionImportPreview }
  | { kind: 'done'; result: SubscriptionImportConfirmation; expected: number }
  | { kind: 'fileError'; code: string; detail: string | null }
  | {
      kind: 'serverError';
      action: ImportAction;
      network: boolean;
      reference: string | null;
      preview: SubscriptionImportPreview | null;
    };

/**
 * Pantalla de importación CSV (HU-46): elegir archivo, revisar cada fila sin guardar nada y confirmar. La
 * confirmación reenvía el mismo archivo (D4). Todo texto del archivo se muestra por interpolación, nunca como HTML.
 */
@Component({
  selector: 'app-import-page',
  imports: [RouterLink, TranslatePipe, MoneyPipe],
  templateUrl: './import-page.html',
  styleUrl: './import-page.scss',
})
export class ImportPage {
  private readonly imports = inject(ImportsService);
  private readonly toast = inject(ToastService);
  protected readonly i18n = inject(I18nService);

  protected readonly state = signal<ImportState>({ kind: 'idle' });
  protected readonly fileName = signal<string | null>(null);

  private readonly picker = viewChild.required<ElementRef<HTMLInputElement>>('picker');
  private file: File | null = null;
  private request?: Subscription;

  constructor() {
    // Salir de la página cancela la petición en curso.
    inject(DestroyRef).onDestroy(() => this.request?.unsubscribe());
  }

  protected isBusy(): boolean {
    const kind = this.state().kind;
    return kind === 'previewing' || kind === 'confirming';
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
    this.request = this.imports.confirm(this.file).subscribe({
      next: (result) => {
        this.state.set({ kind: 'done', result, expected: preview.summary.valid });
        this.toast.success(this.i18n.translate('imports.toastCreated', { count: result.created }));
      },
      error: (error: HttpErrorResponse) => this.showError(error, 'confirm', preview),
    });
  }

  protected retry(): void {
    const current = this.state();
    if (current.kind !== 'serverError') {
      return;
    }
    if (current.action === 'confirm' && current.preview) {
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

  protected downloadTemplate(): void {
    // BOM de UTF-8 como en el export: Excel muestra bien tildes y eñes.
    saveFile({
      blob: new Blob(['\uFEFF', buildImportTemplate(productToday())], { type: 'text/csv;charset=utf-8' }),
      fileName: importTemplateFileName,
    });
  }

  protected fileErrorMessage(code: string, detail: string | null): string {
    return this.translateOr(
      `imports.fileError.${code}`,
      detail ?? this.i18n.translate('imports.fileError.generic'),
    );
  }

  protected rowErrorMessage(error: ImportError): string {
    return this.translateOr(`imports.rowError.${error.code}`, error.message);
  }

  protected duplicateReason(row: ImportRow): string {
    return row.duplicateOf === 'file'
      ? this.i18n.translate('imports.duplicate.file', { row: row.duplicateOfRow ?? '?' })
      : this.i18n.translate('imports.duplicate.existing');
  }

  private runPreview(): void {
    const file = this.file;
    if (!file) {
      return;
    }

    this.request?.unsubscribe();
    this.state.set({ kind: 'previewing' });
    this.request = this.imports.preview(file).subscribe({
      next: (preview) => this.state.set({ kind: 'preview', preview }),
      error: (error: HttpErrorResponse) => this.showError(error, 'preview', null),
    });
  }

  private showError(
    error: HttpErrorResponse,
    action: ImportAction,
    preview: SubscriptionImportPreview | null,
  ): void {
    const code = typeof error.error?.code === 'string' ? error.error.code : null;
    if (error.status === 400 || error.status === 413) {
      // Un 413 del límite del cuerpo llega sin código: para el usuario es el mismo caso que un archivo muy grande.
      const detail = typeof error.error?.detail === 'string' ? error.error.detail : null;
      this.state.set({
        kind: 'fileError',
        code: code ?? (error.status === 413 ? 'file_too_large' : 'generic'),
        detail,
      });
      return;
    }
    if (error.status === 401) {
      // El interceptor de autenticación ya cerró la sesión; se vuelve al último estado estable.
      this.state.set(preview ? { kind: 'preview', preview } : { kind: 'idle' });
      return;
    }
    this.state.set({
      kind: 'serverError',
      action,
      network: error.status === 0,
      reference: correlationReference(error),
      preview,
    });
  }

  private translateOr(key: string, fallback: string): string {
    const text = this.i18n.translate(key);
    return text === key ? fallback : text;
  }
}
