import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';

import { environment } from '../../../../environments/environment';
import { AccountResponse } from '../../accounts/accounts.models';
import { CategoryResponse } from '../../categories/categories.models';
import { SubscriptionForm } from './subscription-form';

/** EP-14 HU-72: tipo, ciclos nuevos, enlace de pago y cuenta y categoría por defecto. "Hoy" = 2026-10-20 en Bogotá. */
describe('SubscriptionForm recurring payment fields', () => {
  let httpMock: HttpTestingController;

  const account = (id: string, name: string, isArchived = false): AccountResponse => ({
    id, name, type: 'Bank', currency: 'COP', openingBalance: 0, balance: 0, isArchived, hasTransactions: false,
    createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z',
  });
  const category = (id: string, name: string, kind: 'Expense' | 'Income' = 'Expense', isArchived = false): CategoryResponse => ({
    id, name, kind, color: 'orange', icon: 'home', isArchived, hasTransactions: false,
    createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z',
  });

  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(Date.UTC(2026, 9, 20, 15, 0, 0)));
    TestBed.configureTestingModule({
      imports: [SubscriptionForm],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({}) } } },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    vi.useRealTimers();
  });

  function render() {
    const fixture = TestBed.createComponent(SubscriptionForm);
    fixture.detectChanges();
    httpMock.expectOne(`${environment.apiUrl}/api/accounts?includeArchived=true`).flush([
      account('bank', 'Bank'),
      account('old', 'Old wallet', true),
    ]);
    httpMock.expectOne((request) => request.url === `${environment.apiUrl}/api/categories`).flush([
      category('home', 'Home'),
      category('salary', 'Salary', 'Income'),
      category('archived', 'Old', 'Expense', true),
    ]);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const field = <T extends HTMLElement>(id: string) => element.querySelector<T>(`#${id}`)!;
    const type = (id: string, value: string) => {
      const input = field<HTMLInputElement>(id);
      input.value = value;
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();
    };
    const choose = (id: string, value: string) => {
      const select = field<HTMLSelectElement>(id);
      select.value = value;
      select.dispatchEvent(new Event('change'));
      fixture.detectChanges();
    };
    return { fixture, element, field, type, choose };
  }

  it('offers both kinds, the five cycles and only active expense categories and accounts', () => {
    const form = render();

    const options = (id: string) => [...form.field<HTMLSelectElement>(id).options].map((option) => option.textContent?.trim());
    expect(options('kind')).toEqual(['Subscription', 'Bill', 'Instalment plan']);
    expect(options('billingCycle')).toEqual(['Weekly', 'Every 2 weeks', 'Monthly', 'Quarterly', 'Yearly']);
    expect(options('defaultAccountId')).toEqual(['None', 'Bank · COP']);
    const chips = [...form.element.querySelectorAll('.chip__body')].map((chip) => chip.textContent?.trim());
    expect(chips).toEqual(['None', 'Home']);
  });

  it('rejects an unsafe payment link while typing', () => {
    const form = render();

    form.type('paymentUrl', 'http://pay.example.com');
    expect(form.element.querySelector('#paymentUrl-error')?.textContent?.trim()).toBe(
      'Use an https:// address without a user name or password (at most 500 characters).',
    );

    form.type('paymentUrl', 'https://pay.example.com');
    expect(form.element.querySelector('#paymentUrl-error')?.textContent?.trim()).toBe('');
  });

  it('sends the kind, cycle, link and defaults when creating', () => {
    const form = render();
    form.choose('kind', 'Bill');
    form.type('name', 'Rent');
    form.type('amount', '1200000');
    form.choose('billingCycle', 'Biweekly');
    form.type('nextBillingDate', '2026-11-01');
    form.type('paymentUrl', ' https://pay.example.com ');
    form.choose('defaultAccountId', 'bank');
    const homeChip = form.element.querySelectorAll<HTMLInputElement>('.chip input')[1];
    homeChip.click();
    form.fixture.detectChanges();

    form.element.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));

    const request = httpMock.expectOne(`${environment.apiUrl}/api/subscriptions`);
    expect(request.request.body).toEqual({
      name: 'Rent', category: null, amount: 1200000, currency: 'COP', billingCycle: 'Biweekly',
      nextBillingDate: '2026-11-01', kind: 'Bill', paymentUrl: 'https://pay.example.com',
      defaultAccountId: 'bank', categoryId: 'home', totalInstalments: null, paidInstalments: null,
    });
  });

  it('asks for the instalments of a plan, validates them live and sends them (HU-74)', () => {
    const form = render();
    expect(form.element.querySelector('#totalInstalments')).toBeNull();

    form.choose('kind', 'Instalment');
    form.type('name', 'Laptop');
    form.type('amount', '250000');
    form.type('nextBillingDate', '2026-11-01');
    form.type('totalInstalments', '12');
    form.type('paidInstalments', '12');
    expect(form.element.querySelector('#paidInstalments-error')?.textContent?.trim()).toBe(
      'Use a whole number from 0 to one less than the total.',
    );
    form.type('paidInstalments', '3');

    form.element.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));

    const body = httpMock.expectOne(`${environment.apiUrl}/api/subscriptions`).request.body;
    expect(body.kind).toBe('Instalment');
    expect(body.totalInstalments).toBe(12);
    expect(body.paidInstalments).toBe(3);
  });
});
