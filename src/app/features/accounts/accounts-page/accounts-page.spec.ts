import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../../environments/environment';
import { ToastService } from '../../../core/ui/toast/toast.service';
import { AccountResponse } from '../accounts.models';
import { AccountsPage } from './accounts-page';

const base = `${environment.apiUrl}/api/accounts`;

function account(overrides: Partial<AccountResponse>): AccountResponse {
  return {
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
    ...overrides,
  };
}

/** HU-64: pantalla de cuentas con saldos calculados, archivado y borrado protegido. */
describe('AccountsPage', () => {
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
      imports: [AccountsPage],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  function render(accounts: AccountResponse[]) {
    const fixture = TestBed.createComponent(AccountsPage);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('[role="status"]')).not.toBeNull();
    httpMock.expectOne(`${base}?includeArchived=true`).flush(accounts);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const text = () => element.textContent?.replace(/\s+/g, ' ') ?? '';
    const click = (selector: string) => {
      element.querySelector<HTMLButtonElement>(selector)!.click();
      fixture.detectChanges();
    };
    return { fixture, element, text, click };
  }

  it('shows the empty state with a call to add the first account', () => {
    const page = render([]);

    expect(page.text()).toContain('You have no accounts yet.');
    expect(page.text()).toContain('Add your first account');
  });

  it('shows balances, totals per currency and the debt of a credit card as owed', () => {
    const page = render([
      account({}),
      account({ id: 'card', name: 'Visa', type: 'CreditCard', openingBalance: -300000, balance: -300000, hasTransactions: false }),
    ]);

    const cards = [...page.element.querySelectorAll('li.account')];
    expect(cards).toHaveLength(2);
    expect(cards[0].textContent).toContain('Balance');
    expect(cards[0].textContent).toContain('461,100');
    const cardBalance = cards[1].querySelector('.account__balance')!.textContent!.replace(/\s+/g, ' ');
    expect(cardBalance).toContain('Owed');
    expect(cardBalance).toContain('COP 300,000');
    expect(cardBalance).not.toContain('-');
    const total = page.element.querySelector('.total')!.textContent!.replace(/\s+/g, ' ');
    expect(total).toContain('461,100');
    expect(total).toContain('Credit cards: -COP 300,000');
  });

  it('lists archived accounts apart and leaves them out of the totals', () => {
    const page = render([account({}), account({ id: 'old', name: 'Old wallet', type: 'Cash', balance: 9000, isArchived: true })]);

    expect(page.element.querySelectorAll('.account-grid > li')).toHaveLength(2);
    expect(page.element.querySelector('details.archived summary')!.textContent).toContain('Archived accounts (1)');
    expect(page.element.querySelector('.total')!.textContent).toContain('461,100');
  });

  it('offers archiving instead of deleting an account with transactions', () => {
    const toast = TestBed.inject(ToastService);
    const page = render([account({})]);

    page.click('.icon-button--danger');
    expect(page.text()).toContain('This account cannot be deleted');
    page.click('.primary-button');

    const update = httpMock.expectOne(`${base}/bank`);
    expect(update.request.method).toBe('PUT');
    expect(update.request.body).toEqual({ name: 'Bank', type: 'Bank', currency: 'COP', openingBalance: 500000, isArchived: true });
    update.flush(account({ isArchived: true }));
    expect(toast.toasts()[0].message).toBe('"Bank" was archived. Its history is kept.');
    httpMock.expectOne(`${base}?includeArchived=true`).flush([account({ isArchived: true })]);
  });

  it('deletes an unused account after confirmation', () => {
    const page = render([account({ hasTransactions: false, balance: 500000 })]);

    page.click('.icon-button--danger');
    page.click('.danger-button');

    const request = httpMock.expectOne(`${base}/bank`);
    expect(request.request.method).toBe('DELETE');
    request.flush(null, { status: 204, statusText: 'No Content' });
    httpMock.expectOne(`${base}?includeArchived=true`).flush([]);
  });

  it('explains a 409 that arrives after a transaction was recorded meanwhile', () => {
    const toast = TestBed.inject(ToastService);
    const page = render([account({ hasTransactions: false })]);

    page.click('.icon-button--danger');
    page.click('.danger-button');
    httpMock.expectOne(`${base}/bank`).flush(
      { status: 409, code: 'account_has_transactions' },
      { status: 409, statusText: 'Conflict' },
    );

    expect(toast.toasts()[0].variant).toBe('warning');
    expect(toast.toasts()[0].message).toBe('This account has transactions, so it cannot be deleted. Archive it instead.');
    httpMock.expectOne(`${base}?includeArchived=true`).flush([account({})]);
  });

  it('shows a retry banner when the list fails', () => {
    const fixture = TestBed.createComponent(AccountsPage);
    fixture.detectChanges();
    httpMock.expectOne(`${base}?includeArchived=true`).flush({}, { status: 500, statusText: 'Error' });
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('[role="alert"]')!.textContent).toContain('Could not load your accounts.');
  });
});
