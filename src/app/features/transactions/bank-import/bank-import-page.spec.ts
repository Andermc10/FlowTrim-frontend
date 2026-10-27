import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { environment } from '../../../../environments/environment';
import { AccountResponse } from '../../accounts/accounts.models';
import { CategoryResponse } from '../../categories/categories.models';
import { BankImportPage } from './bank-import-page';

const api = environment.apiUrl;

const account: AccountResponse = {
  id: 'bank', name: 'Bank', type: 'Bank', currency: 'COP', openingBalance: 0, balance: 0, isArchived: false,
  hasTransactions: false, createdAt: '', updatedAt: '',
};
const category = (id: string, name: string, kind: 'Expense' | 'Income', icon = 'food'): CategoryResponse => ({
  id, name, kind, color: 'orange', icon: icon as CategoryResponse['icon'], isArchived: false, hasTransactions: false, createdAt: '', updatedAt: '',
});

/** EP-16 HU-79: elecciones por defecto, vista previa con filas válidas, de reserva e inválidas, y confirmación. */
describe('BankImportPage', () => {
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [BankImportPage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  function render() {
    const fixture = TestBed.createComponent(BankImportPage);
    fixture.detectChanges();
    httpMock.expectOne(`${api}/api/accounts`).flush([account]);
    httpMock.expectOne((request) => request.url === `${api}/api/categories`).flush([
      category('food', 'Food', 'Expense'), category('other', 'Other', 'Expense', 'other'), category('salary', 'Salary', 'Income', 'salary'),
    ]);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const pick = (file: File) => {
      const input = element.querySelector<HTMLInputElement>('#bank-file')!;
      Object.defineProperty(input, 'files', { value: [file], configurable: true });
      input.dispatchEvent(new Event('change'));
      fixture.detectChanges();
    };
    return { fixture, element, pick };
  }

  it('preselects the account, "Other" for expenses and the income category, then previews and confirms', () => {
    const page = render();
    expect(page.element.querySelector<HTMLSelectElement>('#bank-expense')!.value).toBe('other');

    page.pick(new File(['date,amount\n2026-10-05,-10\n'], 'bank.csv', { type: 'text/csv' }));
    const preview = httpMock.expectOne(`${api}/api/transaction-imports/preview`);
    const form = preview.request.body as FormData;
    expect([form.get('accountId'), form.get('expenseCategoryId'), form.get('incomeCategoryId')]).toEqual(['bank', 'other', 'salary']);
    preview.flush({
      rows: [
        { rowNumber: 2, status: 'valid', values: { date: '2026-10-05', type: 'Expense', amount: 45000.5, description: 'Exito', categoryId: 'other', categoryName: 'Other', categoryFallback: true }, errors: [] },
        { rowNumber: 3, status: 'invalid', values: null, errors: [{ field: 'amount', code: 'amount_zero', message: 'x' }] },
      ],
      summary: { total: 2, valid: 1, invalid: 1, duplicate: 0 },
      ignoredColumns: [],
    });
    page.fixture.detectChanges();

    const rows = [...page.element.querySelectorAll('tbody tr')].map((row) => row.textContent!.replace(/\s+/g, ' '));
    expect(rows[0]).toContain('−COP 45,001');
    expect(rows[0]).toContain('(default: no match)');
    expect(rows[1]).toContain('cannot be zero.');

    page.element.querySelector<HTMLButtonElement>('.actions .btn')!.click();
    httpMock.expectOne(`${api}/api/transaction-imports/confirm`).flush({ total: 2, created: 1, invalid: 1, duplicate: 0 });
    page.fixture.detectChanges();
    expect(page.element.querySelector('.done')?.textContent).toContain('1');
  });

  it('explains invalid choices returned by the server', () => {
    const page = render();
    page.pick(new File(['date,amount\n'], 'bank.csv', { type: 'text/csv' }));
    httpMock.expectOne(`${api}/api/transaction-imports/preview`).flush(
      { errors: { accountId: ['The account is archived.'] } }, { status: 400, statusText: 'Bad Request' });
    page.fixture.detectChanges();

    expect(page.element.querySelector('[role="alert"]')?.textContent).toContain('Check the account and the default categories');
  });

  it('rejects a non-CSV file before sending it', () => {
    const page = render();
    page.pick(new File(['x'], 'bank.txt'));

    expect(page.element.querySelector('[role="alert"]')).not.toBeNull();
  });
});
