import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../../environments/environment';
import { BudgetResponse } from '../budgets.models';
import { BudgetsPage } from './budgets-page';

const base = `${environment.apiUrl}/api/budgets`;

function budget(overrides: Partial<BudgetResponse>): BudgetResponse {
  return {
    id: 'b', categoryId: 'food', categoryName: 'Food', categoryColor: 'orange', categoryIcon: 'food', categoryArchived: false,
    currency: 'COP', limit: 400000, spent: 250000, remaining: 150000, over: 0, percent: 62.5, state: 'OnTrack', ...overrides,
  };
}

/** EP-15 HU-76: tarjetas con avance y estado, estados de la página, crear y borrar. "Hoy" = 2026-10-20. */
describe('BudgetsPage', () => {
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
      imports: [BudgetsPage],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    vi.useRealTimers();
  });

  function render(items: BudgetResponse[]) {
    const fixture = TestBed.createComponent(BudgetsPage);
    fixture.detectChanges();
    httpMock.expectOne(`${base}?month=2026-10`).flush({ month: '2026-10', items });
    fixture.detectChanges();
    return { fixture, element: fixture.nativeElement as HTMLElement };
  }

  it('shows each budget with spent, limit, state text and what is left or over', () => {
    const page = render([
      budget({ id: 'x', categoryName: 'Fun', spent: 430000, remaining: 0, over: 30000, percent: 107.5, state: 'Exceeded' }),
      budget({}),
    ]);

    const cards = [...page.element.querySelectorAll('.card')].map((card) => card.textContent!.replace(/\s+/g, ' '));
    expect(cards[0]).toContain('107.5 % · Over the limit');
    expect(cards[0]).toContain('COP 30,000 over the limit');
    expect(cards[1]).toContain('62.5 % · On track');
    expect(cards[1]).toContain('COP 150,000 left this month');
  });

  it('offers to create the first budget when there are none, and opens the form', () => {
    const page = render([]);

    expect(page.element.querySelector('.empty')?.textContent).toContain('No budgets yet.');
    page.element.querySelector<HTMLButtonElement>('.empty .btn')!.click();
    page.fixture.detectChanges();

    expect(page.element.querySelector('app-budget-form')).not.toBeNull();
    httpMock.match(() => true).forEach((request) => request.flush([]));
  });

  it('deletes a budget after confirmation and reloads', () => {
    const page = render([budget({})]);

    page.element.querySelector<HTMLButtonElement>('[aria-label="Delete budget: Food"]')!.click();
    page.fixture.detectChanges();
    page.element.querySelector<HTMLButtonElement>('.danger-button')!.click();
    httpMock.expectOne(`${base}/b`).flush(null, { status: 204, statusText: 'No Content' });
    httpMock.expectOne(`${base}?month=2026-10`).flush({ month: '2026-10', items: [] });
    page.fixture.detectChanges();

    expect(page.element.querySelector('.empty')).not.toBeNull();
  });

  it('shows a retry banner when loading fails', () => {
    const fixture = TestBed.createComponent(BudgetsPage);
    fixture.detectChanges();
    httpMock.expectOne(`${base}?month=2026-10`).flush({}, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('[role="alert"]')?.textContent).toContain('Could not load your budgets.');
  });
});
