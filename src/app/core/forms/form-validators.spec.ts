import { FormControl, Validators } from '@angular/forms';

import { productToday } from '../format/product-calendar';
import { FormValidators, visibleErrorKey } from './form-validators';

describe('FormValidators', () => {
  it('requiredText rejects empty and whitespace-only text', () => {
    expect(FormValidators.requiredText(new FormControl('   '))).toEqual({ required: true });
    expect(FormValidators.requiredText(new FormControl(''))).toEqual({ required: true });
    expect(FormValidators.requiredText(new FormControl(' Netflix '))).toBeNull();
  });

  it('maxDecimals allows up to the given decimals and ignores empty values', () => {
    const twoDecimals = FormValidators.maxDecimals(2);

    expect(twoDecimals(new FormControl(16.99))).toBeNull();
    expect(twoDecimals(new FormControl(38900))).toBeNull();
    expect(twoDecimals(new FormControl(10.123))).toEqual({ maxDecimals: { digits: 2 } });
    expect(twoDecimals(new FormControl(null))).toBeNull();
  });

  it('httpsUrl accepts empty or safe https links only (EP-14 D9)', () => {
    const link = FormValidators.httpsUrl(500);

    expect(link(new FormControl(''))).toBeNull();
    expect(link(new FormControl(' https://pay.example.com/bill?id=1 '))).toBeNull();
    for (const unsafe of ['javascript:alert(1)', 'http://example.com', 'https://user:pass@example.com', 'https://user@example.com', 'example.com']) {
      expect(link(new FormControl(unsafe))).toEqual({ httpsUrl: true });
    }
    expect(link(new FormControl(`https://example.com/${'a'.repeat(500)}`))).toEqual({ httpsUrl: true });
  });

  it('currencyCode accepts exactly three letters', () => {
    expect(FormValidators.currencyCode(new FormControl('cop'))).toBeNull();
    expect(FormValidators.currencyCode(new FormControl('CO'))).toEqual({ currencyCode: true });
    expect(FormValidators.currencyCode(new FormControl('C0P'))).toEqual({ currencyCode: true });
  });

  it('integer rejects fractions', () => {
    expect(FormValidators.integer(new FormControl(3))).toBeNull();
    expect(FormValidators.integer(new FormControl(2.5))).toEqual({ integer: true });
  });

  it('notBefore rejects earlier dates unless the value is the unchanged original', () => {
    let original: string | null = null;
    const validator = FormValidators.notBefore(() => '2026-10-20', () => original);

    expect(validator(new FormControl('2026-10-19'))).toEqual({ notBefore: { min: '2026-10-20' } });
    expect(validator(new FormControl('2026-10-20'))).toBeNull();

    original = '2026-10-01';
    expect(validator(new FormControl('2026-10-01'))).toBeNull();
    expect(validator(new FormControl('2026-10-05'))).toEqual({ notBefore: { min: '2026-10-20' } });
  });

  it('notAfter rejects later dates', () => {
    const validator = FormValidators.notAfter(() => '2026-10-20');

    expect(validator(new FormControl('2026-10-21'))).toEqual({ notAfter: { max: '2026-10-20' } });
    expect(validator(new FormControl('2026-10-20'))).toBeNull();
  });
});

describe('visibleErrorKey', () => {
  const messages = [['required', 'form.amountRequired'], ['min', 'form.amountPositive']] as const;

  it('shows nothing until the user touched or changed the field, then the first failing rule', () => {
    const control = new FormControl<number | null>(null, [Validators.required, Validators.min(0.01)]);
    expect(visibleErrorKey(control, messages)).toBeNull();

    control.markAsTouched();
    expect(visibleErrorKey(control, messages)).toBe('form.amountRequired');

    control.setValue(-5);
    expect(visibleErrorKey(control, messages)).toBe('form.amountPositive');

    control.setValue(10);
    expect(visibleErrorKey(control, messages)).toBeNull();
  });
});

describe('productToday', () => {
  it('uses the Bogota day, not the UTC day', () => {
    // 2026-10-21 03:00 UTC son las 22:00 del 20 en Bogotá.
    expect(productToday(new Date(Date.UTC(2026, 9, 21, 3, 0, 0)))).toBe('2026-10-20');
    expect(productToday(new Date(Date.UTC(2026, 9, 21, 5, 0, 0)))).toBe('2026-10-21');
  });
});
