import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { BackToTop, backToTopThreshold } from './back-to-top';

@Component({
  imports: [BackToTop],
  template: `<main><h1>Your subscriptions</h1></main><app-back-to-top />`,
})
class Host {}

describe('BackToTop', () => {
  afterEach(() => {
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
    vi.restoreAllMocks();
  });

  function render() {
    localStorage.clear();
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const button = element.querySelector<HTMLButtonElement>('button.back-to-top')!;
    const scrollTo = (y: number) => {
      Object.defineProperty(window, 'scrollY', { configurable: true, value: y });
      window.dispatchEvent(new Event('scroll'));
      fixture.detectChanges();
    };
    return { fixture, element, button, scrollTo };
  }

  it('stays hidden and out of the tab order until the page is scrolled past the threshold', () => {
    const page = render();

    expect(page.button.classList.contains('is-visible')).toBe(false);
    expect(page.button.getAttribute('aria-hidden')).toBe('true');
    expect(page.button.tabIndex).toBe(-1);

    page.scrollTo(backToTopThreshold + 1);

    expect(page.button.classList.contains('is-visible')).toBe(true);
    expect(page.button.getAttribute('aria-hidden')).toBe('false');
    expect(page.button.tabIndex).toBe(0);
    expect(page.button.getAttribute('aria-label')).toBe('Back to top');
  });

  it('scrolls to the top and moves focus to the main heading', () => {
    const page = render();
    const scroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    page.scrollTo(2000);

    page.button.click();

    expect(scroll).toHaveBeenCalledWith(expect.objectContaining({ top: 0 }));
    const heading = page.element.querySelector('h1')!;
    expect(document.activeElement).toBe(heading);
    expect(heading.getAttribute('tabindex')).toBe('-1');
  });
});
