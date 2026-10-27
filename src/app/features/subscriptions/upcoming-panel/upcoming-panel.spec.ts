import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { environment } from '../../../../environments/environment';
import { ToastService } from '../../../core/ui/toast/toast.service';
import { UpcomingChargeItem } from '../models/subscription.models';
import { UpcomingPanel } from './upcoming-panel';

const base = `${environment.apiUrl}/api/subscriptions`;

function item(id: string, name: string, alertWindow: UpcomingChargeItem['alertWindow'], daysUntilCharge: number): UpcomingChargeItem {
  return { id, name, amount: 38900, currency: 'COP', billingCycle: 'Monthly', nextBillingDate: '2026-10-20', daysUntilCharge, alertWindow };
}

/** HU-57 en Próximos cobros: "Marcar como pagado" para lo vencido y lo inminente. */
describe('UpcomingPanel mark as paid', () => {
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
      imports: [UpcomingPanel],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  function render() {
    const fixture = TestBed.createComponent(UpcomingPanel);
    fixture.detectChanges();
    httpMock.expectOne(`${base}/upcoming`).flush({
      referenceDate: '2026-10-20',
      items: [item('a', 'Gym', 'Overdue', -2), item('b', 'Netflix', 'DueWithin3Days', 2), item('c', 'Cloud', 'Later', 30)],
    });
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const rows = () => [...element.querySelectorAll('li.row')];
    return { fixture, element, rows };
  }

  it('offers the action only for overdue, today and within-3-days charges', () => {
    const panel = render();

    expect(panel.rows().map((row) => row.querySelector('.row__paid') !== null)).toEqual([true, true, false]);
  });

  it('opens the payment dialog, only moves the date without accounts, shows the new date and reloads (HU-73)', () => {
    const toast = TestBed.inject(ToastService);
    const panel = render();

    panel.rows()[0].querySelector<HTMLButtonElement>('.row__paid')!.click();
    panel.fixture.detectChanges();
    httpMock.expectOne(`${base}/a`).flush({
      id: 'a', name: 'Gym', category: null, amount: 38900, currency: 'COP', billingCycle: 'Monthly',
      nextBillingDate: '2026-10-18', status: 'Active', kind: 'Subscription', paymentUrl: null, defaultAccountId: null,
      categoryId: null, monthlyEquivalent: 38900, totalInstalments: null, paidInstalments: 0, createdAt: '2026-09-01T00:00:00Z', updatedAt: '2026-09-01T00:00:00Z',
    });
    httpMock.expectOne(`${environment.apiUrl}/api/accounts`).flush([]);
    httpMock.expectOne((request) => request.url === `${environment.apiUrl}/api/categories`).flush([]);
    panel.fixture.detectChanges();

    // Sin cuentas en COP: registrar está deshabilitado y queda elegido "solo mover la fecha".
    expect(panel.element.querySelector('[role="note"]')?.textContent).toContain('no active account in COP');
    panel.element.querySelector<HTMLFormElement>('app-mark-paid-dialog form')!.dispatchEvent(new Event('submit'));
    const request = httpMock.expectOne(`${base}/a/mark-paid`);
    expect(request.request.body).toEqual({});
    request.flush({
      subscription: {
        id: 'a', name: 'Gym', category: null, amount: 38900, currency: 'COP', billingCycle: 'Monthly',
        nextBillingDate: '2026-11-18', status: 'Active', kind: 'Subscription', paymentUrl: null, defaultAccountId: null,
        categoryId: null, monthlyEquivalent: 38900, totalInstalments: null, paidInstalments: 0, createdAt: '2026-09-01T00:00:00Z', updatedAt: '2026-10-20T15:00:00Z',
      },
      transaction: null,
      completed: false,
    });

    expect(toast.toasts()[0].message).toBe('"Gym" marked as paid. Next expected charge: Nov 18, 2026.');
    httpMock.expectOne(`${base}/upcoming`).flush({ referenceDate: '2026-10-20', items: [] });
  });
});
