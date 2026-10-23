import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { environment } from '../../../../environments/environment';
import { AccountResponse } from '../../accounts/accounts.models';
import { QuickAddService } from '../../transactions/quick-add/quick-add.service';
import { TransactionResponse } from '../../transactions/transactions.models';
import { CurrencyToday, TodayDashboard } from '../today.models';
import { TodayPage } from './today-page';

const url = `${environment.apiUrl}/api/dashboard/today`;

function account(overrides: Partial<AccountResponse>): AccountResponse {
  return {
    id: crypto.randomUUID(), name: 'Bank', type: 'Bank', currency: 'COP', openingBalance: 0, balance: 1000000,
    isArchived: false, hasTransactions: false, createdAt: '', updatedAt: '', ...overrides,
  };
}

// AC-1 de HU-68: disponible 1.200.000, comprometido 38.900, 12 días → 96.758,33.
const specCop: CurrencyToday = {
  currency: 'COP', available: 1200000, monthIncome: 0, monthExpenses: 0, monthNet: 0, todayExpenses: 0,
  committedUntilMonthEnd: 38900, daysLeft: 12, safeToSpendToday: 96758.33, shortfall: 0,
};

function dashboard(overrides: Partial<TodayDashboard> = {}): TodayDashboard {
  return {
    referenceDate: '2026-10-20',
    currencies: [specCop],
    accounts: [account({ name: 'Cash', type: 'Cash', balance: 200000 }), account({}), account({ name: 'Visa', type: 'CreditCard', balance: -300000 })],
    recentTransactions: [],
    chargesUntilMonthEnd: [{ subscriptionId: 's1', name: 'Netflix', amount: 38900, currency: 'COP', nextBillingDate: '2026-10-28', isOverdue: false }],
    ...overrides,
  };
}

/** HU-68: panel "Hoy" — fórmula visible, faltante, monedas separadas, primer uso y recarga tras el registro rápido. */
describe('TodayPage', () => {
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [TodayPage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  function render(data: TodayDashboard) {
    const fixture = TestBed.createComponent(TodayPage);
    fixture.detectChanges();
    httpMock.expectOne(url).flush(data);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    return { fixture, element, text: (selector = ':scope') => element.querySelector(selector)!.textContent!.replace(/\s+/g, ' ') };
  }

  it('shows safe to spend today with every input of the formula', () => {
    const page = render(dashboard());

    expect(page.text('.hero__value')).toContain('COP 96,758');
    expect(page.text('.hero__per-day')).toContain('12 days left');
    const formula = page.text('.formula');
    expect(formula).toContain('Available (cash, bank and savings)COP 1,200,000');
    expect(formula).toContain('Expected charges until Oct 31, 2026-COP 38,900');
    expect(formula).toContain('(COP 1,200,000 − COP 38,900) ÷ 12 = COP 96,758');
    expect(formula).toContain('not financial advice');
    expect(page.element.querySelector('.shortfall')).toBeNull();
  });

  it('warns with the shortfall when charges exceed the available money', () => {
    const page = render(dashboard({ currencies: [{ ...specCop, available: 30000, committedUntilMonthEnd: 80000, safeToSpendToday: 0, shortfall: 50000 }] }));

    expect(page.text('.hero__value')).toContain('COP 0');
    expect(page.text('.shortfall')).toContain('exceed your available money by COP 50,000');
  });

  it('keeps one card per currency and shows a credit card debt as owed', () => {
    const page = render(dashboard({
      currencies: [specCop, { ...specCop, currency: 'USD', available: 50, committedUntilMonthEnd: 0, safeToSpendToday: 4.17 }],
    }));

    expect([...page.element.querySelectorAll('.hero .currency-mark')].map((mark) => mark.textContent)).toEqual(['COP', 'USD']);
    const visa = [...page.element.querySelectorAll('.account-strip li')].find((item) => item.textContent!.includes('Visa'))!;
    expect(visa.textContent!.replace(/\s+/g, ' ')).toContain('Owed');
    expect(visa.textContent).not.toContain('-');
    expect(page.text('.panels')).toContain('Netflix');
  });

  it('guides a new user: create an account first', () => {
    const page = render(dashboard({ currencies: [], accounts: [], chargesUntilMonthEnd: [] }));

    expect(page.element.querySelectorAll('.guide__step')).toHaveLength(2);
    expect(page.element.querySelector('a[href="/app/accounts"]')).not.toBeNull();
    expect(page.element.querySelector('.hero')).toBeNull();
  });

  it('offers quick add when there are accounts but no transactions yet', () => {
    const page = render(dashboard());
    const quickAdd = TestBed.inject(QuickAddService);

    page.element.querySelector<HTMLButtonElement>('.notice--next button')!.click();

    expect(quickAdd.isOpen()).toBe(true);
  });

  it('reloads after a transaction is recorded from quick add, without the loading state', () => {
    const page = render(dashboard());
    const quickAdd = TestBed.inject(QuickAddService);

    quickAdd.notifySaved({ accountId: 'bank' } as TransactionResponse);
    page.fixture.detectChanges();
    expect(page.element.querySelector('[role="status"]')).toBeNull();
    httpMock.expectOne(url).flush(dashboard({ currencies: [{ ...specCop, todayExpenses: 38900 }] }));
    page.fixture.detectChanges();

    expect(page.text('.tiles')).toContain('Spent today-COP 38,900');
  });

  it('shows a retry banner when the request fails', () => {
    const fixture = TestBed.createComponent(TodayPage);
    fixture.detectChanges();
    httpMock.expectOne(url).flush({}, { status: 500, statusText: 'Error' });
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('[role="alert"]')!.textContent).toContain('Could not load today.');
    element.querySelector<HTMLButtonElement>('[role="alert"] button')!.click();
    httpMock.expectOne(url).flush(dashboard());
  });
});
