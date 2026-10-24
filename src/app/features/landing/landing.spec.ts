import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { I18nService } from '../../core/i18n/i18n.service';
import { Landing } from './landing';
import { LandingMotionService } from './landing-motion.service';
import { landingSample } from './landing-sample';

/** HU-69: el landing está completo sin animaciones, en los dos idiomas, y sus cifras de ejemplo cuadran. */
describe('Landing', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [Landing],
      // Sin capa de movimiento: estas pruebas verifican la página estática (la capa tiene sus propias pruebas).
      providers: [provideRouter([]), { provide: LandingMotionService, useValue: { start: () => new Promise(() => undefined) } }],
    });
  });

  function render() {
    const fixture = TestBed.createComponent(Landing);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    return { fixture, element, text: () => element.textContent!.replace(/\s+/g, ' ') };
  }

  it('renders every section, one h1 and the workspace CTAs without any motion layer', () => {
    const page = render();

    expect(page.element.querySelectorAll('h1')).toHaveLength(1);
    for (const id of ['how-it-works', 'subscriptions', 'formula']) {
      expect(page.element.querySelector(`#${id}`)).not.toBeNull();
    }
    expect(page.element.querySelectorAll('.story-step')).toHaveLength(4);
    expect(page.element.querySelectorAll('.feature')).toHaveLength(9);
    expect(page.element.querySelectorAll('a[href="/app"]').length).toBeGreaterThanOrEqual(3);
    expect(page.element.querySelector('.skip-link')!.getAttribute('href')).toBe('#content');
  });

  it('labels every group of sample figures and announces each mock-up as one illustration', () => {
    const page = render();

    expect(page.element.querySelectorAll('.sample-tag').length).toBeGreaterThanOrEqual(3);
    const mocks = [...page.element.querySelectorAll('.mock')];
    expect(mocks.length).toBe(5);
    for (const mock of mocks) {
      expect(mock.getAttribute('role')).toBe('img');
      expect(mock.getAttribute('aria-label')).toMatch(/^Illustration:/);
      expect(mock.firstElementChild!.getAttribute('aria-hidden')).toBe('true');
    }
  });

  it('switches to Spanish without a reload', () => {
    const page = render();

    TestBed.inject(I18nService).toggleLanguage();
    page.fixture.detectChanges();

    expect(page.element.querySelector('h1')!.textContent).toBe('Sabe cuánto puedes gastar hoy.');
    expect(page.text()).toContain('Datos de ejemplo');
  });

  it('uses sample figures that satisfy the app formulas exactly', () => {
    // AC-3 de HU-69: (1.175.000 − 38.900) ÷ 10 = 113.610.
    expect(landingSample.available).toBe(1175000);
    expect(landingSample.committed).toBe(38900);
    expect(landingSample.safeToSpend).toBe(113610);
    expect((landingSample.available - landingSample.committed) / landingSample.daysLeft).toBe(landingSample.safeToSpend);
    expect(landingSample.owedOnCards).toBe(300000);
    // Simulador: ahorro = equivalente mensual × meses.
    expect(landingSample.savings.map((saving) => saving.amount)).toEqual([90000, 1080000, 2160000]);
    expect(landingSample.monthlyBurn).toBe(145800);
  });

  it('shows the sample numbers in the hero with the money format', () => {
    const page = render();

    expect(page.element.querySelector('.hero .mock__big')!.textContent!.replace(/\s+/g, ' ')).toContain('COP 113,610');
  });
});
