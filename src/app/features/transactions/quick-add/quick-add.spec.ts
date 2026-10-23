import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { environment } from '../../../../environments/environment';
import { ToastService } from '../../../core/ui/toast/toast.service';
import { AccountResponse } from '../../accounts/accounts.models';
import { CategoryResponse } from '../../categories/categories.models';
import { TransactionResponse } from '../transactions.models';
import { QuickAdd } from './quick-add';
import { QuickAddService, lastAccountStorageKey } from './quick-add.service';

const api = environment.apiUrl;

function account(id: string, name: string): AccountResponse {
  return {
    id, name, type: 'Bank', currency: 'COP', openingBalance: 0, balance: 0, isArchived: false, hasTransactions: false,
    createdAt: '', updatedAt: '',
  };
}

function category(id: string, name: string): CategoryResponse {
  return { id, name, kind: 'Expense', color: 'orange', icon: 'food', isArchived: false, hasTransactions: false, createdAt: '', updatedAt: '' };
}

function used(categoryId: string): TransactionResponse {
  return {
    id: crypto.randomUUID(), type: 'Expense', accountId: 'bank', accountName: 'Bank', toAccountId: null, toAccountName: null,
    categoryId, categoryName: '', categoryColor: 'orange', categoryIcon: 'food', amount: 1, currency: 'COP', date: '2026-10-01',
    description: null, note: null, createdAt: '', updatedAt: '',
  };
}

/** HU-67: atajo N, modal compacto, orden por uso, última cuenta y recarga de la pantalla abierta. */
describe('QuickAdd', () => {
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
      imports: [QuickAdd],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  function render() {
    const fixture = TestBed.createComponent(QuickAdd);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const press = (key: string, target: EventTarget = document.body, init: KeyboardEventInit = {}) => {
      target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }));
      fixture.detectChanges();
    };
    const flushData = (accounts: AccountResponse[], categories: CategoryResponse[], recent: TransactionResponse[] = []) => {
      httpMock.expectOne(`${api}/api/accounts`).flush(accounts);
      httpMock.expectOne((r) => r.url === `${api}/api/categories`).flush(categories);
      const history = httpMock.expectOne((r) => r.url === `${api}/api/transactions`);
      history.flush({ items: recent, page: 1, pageSize: 200, totalCount: recent.length, totals: [] });
      fixture.detectChanges();
      return history;
    };
    return { fixture, element, press, flushData };
  }

  it('opens with N outside any field and looks at the last 90 days', () => {
    const view = render();

    view.press('n');
    const history = view.flushData([account('bank', 'Bank')], [category('food', 'Food')]);

    expect(TestBed.inject(QuickAddService).isOpen()).toBe(true);
    const from = new Date(`${history.request.params.get('from')}T00:00:00Z`).getTime();
    const to = new Date(`${history.request.params.get('to')}T00:00:00Z`).getTime();
    expect((to - from) / 86_400_000).toBe(89);
    expect(view.element.querySelector('#tx-amount')).not.toBeNull();
  });

  it('ignores N while typing, with modifiers or when another dialog is open', () => {
    const view = render();
    const input = document.createElement('input');
    document.body.append(input);

    view.press('n', input);
    view.press('n', document.body, { ctrlKey: true });
    const dialog = document.createElement('dialog');
    dialog.setAttribute('open', '');
    document.body.append(dialog);
    view.press('N');

    expect(TestBed.inject(QuickAddService).isOpen()).toBe(false);
    input.remove();
    dialog.remove();
  });

  it('orders category chips by recent use and preselects the last used account', () => {
    localStorage.setItem(lastAccountStorageKey, 'cash');
    const view = render();

    TestBed.inject(QuickAddService).open();
    view.fixture.detectChanges();
    view.flushData(
      [account('bank', 'Bank'), account('cash', 'Cash')],
      [category('food', 'Food'), category('home', 'Home'), category('taxi', 'Taxi')],
      [used('taxi'), used('taxi'), used('home')],
    );

    const chips = [...view.element.querySelectorAll('.chip')].map((chip) => chip.textContent!.trim());
    expect(chips).toEqual(['Taxi', 'Home', 'Food']);
    expect(view.element.querySelector<HTMLSelectElement>('#tx-account')!.value).toBe('cash');
  });

  it('explains that an account is needed first', () => {
    const view = render();

    TestBed.inject(QuickAddService).open();
    view.fixture.detectChanges();
    view.flushData([], [category('food', 'Food')]);

    expect(view.element.textContent).toContain('You need an account before recording a transaction');
    expect(view.element.querySelector('a[href="/app/accounts"]')).not.toBeNull();
  });

  it('records with the keyboard only: amount, Tab to a category, Enter; then closes and notifies', async () => {
    const view = render();
    const service = TestBed.inject(QuickAddService);
    const toast = TestBed.inject(ToastService);
    const saved: TransactionResponse[] = [];
    service.saved$.subscribe((transaction) => saved.push(transaction));

    view.press('n');
    view.flushData([account('bank', 'Bank')], [category('food', 'Food')]);
    const amount = view.element.querySelector<HTMLInputElement>('#tx-amount')!;
    await Promise.resolve();
    expect(document.activeElement).toBe(amount);
    amount.value = '38900';
    amount.dispatchEvent(new Event('input'));
    const chip = view.element.querySelector<HTMLInputElement>('.chip input')!;
    chip.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    view.fixture.detectChanges();

    const request = httpMock.expectOne(`${api}/api/transactions`);
    expect(request.request.body.categoryId).toBe('food');
    expect(request.request.body.amount).toBe(38900);
    request.flush({ ...used('food'), categoryName: 'Food', amount: 38900 });
    view.fixture.detectChanges();

    expect(toast.toasts()[0].message.replace(/\s+/g, ' ')).toBe('Expense recorded · Food · COP 38,900');
    expect(saved).toHaveLength(1);
    expect(service.isOpen()).toBe(false);
    expect(localStorage.getItem(lastAccountStorageKey)).toBe('bank');
  });

  it('"Save and add another" keeps the modal open with the same type and account', () => {
    const view = render();
    const service = TestBed.inject(QuickAddService);

    view.press('n');
    view.flushData([account('bank', 'Bank'), account('cash', 'Cash')], [category('food', 'Food')]);
    const select = view.element.querySelector<HTMLSelectElement>('#tx-account')!;
    select.value = 'cash';
    select.dispatchEvent(new Event('change'));
    const amount = view.element.querySelector<HTMLInputElement>('#tx-amount')!;
    amount.value = '10';
    amount.dispatchEvent(new Event('input'));
    view.element.querySelector<HTMLInputElement>('.chip input')!.click();
    view.fixture.detectChanges();
    [...view.element.querySelectorAll<HTMLButtonElement>('.actions button')]
      .find((button) => button.textContent!.includes('Save and add another'))!.click();

    httpMock.expectOne(`${api}/api/transactions`).flush({ ...used('food'), accountId: 'cash' });
    view.fixture.detectChanges();

    expect(service.isOpen()).toBe(true);
    expect(view.element.querySelector<HTMLInputElement>('#tx-amount')!.value).toBe('');
    expect(view.element.querySelector<HTMLSelectElement>('#tx-account')!.value).toBe('cash');
    expect(view.element.querySelector<HTMLInputElement>('.chip input')!.checked).toBe(false);
  });
});
