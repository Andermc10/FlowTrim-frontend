import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../../environments/environment';
import { CalendarDay, CalendarResponse } from '../calendar.models';
import { CalendarPage } from './calendar-page';

const base = `${environment.apiUrl}/api/calendar`;

function month(days: Record<number, Partial<CalendarDay>>): CalendarResponse {
  return {
    month: '2026-10',
    today: '2026-10-20',
    days: Array.from({ length: 31 }, (_, index) => ({
      date: `2026-10-${String(index + 1).padStart(2, '0')}`,
      expected: [],
      recorded: [],
      ...days[index + 1],
    })),
    totals: [{ currency: 'COP', expected: 48900, recordedIncome: 0, recordedExpense: 25000 }],
  };
}

/** EP-14 HU-75: cuadrícula del mes, panel del día, navegación de meses y estados. "Hoy" = 2026-10-20. */
describe('CalendarPage', () => {
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
      imports: [CalendarPage],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    vi.useRealTimers();
  });

  function render(response: CalendarResponse) {
    const fixture = TestBed.createComponent(CalendarPage);
    fixture.detectChanges();
    httpMock.expectOne(`${base}?month=2026-10`).flush(response);
    fixture.detectChanges();
    return { fixture, element: fixture.nativeElement as HTMLElement };
  }

  it('lays out October from Thursday the 1st, marks today and opens it in the panel', () => {
    const page = render(month({
      3: { expected: [{ subscriptionId: 'g', name: 'Gym', kind: 'Subscription', amount: 10000, currency: 'COP', isOverdue: true, paymentUrl: null }] },
      20: { recorded: [{ currency: 'COP', income: 0, expense: 25000 }] },
      28: { expected: [{ subscriptionId: 'n', name: 'Netflix', kind: 'Subscription', amount: 38900, currency: 'COP', isOverdue: false, paymentUrl: 'https://pay.example.com' }] },
    }));

    // 1 de octubre de 2026 es jueves: tres huecos (lunes a miércoles) antes del día 1.
    expect(page.element.querySelectorAll('.grid .cell--blank').length).toBe(3);
    expect(page.element.querySelector('.cell--today .cell__number')?.textContent?.trim()).toBe('20');
    expect(page.element.querySelector('.cell--overdue .cell__number')?.textContent?.trim()).toBe('3');
    expect(page.element.querySelector('.panel .recorded')?.textContent).toContain('25,000');

    page.element.querySelectorAll<HTMLButtonElement>('.grid .cell:not(.cell--blank)')[27].click();
    page.fixture.detectChanges();

    const panel = page.element.querySelector('.panel')!;
    expect(panel.textContent).toContain('Netflix');
    expect(panel.querySelector<HTMLAnchorElement>('.pay-link')?.href).toBe('https://pay.example.com/');
    expect(page.element.querySelectorAll('.day-list__item').length).toBe(3);
  });

  it('opens the mark-as-paid dialog from a charge and reloads the month afterwards', () => {
    const page = render(month({
      20: { expected: [{ subscriptionId: 'g', name: 'Gym', kind: 'Subscription', amount: 10000, currency: 'COP', isOverdue: false, paymentUrl: null }] },
    }));

    page.element.querySelector<HTMLButtonElement>('.panel .charge .btn')!.click();
    page.fixture.detectChanges();

    expect(page.element.querySelector('app-mark-paid-dialog')).not.toBeNull();
    httpMock.match(() => true).forEach((request) => request.flush([]));
  });

  it('moves between months and shows an empty notice and a retry on errors', () => {
    const page = render(month({}));
    expect(page.element.querySelector('.notice')?.textContent).toContain('Nothing expected or recorded this month.');

    page.element.querySelector<HTMLButtonElement>('[aria-label="Next month"]')!.click();
    httpMock.expectOne(`${base}?month=2026-11`).flush({ title: 'boom' }, { status: 500, statusText: 'Server Error' });
    page.fixture.detectChanges();

    expect(page.element.querySelector('[role="alert"]')?.textContent).toContain('Could not load the calendar.');
  });
});
