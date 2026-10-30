import { capitalizeFirst, monthName, monthTitle } from './money';

describe('month labels', () => {
  it('capitalizes only the first letter of a Spanish month title', () => {
    expect(monthTitle('2026-10', 'es-CO')).toBe('Octubre de 2026');
  });

  it('keeps the Spanish month in lowercase inside a sentence', () => {
    expect(monthName('2026-09', 'es-CO')).toBe('septiembre de 2026');
  });

  it('leaves English titles unchanged', () => {
    expect(monthTitle('2026-10', 'en-US')).toBe('October 2026');
  });

  it('does not change the rest of a day label', () => {
    expect(capitalizeFirst('jueves, 29 de octubre', 'es-CO')).toBe('Jueves, 29 de octubre');
  });
});
