import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { environment } from '../../../../environments/environment';
import { productToday } from '../../../core/format/product-calendar';
import { AccountResponse } from '../../accounts/accounts.models';
import { TransactionListResponse, TransactionResponse } from '../transactions.models';
import { monthOf, monthRange, shiftMonth } from '../transaction-days';
import { TransactionsPage } from './transactions-page';

const api = environment.apiUrl;

const bank: AccountResponse = {
  id: 'bank', name: 'Bank', type: 'Bank', currency: 'COP', openingBalance: 0, balance: 0, isArchived: false,
  hasTransactions: true, createdAt: '', updatedAt: '',
};

function tx(overrides: Partial<TransactionResponse>): TransactionResponse {
  return {
    id: crypto.randomUUID(), type: 'Expense', accountId: 'bank', accountName: 'Bank', toAccountId: null, toAccountName: null,
    categoryId: 'food', categoryName: 'Food', categoryColor: 'orange', categoryIcon: 'food', amount: 38900, currency: 'COP',
    date: '2026-10-20', description: null, note: null, createdAt: '', updatedAt: '', ...overrides,
  };
}

function page(items: TransactionResponse[], totalCount = items.length): TransactionListResponse {
  return { items, page: 1, pageSize: 200, totalCount, totals: [{ currency: 'COP', income: 5000, expense: 38900, net: -33900 }] };
}

/** HU-66: listado del mes agrupado por día, filtros y estados. */
describe('TransactionsPage', () => {
  let httpMock: HttpTestingController;

  beforeAll(() => {
    // El entorno de pruebas no implementa <dialog>.showModal().
    HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
      this.setAttribute('open', '');
    };
  });

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [TransactionsPage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  const listRequest = (): TestRequest => httpMock.expectOne((r) => r.url === `${api}/api/transactions`);

  function render(accounts: AccountResponse[], first: TransactionListResponse) {
    const fixture = TestBed.createComponent(TransactionsPage);
    fixture.detectChanges();
    httpMock.expectOne(`${api}/api/accounts?includeArchived=true`).flush(accounts);
    httpMock.expectOne((r) => r.url === `${api}/api/categories`).flush([]);
    const request = listRequest();
    request.flush(first);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    return { fixture, element, request, text: () => element.textContent!.replace(/\s+/g, ' ') };
  }

  it('asks for the current product month and groups rows by day with signed amounts', () => {
    const view = render([bank], page([
      tx({ date: '2026-10-20', type: 'Income', amount: 5000, description: 'Pay', categoryName: 'Salary' }),
      tx({ date: '2026-10-20' }),
      tx({ date: '2026-10-18', type: 'Transfer', categoryId: null, categoryName: null, categoryIcon: null, toAccountName: 'Cash', amount: 100000 }),
    ]));

    const range = monthRange(monthOf(productToday()));
    expect(view.request.request.params.get('from')).toBe(range.from);
    expect(view.request.request.params.get('to')).toBe(range.to);
    const days = [...view.element.querySelectorAll('section.day')];
    expect(days).toHaveLength(2);
    expect(days[0].querySelector('.day__net')!.textContent!.replace(/\s+/g, ' ')).toContain('-COP 33,900');
    const rows = [...days[0].querySelectorAll('li.row')].map((row) => row.querySelector('.row__amount')!.textContent!.replace(/\s+/g, ' ').trim());
    expect(rows).toEqual(['Income: +COP 5,000', 'Expense: -COP 38,900']);
    expect(days[1].textContent!.replace(/\s+/g, ' ')).toContain('Bank → Cash');
    expect(view.element.querySelector('.total')!.textContent!.replace(/\s+/g, ' ')).toContain('-COP 38,900');
  });

  it('reloads with the chosen filter and the previous month', () => {
    const view = render([bank], page([]));

    const select = view.element.querySelectorAll<HTMLSelectElement>('.filter select')[2];
    select.value = 'Income';
    select.dispatchEvent(new Event('change'));
    const filtered = listRequest();
    expect(filtered.request.params.get('type')).toBe('Income');
    filtered.flush(page([]));
    view.fixture.detectChanges();
    expect(view.text()).toContain('No transactions match these filters.');

    view.element.querySelector<HTMLButtonElement>('.month-nav .icon-button')!.click();
    const previous = listRequest();
    expect(previous.request.params.get('from')).toBe(monthRange(shiftMonth(monthOf(productToday()), -1)).from);
    previous.flush(page([]));
  });

  it('points to accounts when there are none', () => {
    const view = render([], page([]));

    expect(view.text()).toContain('Add an account first');
    expect(view.element.querySelector('a[href="/app/accounts"]')).not.toBeNull();
  });

  it('loads the next page and appends it', () => {
    const view = render([bank], page([tx({})], 2));

    view.element.querySelector<HTMLButtonElement>('.load-more')!.click();
    const next = listRequest();
    expect(next.request.params.get('page')).toBe('2');
    next.flush({ ...page([tx({ date: '2026-10-01' })], 2), page: 2 });
    view.fixture.detectChanges();

    expect(view.element.querySelectorAll('li.row')).toHaveLength(2);
    expect(view.element.querySelector('.load-more')).toBeNull();
  });

  it('shows a retry banner when the list fails and retries the same filter', () => {
    const fixture = TestBed.createComponent(TransactionsPage);
    fixture.detectChanges();
    httpMock.expectOne(`${api}/api/accounts?includeArchived=true`).flush([bank]);
    httpMock.expectOne((r) => r.url === `${api}/api/categories`).flush([]);
    listRequest().flush({}, { status: 500, statusText: 'Error' });
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('[role="alert"]')!.textContent).toContain('Could not load your transactions.');
    element.querySelector<HTMLButtonElement>('[role="alert"] button')!.click();
    listRequest().flush(page([]));
  });
});
