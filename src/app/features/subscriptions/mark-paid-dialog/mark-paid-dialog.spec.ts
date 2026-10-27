import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../../environments/environment';
import { ToastService } from '../../../core/ui/toast/toast.service';
import { AccountResponse } from '../../accounts/accounts.models';
import { CategoryResponse } from '../../categories/categories.models';
import { SubscriptionResponse } from '../models/subscription.models';
import { MarkPaidDialog } from './mark-paid-dialog';

const base = `${environment.apiUrl}/api/subscriptions`;

const netflix: SubscriptionResponse = {
  id: 'n', name: 'Netflix', category: null, amount: 38900, currency: 'COP', billingCycle: 'Monthly', nextBillingDate: '2026-10-20',
  status: 'Active', kind: 'Subscription', paymentUrl: null, defaultAccountId: 'bank', categoryId: 'subs', monthlyEquivalent: 38900,
  createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z',
};

const account = (id: string, name: string, currency = 'COP', isArchived = false): AccountResponse => ({
  id, name, type: 'Bank', currency, openingBalance: 0, balance: 100000, isArchived, hasTransactions: false, createdAt: '', updatedAt: '',
});

const category = (id: string, name: string): CategoryResponse => ({
  id, name, kind: 'Expense', color: 'orange', icon: 'subscriptions', isArchived: false, hasTransactions: false, createdAt: '', updatedAt: '',
});

/** EP-14 HU-73: el diálogo registra el gasto con los valores por defecto del pago o solo mueve la fecha. "Hoy" = 2026-10-20. */
describe('MarkPaidDialog', () => {
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
      imports: [MarkPaidDialog],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    vi.useRealTimers();
  });

  function render(payment = netflix) {
    const fixture = TestBed.createComponent(MarkPaidDialog);
    fixture.componentRef.setInput('subscriptionId', payment.id);
    let paid = 0;
    fixture.componentInstance.paid.subscribe(() => paid++);
    fixture.detectChanges();
    httpMock.expectOne(`${base}/${payment.id}`).flush(payment);
    httpMock.expectOne(`${environment.apiUrl}/api/accounts`).flush([
      account('bank', 'Bank'), account('usd', 'Dollars', 'USD'), account('old', 'Old', 'COP', true),
    ]);
    httpMock.expectOne((request) => request.url === `${environment.apiUrl}/api/categories`).flush([
      category('subs', 'Subscriptions'), category('home', 'Home'),
    ]);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const field = <T extends HTMLElement>(id: string) => element.querySelector<T>(`#${id}`)!;
    const submit = () => {
      element.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
      fixture.detectChanges();
    };
    return { fixture, element, field, submit, paidCount: () => paid };
  }

  it('prefills the default account, amount, today and category, offering only active accounts in the payment currency', () => {
    const dialog = render();

    const options = [...dialog.field<HTMLSelectElement>('mp-account').options].map((option) => option.value);
    expect(options).toEqual(['', 'bank']);
    expect(dialog.field<HTMLSelectElement>('mp-account').value).toBe('bank');
    expect(dialog.field<HTMLInputElement>('mp-amount').value).toBe('38900');
    expect(dialog.field<HTMLInputElement>('mp-date').value).toBe('2026-10-20');
    expect(dialog.element.querySelector('.chip:has(input:checked)')?.textContent?.trim()).toBe('Subscriptions');
  });

  it('records the payment with an edited amount and reports it in a toast', () => {
    const toast = TestBed.inject(ToastService);
    const dialog = render();
    const amount = dialog.field<HTMLInputElement>('mp-amount');
    amount.value = '41250';
    amount.dispatchEvent(new Event('input'));

    dialog.submit();

    const request = httpMock.expectOne(`${base}/n/mark-paid`);
    expect(request.request.body).toEqual({ accountId: 'bank', amount: 41250, date: '2026-10-20', categoryId: 'subs' });
    request.flush({
      subscription: { ...netflix, nextBillingDate: '2026-11-20' },
      transaction: {
        id: 't', type: 'Expense', accountId: 'bank', accountName: 'Bank', toAccountId: null, toAccountName: null, categoryId: 'subs',
        categoryName: 'Subscriptions', categoryColor: 'orange', categoryIcon: 'subscriptions', amount: 41250, currency: 'COP',
        date: '2026-10-20', description: 'Netflix', note: null, createdAt: '', updatedAt: '', recurringPaymentId: 'n',
      },
      completed: false,
    });

    // Intl separa el código de moneda con un espacio duro (carácter 160).
    expect(toast.toasts()[0].message.split(String.fromCharCode(160)).join(' ')).toBe(
      'COP 41,250 for "Netflix" recorded in Bank. Next expected charge: Nov 20, 2026.',
    );
    expect(dialog.paidCount()).toBe(1);
  });

  it('shows server field errors without a toast and keeps the dialog open', () => {
    const toast = TestBed.inject(ToastService);
    const dialog = render();

    dialog.submit();
    httpMock.expectOne(`${base}/n/mark-paid`).flush(
      { errors: { accountId: ['Use an account in COP, the currency of this payment.'] } },
      { status: 400, statusText: 'Bad Request' },
    );
    dialog.fixture.detectChanges();

    expect(dialog.element.querySelector('#mp-account-error')?.textContent).toContain('Use an account in COP');
    expect(toast.toasts()).toEqual([]);
    expect(dialog.paidCount()).toBe(0);
  });

  it('only moves the date when that option is chosen', () => {
    const dialog = render();
    dialog.element.querySelector<HTMLInputElement>('input[value="dateOnly"]')!.click();
    dialog.fixture.detectChanges();

    expect(dialog.element.querySelector('#mp-account')).toBeNull();
    dialog.submit();
    expect(httpMock.expectOne(`${base}/n/mark-paid`).request.body).toEqual({});
  });
});
