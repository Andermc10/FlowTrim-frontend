import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * Validadores de formulario compartidos (HU-55, HU-56). Replican las reglas del backend para dar respuesta inmediata;
 * la API sigue siendo la autoridad. Las fechas son textos `yyyy-MM-dd`, comparables como cadenas.
 */
export const FormValidators = {
  /** Obligatorio y con algo más que espacios (la API recorta el texto). */
  requiredText: ((control: AbstractControl): ValidationErrors | null =>
    typeof control.value === 'string' && control.value.trim().length > 0 ? null : { required: true }) as ValidatorFn,

  /** Como mucho `digits` decimales (los importes se guardan con 2). */
  maxDecimals(digits: number): ValidatorFn {
    return (control) => {
      const value = control.value;
      if (value === null || value === undefined || value === '') {
        return null;
      }
      const decimals = String(value).split('.')[1]?.length ?? 0;
      return decimals > digits ? { maxDecimals: { digits } } : null;
    };
  },

  /** Código ISO 4217 con formato de 3 letras (no se valida contra la lista real, igual que la API). */
  currencyCode: ((control: AbstractControl): ValidationErrors | null =>
    /^[A-Za-z]{3}$/.test(String(control.value ?? '').trim()) ? null : { currencyCode: true }) as ValidatorFn,

  /** Número entero (sin decimales). */
  integer: ((control: AbstractControl): ValidationErrors | null => {
    const value = control.value;
    return value === null || value === undefined || value === '' || Number.isInteger(Number(value)) ? null : { integer: true };
  }) as ValidatorFn,

  /**
   * Fecha no anterior a `min()`. Si `unchanged()` devuelve un valor y coincide con el del control, se acepta: editar
   * sin tocar una fecha ya vencida no obliga a moverla (HU-56).
   */
  notBefore(min: () => string, unchanged: () => string | null = () => null): ValidatorFn {
    return (control) => {
      const value = control.value as string | null;
      if (!value || value === unchanged()) {
        return null;
      }
      return value < min() ? { notBefore: { min: min() } } : null;
    };
  },

  /** Fecha no posterior a `max()` (un uso declarado no puede ser futuro). */
  notAfter(max: () => string): ValidatorFn {
    return (control) => {
      const value = control.value as string | null;
      return value && value > max() ? { notAfter: { max: max() } } : null;
    };
  },
};

/** Regla de validación y la clave de traducción de su mensaje, en el orden en que se muestran. */
export type ErrorMessages = readonly (readonly [error: string, messageKey: string])[];

/**
 * Clave del mensaje a mostrar para un control: el de la primera regla incumplida, solo cuando el usuario ya
 * interactuó con el campo (dirty o touched). Así el error aparece mientras escribe o al salir, sin pulsar Guardar.
 */
export function visibleErrorKey(control: AbstractControl, messages: ErrorMessages): string | null {
  if (control.valid || !(control.dirty || control.touched)) {
    return null;
  }
  return messages.find(([error]) => control.hasError(error))?.[1] ?? null;
}
