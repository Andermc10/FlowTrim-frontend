import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { ToastHost } from './toast-host';
import { ToastService } from './toast.service';

describe('ToastHost', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    TestBed.configureTestingModule({ imports: [ToastHost], providers: [provideRouter([])] });
  });

  afterEach(() => vi.useRealTimers());

  function render() {
    const fixture = TestBed.createComponent(ToastHost);
    const toasts = TestBed.inject(ToastService);
    return { fixture, toasts, element: fixture.nativeElement as HTMLElement };
  }

  it('renders a polite region with alert roles for errors and status roles for confirmations', () => {
    const { fixture, toasts, element } = render();

    toasts.success('Saved');
    toasts.error('Failed', { reference: 'ref-1' });
    fixture.detectChanges();

    expect(element.querySelector('.toast-stack')?.getAttribute('aria-live')).toBe('polite');
    const items = Array.from(element.querySelectorAll('app-toast-item'));
    expect(items.map((item) => item.getAttribute('role'))).toEqual(['alert', 'status']);
    expect(items[0].textContent).toContain('ref-1');
  });

  it('auto-dismisses after the variant duration and pauses while hovered', () => {
    const { fixture, toasts, element } = render();
    toasts.success('Saved');
    fixture.detectChanges();
    const item = element.querySelector('app-toast-item') as HTMLElement;

    vi.advanceTimersByTime(3000);
    item.dispatchEvent(new Event('mouseenter'));
    vi.advanceTimersByTime(10_000);
    expect(toasts.toasts().length).toBe(1);

    item.dispatchEvent(new Event('mouseleave'));
    vi.advanceTimersByTime(1100);
    expect(toasts.toasts().length).toBe(0);
  });

  it('keeps sticky toasts until the close button is used', () => {
    const { fixture, toasts, element } = render();
    toasts.error('Overdue', { duration: null });
    fixture.detectChanges();

    vi.advanceTimersByTime(60_000);
    expect(toasts.toasts().length).toBe(1);

    (element.querySelector('.toast__close') as HTMLButtonElement).click();
    expect(toasts.toasts().length).toBe(0);
  });

  it('dismisses the focused toast with Escape', () => {
    const { fixture, toasts, element } = render();
    toasts.info('Hello');
    fixture.detectChanges();

    element.querySelector('app-toast-item')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(toasts.toasts().length).toBe(0);
  });

  it('summarizes toasts beyond the visible limit', () => {
    const { fixture, toasts, element } = render();
    ['a', 'b', 'c', 'd'].forEach((message) => toasts.info(message));
    fixture.detectChanges();

    expect(element.querySelectorAll('app-toast-item').length).toBe(3);
    expect(element.querySelector('.toast-more')?.textContent).toContain('+1 more');
  });
});
