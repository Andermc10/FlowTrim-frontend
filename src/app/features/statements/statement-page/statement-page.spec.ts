import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../../environments/environment';
import { StatementResponse } from '../statements.models';
import { StatementPage } from './statement-page';

const base = `${environment.apiUrl}/api/statements`;

/** EP-16 HU-78: cifras por moneda, comparación con el mes anterior, categorías y estados. "Hoy" = 2026-10-20. */
describe('StatementPage', () => {
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(Date.UTC(2026, 9, 20, 15, 0, 0)));
    TestBed.configureTestingModule({ imports: [StatementPage], providers: [provideHttpClient(), provideHttpClientTesting()] });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    vi.useRealTimers();
  });

  function render(response: StatementResponse | null) {
    const fixture = TestBed.createComponent(StatementPage);
    fixture.detectChanges();
    const request = httpMock.expectOne(`${base}?month=2026-10`);
    if (response) {
      request.flush(response);
    } else {
      request.flush({}, { status: 500, statusText: 'Server Error' });
    }
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    return { fixture, element, text: () => element.textContent!.replace(/\s+/g, ' ') };
  }

  it('shows income, expenses, net, savings rate, the change against September and top categories', () => {
    const page = render({
      month: '2026-10',
      previousMonth: '2026-09',
      currencies: [{
        currency: 'COP', income: 3000000, expense: 1800000, net: 1200000, savingsRate: 40, previousIncome: 2800000,
        previousExpense: 1500000, previousNet: 1300000, expenseChange: 20,
        topCategories: [{ categoryId: 'r', name: 'Rent', color: 'blue', icon: 'home', amount: 1200000, share: 66.7, previousAmount: 1200000 }],
      }],
    });

    const text = page.text();
    expect(text).toContain('Savings rate40 %');
    expect(text).toContain('You spent 20 % more than in September 2026.');
    expect(page.element.querySelector('.categories tbody tr')?.textContent?.replace(/\s+/g, ' ')).toContain('Rent');
    expect(text).toContain('66.7 %');
  });

  it('shows the empty notice, and a retry banner when the request fails', () => {
    const empty = render({ month: '2026-10', previousMonth: '2026-09', currencies: [] });
    expect(empty.element.querySelector('.notice')?.textContent).toContain('Nothing recorded this month.');

    empty.element.querySelector<HTMLButtonElement>('[aria-label="Next month"]')!.click();
    httpMock.expectOne(`${base}?month=2026-11`).flush({}, { status: 500, statusText: 'Server Error' });
    empty.fixture.detectChanges();
    expect(empty.element.querySelector('[role="alert"]')?.textContent).toContain('Could not load the statement.');
  });
});
