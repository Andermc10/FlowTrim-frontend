import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';

import { CategoryKind, CategoryResponse, categoryKinds } from '../categories.models';
import { CategoriesService } from '../categories-service';
import { CategoryForm, categoryConflictCodes } from '../category-form/category-form';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { CategoryIcon } from '../../../core/ui/icon/category-icon';
import { Icon } from '../../../core/ui/icon/icon';
import { Modal } from '../../../core/ui/modal/modal';
import { conflictErrorToast } from '../../../core/ui/toast/conflict-toast';
import { ToastService } from '../../../core/ui/toast/toast.service';

type PageStatus = 'loading' | 'success' | 'error';

/**
 * Categorías personales (HU-65): dos grupos (gastos e ingresos) con color e ícono, crear, editar, archivar/restaurar y
 * borrar. La primera visita de un usuario sin categorías recibe el set por defecto desde la API. Una categoría usada no
 * se borra: el diálogo ofrece archivarla.
 */
@Component({
  selector: 'app-categories-page',
  imports: [NgTemplateOutlet, TranslatePipe, Icon, CategoryIcon, Modal, CategoryForm],
  templateUrl: './categories-page.html',
  styleUrl: './categories-page.scss',
})
export class CategoriesPage implements OnInit {
  private readonly service = inject(CategoriesService);
  private readonly toast = inject(ToastService);
  protected readonly i18n = inject(I18nService);

  protected readonly status = signal<PageStatus>('loading');
  protected readonly categories = signal<CategoryResponse[]>([]);
  protected readonly kinds = categoryKinds;
  protected readonly editorOpen = signal(false);
  protected readonly editing = signal<CategoryResponse | null>(null);
  protected readonly editorKind = signal<CategoryKind>('Expense');
  protected readonly editorDirty = signal(false);
  protected readonly discardConfirmation = signal(false);
  protected readonly deleteTarget = signal<CategoryResponse | null>(null);
  protected readonly busyId = signal<string | null>(null);

  protected readonly archived = computed(() => this.categories().filter((category) => category.isArchived));

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.status.set('loading');
    this.service.list({ includeArchived: true }).subscribe({
      next: (categories) => {
        this.categories.set(categories);
        this.status.set('success');
      },
      error: () => this.status.set('error'),
    });
  }

  /** Categorías activas de una clase, en el orden de la API (por nombre). */
  protected activeOf(kind: CategoryKind): CategoryResponse[] {
    return this.categories().filter((category) => category.kind === kind && !category.isArchived);
  }

  protected openCreate(kind: CategoryKind): void {
    this.editing.set(null);
    this.editorKind.set(kind);
    this.editorDirty.set(false);
    this.editorOpen.set(true);
  }

  protected openEdit(category: CategoryResponse): void {
    this.editing.set(category);
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
  protected setArchived(category: CategoryResponse, isArchived: boolean): void {
    this.busyId.set(category.id);
    this.service
      .update(category.id, { name: category.name, kind: category.kind, color: category.color, icon: category.icon, isArchived })
      .subscribe({
        next: () => {
          this.busyId.set(null);
          this.deleteTarget.set(null);
          this.toast.success(this.i18n.translate(isArchived ? 'toast.categoryArchived' : 'toast.categoryRestored', { name: category.name }));
          this.load();
        },
        error: (error: HttpErrorResponse) => {
          this.busyId.set(null);
          conflictErrorToast(this.toast, this.i18n, error, categoryConflictCodes, 'categories.error');
        },
      });
  }

  protected openDelete(category: CategoryResponse): void {
    this.deleteTarget.set(category);
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
        this.toast.success(this.i18n.translate('toast.categoryDeleted', { name: target.name }));
        this.load();
      },
      error: (error: HttpErrorResponse) => {
        // 409: un movimiento la empezó a usar mientras el diálogo estaba abierto; la recarga ofrece archivarla.
        this.busyId.set(null);
        this.closeDelete();
        conflictErrorToast(this.toast, this.i18n, error, categoryConflictCodes, 'categories.error');
        this.load();
      },
    });
  }
}
