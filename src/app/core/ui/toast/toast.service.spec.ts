import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';

import { ToastService, maxVisibleToasts, toastDurations } from './toast.service';

describe('ToastService', () => {
  let service: ToastService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(ToastService);
  });

  afterEach(() => vi.useRealTimers());

  it('adds toasts newest first with the default title and duration of their variant', () => {
    service.success('Saved');
    service.error('Failed');

    const [newest, oldest] = service.toasts();
    expect(newest.variant).toBe('error');
    expect(newest.title).toBe('Something went wrong');
    expect(newest.duration).toBe(toastDurations.error);
    expect(oldest.title).toBe('Done');
    expect(oldest.duration).toBe(toastDurations.success);
  });

  it('keeps at most three visible and counts the rest', () => {
    ['a', 'b', 'c', 'd', 'e'].forEach((message) => service.info(message));

    expect(service.visible().length).toBe(maxVisibleToasts);
    expect(service.visible().map((toast) => toast.message)).toEqual(['e', 'd', 'c']);
    expect(service.hiddenCount()).toBe(2);
  });

  it('merges identical toasts raised within one second', () => {
    vi.useFakeTimers();
    const first = service.success('Saved');
    const second = service.success('Saved');
    vi.advanceTimersByTime(1500);
    const third = service.success('Saved');

    expect(second).toBe(first);
    expect(third).not.toBe(first);
    expect(service.toasts().length).toBe(2);
  });

  it('dismisses a toast by id and supports sticky toasts', () => {
    const id = service.warning('Careful', { duration: null, title: 'Custom' });

    expect(service.toasts()[0]).toMatchObject({ title: 'Custom', duration: null });
    service.dismiss(id);
    expect(service.toasts()).toEqual([]);
  });

  it('turns an http error into a translated toast with the correlation reference', () => {
    const headers = new HttpHeaders({ 'X-Correlation-ID': 'ref-42' });

    service.httpError(new HttpErrorResponse({ status: 500, headers }));
    service.httpError(new HttpErrorResponse({ status: 0 }));

    const [network, server] = service.toasts();
    expect(server.message).toBe('The action could not be completed. Please try again.');
    expect(server.reference).toBe('ref-42');
    expect(network.message).toContain('Cannot reach the server');
    expect(network.reference).toBeNull();
  });
});
