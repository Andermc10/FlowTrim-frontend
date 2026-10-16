import { AfterViewInit, Component, ElementRef, EventEmitter, Input, Output, ViewChild } from '@angular/core';

@Component({
  selector: 'app-modal',
  template: `
    <dialog #dialog class="modal" (cancel)="handleCancel($event)" (click)="handleBackdropClick($event)">
      <div class="modal__panel" (click)="$event.stopPropagation()">
        <header class="modal__header">
          <h2>{{ title }}</h2>
          <button class="modal__close" type="button" aria-label="Close dialog" (click)="requestClose()">×</button>
        </header>
        <div class="modal__body"><ng-content /></div>
      </div>
    </dialog>
  `,
  styles: `
    .modal { width: min(100% - 2rem, 42rem); max-height: calc(100dvh - 2rem); padding: 0; border: 1px solid var(--color-border-strong); border-radius: 1rem; background: var(--color-surface); color: var(--color-text); box-shadow: 0 2rem 6rem var(--color-shadow); }
    .modal::backdrop { background: rgba(3, 8, 10, 0.72); backdrop-filter: blur(5px); }
    .modal__panel { max-height: calc(100dvh - 2rem); overflow: auto; }
    .modal__header { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 1.1rem 1.25rem; border-bottom: 1px solid var(--color-border); }
    .modal__header h2 { margin: 0; font-size: 1rem; letter-spacing: -.03em; }
    .modal__close { display: grid; place-items: center; width: 2rem; height: 2rem; padding: 0; border: 1px solid var(--color-border); border-radius: .55rem; background: transparent; color: var(--color-muted); cursor: pointer; font-size: 1.35rem; line-height: 1; }
    .modal__close:hover { border-color: var(--color-primary); color: var(--color-primary); }
    .modal__body { padding: 1.25rem; }
  `,
})
export class Modal implements AfterViewInit {
  @Input() title = '';
  @Output() closeRequested = new EventEmitter<void>();
  @ViewChild('dialog', { static: true }) private readonly dialog!: ElementRef<HTMLDialogElement>;

  ngAfterViewInit(): void {
    this.dialog.nativeElement.showModal();
  }

  protected requestClose(): void {
    this.closeRequested.emit();
  }

  protected handleCancel(event: Event): void {
    event.preventDefault();
    this.requestClose();
  }

  protected handleBackdropClick(event: MouseEvent): void {
    if (event.target === this.dialog.nativeElement) {
      this.requestClose();
    }
  }
}
