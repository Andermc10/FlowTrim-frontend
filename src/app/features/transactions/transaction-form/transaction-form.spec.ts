import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../../environments/environment';
import { productToday } from '../../../core/format/product-calendar';
import { AccountResponse } from '../../accounts/accounts.models';
import { CategoryResponse } from '../../categories/categories.models';
import { TransactionResponse } from '../transactions.models';
import { TransactionForm } from './transaction-form';

const base = `${environment.apiUrl}/api/transactions`;

function account(id: string, name: string, currency = 'COP', isArchived = false): AccountResponse {
  return {
    id, name, type: 'Bank', currency, openingBalance: 0, balance: 0, isArchived, hasTransactions: false,
    createdAt: '', updatedAt: '',
  };
}

function category(id: string, name: string, kind: 'Expense' | 'Income', isArchived = false): CategoryResponse {
  return { id, name, kind, color: 'orange', icon: 'food', isArchived, hasTransactions: false, createdAt: '', updatedAt: '' };
}

const accounts = [account('bank', 'Bank'), account('cash', 'Cash'), account('usd', 'Dollars', 'USD'), account('old', 'Old', 'COP', true)];
const categories = [category('food', 'Food', 'Expense'), category('salary', 'Salary', 'Income'), category('gone', 'Gone', 'Expense', true)];

describe('TransactionForm', () => {
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [TransactionForm],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  function render(transaction: TransactionResponse | null = null) {
    const fixture = TestBed.createComponent(TransactionForm);
    fixture.componentInstance.accounts = accounts;
    fixture.componentInstance.categories = categories;
    fixture.componentInstance.transaction = transaction;
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const options = (id: string) => [...element.querySelectorAll<HTMLOptionElement>(`#${id} option`)]
      .filter((option) => !option.disabled)
      .map((option) => option.textContent!.trim());
    const set = (id: string, value: string, event = 'input') => {
      const control = element.querySelector<HTMLInputElement | HTMLSelectElement>(`#${id}`)!;
      control.value = value;
      control.dispatchEvent(new Event(event));
      fixture.detectChanges();
    };
    const chooseType = (label: string) => {
      [...element.querySelectorAll('.type-option')].find((option) => option.textContent!.trim() === label)!
        .querySelector('input')!.click();
      fixture.detectChanges();
    };
    const submit = () => {
      element.querySelector('form')!.dispatchEvent(new Event('submit'));
      fixture.detectChanges();
    };
    return { fixture, element, options, set, chooseType, submit };
  }

  it('records an expense with today, the first active account and only expense categories', () => {
    const form = render();

    expect(form.options('tx-account')).toEqual(['Bank · COP', 'Cash · COP', 'Dollars · USD']);
    expect(form.options('tx-category')).toEqual(['Food']);
    form.set('tx-amount', '38900');
    form.set('tx-category', 'food', 'change');
    form.set('tx-description', '  Lunch ');
    form.submit();

    const request = httpMock.expectOne(base);
    expect(request.request.body).toEqual({
      type: 'Expense', accountId: 'bank', toAccountId: null, categoryId: 'food', amount: 38900,
      date: productToday(), description: 'Lunch', note: null,
    });
    request.flush({});
  });

  it('offers only same-currency destinations for a transfer and sends no category', () => {
    const form = render();

    form.chooseType('Transfer');
    expect(form.options('tx-to-account')).toEqual(['Cash · COP']);
    form.set('tx-amount', '100000');
    form.set('tx-to-account', 'cash', 'change');
    form.submit();

    const body = httpMock.expectOne(base).request.body;
    expect(body.type).toBe('Transfer');
    expect(body.toAccountId).toBe('cash');
    expect(body.categoryId).toBeNull();
  });

  it('switching to income clears an expense category and requires an income one', () => {
    const form = render();

    form.set('tx-category', 'food', 'change');
    form.chooseType('Income');
    form.set('tx-amount', '10');
    form.submit();

    expect(form.options('tx-category')).toEqual(['Salary']);
    expect(form.element.querySelector('#tx-category-error')!.textContent).toContain('Choose a category.');
    httpMock.expectNone(base);
  });

  it('rejects a future date before calling the API', () => {
    const form = render();

    form.set('tx-amount', '10');
    form.set('tx-category', 'food', 'change');
    form.set('tx-date', '2999-01-01');
    form.submit();

    expect(form.element.querySelector('#tx-date-error')!.textContent).toContain('The date cannot be in the future.');
    httpMock.expectNone(base);
  });

  it('keeps the archived account and category of the transaction being edited', () => {
    const form = render({
      id: 't1', type: 'Expense', accountId: 'old', accountName: 'Old', toAccountId: null, toAccountName: null,
      categoryId: 'gone', categoryName: 'Gone', categoryColor: 'orange', categoryIcon: 'food', amount: 5,
      currency: 'COP', date: '2026-09-01', description: null, note: null, createdAt: '', updatedAt: '',
    });

    expect(form.options('tx-account')).toContain('Old · COP');
    expect(form.options('tx-category')).toEqual(['Food', 'Gone']);
    form.submit();

    const request = httpMock.expectOne(`${base}/t1`);
    expect(request.request.body.accountId).toBe('old');
    expect(request.request.body.categoryId).toBe('gone');
    request.flush({});
  });
});
