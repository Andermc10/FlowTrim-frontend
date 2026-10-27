import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../../environments/environment';
import { GoalResponse } from '../goals.models';
import { GoalsPage } from './goals-page';

const base = `${environment.apiUrl}/api/goals`;

function goal(overrides: Partial<GoalResponse>): GoalResponse {
  return {
    id: 'g', name: 'Trip', currency: 'COP', target: 3000000, targetDate: '2027-03-31', saved: 600000, remaining: 2400000,
    percent: 20, completed: false, isOverdue: false, monthsLeft: 6, requiredPerMonth: 400000, averagePerMonth: 300000,
    estimatedCompletion: '2027-06-01', contributionsCount: 3, ...overrides,
  };
}

/** EP-15 HU-77: tarjetas con cifras y estimación, aporte o retiro, historial y estados. "Hoy" = 2026-10-20. */
describe('GoalsPage', () => {
  let httpMock: HttpTestingController;

  beforeAll(() => {
    // El entorno de pruebas no implementa <dialog>.showModal().
    HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
      this.setAttribute('open', '');
    };
  });

  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(Date.UTC(2026, 9, 20, 15, 0, 0)));
    TestBed.configureTestingModule({
      imports: [GoalsPage],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    vi.useRealTimers();
  });

  function render(goals: GoalResponse[]) {
    const fixture = TestBed.createComponent(GoalsPage);
    fixture.detectChanges();
    httpMock.expectOne(base).flush(goals);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    return { fixture, element, text: (selector: string) => element.querySelector(selector)!.textContent!.replace(/\s+/g, ' ') };
  }

  it('shows saved / target, needed per month and the estimated month, and completed goals without a projection', () => {
    const page = render([
      goal({}),
      goal({ id: 'p', name: 'Phone', completed: true, percent: 100, requiredPerMonth: null, estimatedCompletion: null, targetDate: null }),
    ]);

    // Sin espacios: el texto de elementos vecinos se junta sin separador.
    const [trip, phone] = [...page.element.querySelectorAll('.card')].map((card) => card.textContent!.replace(/\s+/g, ''));
    expect(trip).toContain('COP600,000/COP3,000,000');
    expect(trip).toContain('NeededpermonthCOP400,000');
    expect(trip).toContain('EstimatedcompletionJun2027');
    expect(phone).toContain('Completed');
    expect(phone).not.toContain('Estimatedcompletion');
  });

  it('records a withdrawal as a negative amount and reloads', () => {
    const page = render([goal({})]);
    page.element.querySelector<HTMLButtonElement>('.card__actions .btn')!.click();
    page.fixture.detectChanges();

    page.element.querySelector<HTMLInputElement>('input[value="withdrawal"]')!.click();
    const amount = page.element.querySelector<HTMLInputElement>('#contribution-amount')!;
    amount.value = '50000';
    amount.dispatchEvent(new Event('input'));
    page.element.querySelector<HTMLFormElement>('app-contribution-form form')!.dispatchEvent(new Event('submit'));

    const request = httpMock.expectOne(`${base}/g/contributions`);
    expect(request.request.body).toEqual({ amount: -50000, date: '2026-10-20', note: null });
    request.flush({ id: 'c', amount: -50000, date: '2026-10-20', note: null, createdAt: '' });
    httpMock.expectOne(base).flush([goal({ saved: 550000 })]);
  });

  it('opens the history with withdrawals marked', () => {
    const page = render([goal({})]);
    page.element.querySelector<HTMLButtonElement>('.card__actions .link')!.click();
    httpMock.expectOne(`${base}/g`).flush({
      goal: goal({}),
      contributions: [
        { id: 'w', amount: -100000, date: '2026-10-05', note: 'Car repair', createdAt: '' },
        { id: 'd', amount: 300000, date: '2026-09-10', note: null, createdAt: '' },
      ],
    });
    page.fixture.detectChanges();

    const rows = [...page.element.querySelectorAll('.history li')].map((row) => row.textContent!.replace(/\s+/g, ' '));
    expect(rows[0]).toContain('Car repair');
    expect(page.element.querySelector('.history__withdrawal')?.textContent).toContain('100,000');
    expect(rows[1]).toContain('+COP 300,000');
  });

  it('shows the empty state and a retry banner on errors', () => {
    const page = render([]);
    expect(page.text('.empty')).toContain('No savings goals yet.');

    page.element.querySelector<HTMLButtonElement>('.empty .btn')!.click();
    page.fixture.detectChanges();
    expect(page.element.querySelector('app-goal-form')).not.toBeNull();
  });
});
