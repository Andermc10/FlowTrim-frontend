import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../../environments/environment';
import { ToastService } from '../../../core/ui/toast/toast.service';
import { AlertWindow, UpcomingChargeItem } from '../models/subscription.models';
import { UpcomingAlertService, upcomingAlertShownKey } from './upcoming-alert-service';

const url = `${environment.apiUrl}/api/subscriptions/upcoming`;

function item(name: string, daysUntilCharge: number, alertWindow: AlertWindow): UpcomingChargeItem {
  return { id: name, name, amount: 10000, currency: 'COP', billingCycle: 'Monthly', nextBillingDate: '2026-10-20', daysUntilCharge, alertWindow };
}

describe('UpcomingAlertService', () => {
  let service: UpcomingAlertService;
  let toasts: ToastService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(UpcomingAlertService);
    toasts = TestBed.inject(ToastService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  function respond(items: UpcomingChargeItem[]): void {
    service.checkOnce();
    httpMock.expectOne(url).flush({ referenceDate: '2026-10-18', items });
  }

  it('warns once about charges due today and within three days, listing their names', () => {
    respond([item('Spotify', 2, 'DueWithin3Days'), item('Netflix', 0, 'Today'), item('Gym', 10, 'Later')]);

    const toast = toasts.toasts()[0];
    expect(toasts.toasts().length).toBe(1);
    expect(toast.variant).toBe('warning');
    expect(toast.title).toBe('2 charges need attention');
    expect(toast.message).toBe('Expected charges: Netflix (today), Spotify (in 2 days)');
    expect(toast.action).toEqual({ label: 'View upcoming charges', route: '/app/upcoming' });
    expect(toast.duration).not.toBeNull();
  });

  it('uses a sticky error toast when something is overdue', () => {
    respond([item('Gym', -1, 'Overdue'), item('Netflix', 1, 'DueWithin3Days')]);

    const toast = toasts.toasts()[0];
    expect(toast.variant).toBe('error');
    expect(toast.duration).toBeNull();
    expect(toast.message).toBe('Expected charges: Gym (overdue by 1 day), Netflix (tomorrow)');
  });

  it('does not show anything when charges are seven or more days away', () => {
    respond([item('Gym', 5, 'DueWithin7Days'), item('Cloud', 40, 'Later')]);

    expect(toasts.toasts()).toEqual([]);
  });

  it('lists at most three names and summarizes the rest', () => {
    respond([
      item('A', 0, 'Today'), item('B', 1, 'DueWithin3Days'), item('C', 2, 'DueWithin3Days'),
      item('D', 3, 'DueWithin3Days'), item('E', -4, 'Overdue'),
    ]);

    expect(toasts.toasts()[0].title).toBe('5 charges need attention');
    expect(toasts.toasts()[0].message).toBe('Expected charges: E (overdue by 4 days), A (today), B (tomorrow) +2 more');
  });

  it('checks only once per session and again after a reset (sign-out)', () => {
    respond([item('Netflix', 0, 'Today')]);
    service.checkOnce();
    httpMock.expectNone(url);
    expect(sessionStorage.getItem(upcomingAlertShownKey)).toBe('true');

    service.reset();
    respond([item('Netflix', 0, 'Today')]);
    expect(toasts.toasts().length).toBe(1);
  });

  it('stays silent when the request fails', () => {
    service.checkOnce();
    httpMock.expectOne(url).flush(null, { status: 500, statusText: 'Server Error' });

    expect(toasts.toasts()).toEqual([]);
  });
});
