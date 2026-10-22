import { Component, input } from '@angular/core';

import { TranslatePipe } from '../i18n/translate.pipe';

/**
 * Mensajes de error de un campo: el de la validación en vivo (clave de traducción) y los que devolvió la API para ese
 * campo. El contenedor tiene el `id` que el campo referencia con `aria-describedby` y anuncia los cambios.
 */
@Component({
  selector: 'app-field-error',
  imports: [TranslatePipe],
  template: `
    <div class="field-error" [id]="id()" aria-live="polite">
      @if (messageKey(); as key) {
        <small class="error">{{ key | translate }}</small>
      }
      @for (message of serverMessages(); track message) {
        <small class="error">{{ message }}</small>
      }
    </div>
  `,
  styles: `
    .field-error { display: grid; gap: 0.2rem; }
    .field-error:empty { display: none; }
  `,
})
export class FieldError {
  readonly id = input.required<string>();
  readonly messageKey = input<string | null>(null);
  readonly serverMessages = input<readonly string[]>([]);
}
