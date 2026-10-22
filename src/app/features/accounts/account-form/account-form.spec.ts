import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../../environments/environment';
import { AccountResponse } from '../accounts.models';
import { AccountForm } from './account-form';

const base = `${environment.apiUrl}/api/accounts`;

const usedAccount: AccountResponse = {
  id: 'bank',
  name: 'Bank',
  type: 'Bank',
  currency: 'COP',
  openingBalance: 500000,
  balance: 461100,
  isArchived: false,
  hasTransactions: true,
  createdAt: '2026-10-20T15:00:00Z',
  updatedAt: '2026-10-20T15:00:00Z',
};

describe('AccountForm', () => {
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [AccountForm],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  function render(account: AccountResponse | null = null) {
    const fixture = TestBed.createComponent(AccountForm);
    fixture.componentInstance.account = account;
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const input = (id: string) => element.querySelector<HTMLInputElement>(`#${id}`)!;
    const type = (id: string, value: string) => {
      const field = input(id);
      field.value = value;
      field.dispatchEvent(new Event('input'));
      fixture.detectChanges();
    };
    const submit = () => {
      element.querySelector('form')!.dispatchEvent(new Event('submit'));
      fixture.detectChanges();
    };
    return { fixture, element, input, type, submit };
  }

  it('creates an account with a negative opening balance for a card debt', () => {
    const form = render();
    let saved: AccountResponse | null = null;
    form.fixture.componentInstance.saved.subscribe((account) => (saved = account));

    form.type('account-name', '  Visa ');
    form.element.querySelector<HTMLSelectElement>('#account-type')!.value = 'CreditCard';
    form.element.querySelector('#account-type')!.dispatchEvent(new Event('change'));
    form.type('account-currency', 'cop');
    form.type('account-opening', '-300000');
    form.submit();

    const request = httpMock.expectOne(base);
    expect(request.request.body).toEqual({ name: 'Visa', type: 'CreditCard', currency: 'COP', openingBalance: -300000 });
    request.flush({ ...usedAccount, id: 'visa', name: 'Visa', type: 'CreditCard', hasTransactions: false });
    expect(saved).not.toBeNull();
  });

  it('shows live errors and does not submit an invalid form', () => {
    const form = render();

    form.type('account-name', '   ');
    form.type('account-opening', '10.555');
    form.submit();

    expect(form.element.querySelector('#account-name-error')!.textContent).toContain('Name is required.');
    expect(form.element.querySelector('#account-opening-error')!.textContent).toContain('Use at most 2 decimals.');
    httpMock.expectNone(base);
  });

  it('locks the currency of an account with transactions and keeps its archived flag', () => {
    const form = render(usedAccount);

    expect(form.input('account-currency').disabled).toBe(true);
    expect(form.element.textContent).toContain('The currency cannot change because the account has transactions.');
    form.type('account-name', 'Main bank');
    form.submit();

    const request = httpMock.expectOne(`${base}/bank`);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({
      name: 'Main bank', type: 'Bank', currency: 'COP', openingBalance: 500000, isArchived: false,
    });
    request.flush({ ...usedAccount, name: 'Main bank' });
  });

  it('shows the field errors returned by the API', () => {
    const form = render();

    form.type('account-name', 'Bank');
    form.submit();
    httpMock.expectOne(base).flush(
      { errors: { name: ['An account with this name already exists.'] } },
      { status: 400, statusText: 'Bad Request' },
    );
    form.fixture.detectChanges();

    expect(form.element.querySelector('#account-name-error')!.textContent).toContain('An account with this name already exists.');
  });
});
