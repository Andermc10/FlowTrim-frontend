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

  it('marks the charge as paid, shows the new date and reloads the list', () => {
    const toast = TestBed.inject(ToastService);
    const panel = render();

    panel.rows()[0].querySelector<HTMLButtonElement>('.row__paid')!.click();
    panel.fixture.detectChanges();
    const request = httpMock.expectOne(`${base}/a/mark-paid`);
    expect(request.request.method).toBe('POST');
    expect(panel.rows()[0].querySelector<HTMLButtonElement>('.row__paid')!.disabled).toBe(true);
    request.flush({
      id: 'a', name: 'Gym', category: null, amount: 38900, currency: 'COP', billingCycle: 'Monthly',
      nextBillingDate: '2026-11-18', status: 'Active', createdAt: '2026-09-01T00:00:00Z', updatedAt: '2026-10-20T15:00:00Z',
    });

    expect(toast.toasts()[0].message).toBe('"Gym" marked as paid. Next expected charge: Nov 18, 2026.');
    httpMock.expectOne(`${base}/upcoming`).flush({ referenceDate: '2026-10-20', items: [] });
  });
});
