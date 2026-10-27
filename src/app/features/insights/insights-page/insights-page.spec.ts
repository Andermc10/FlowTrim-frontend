import { HttpHeaders, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { environment } from '../../../../environments/environment';
import { InsightsAnswer } from '../insights.models';
import { InsightsPage } from './insights-page';

const url = `${environment.apiUrl}/api/insights/questions`;

const answered: InsightsAnswer = {
  status: 'answered',
  answer: 'Gastas 38.900 COP al mes.\nY 10 USD.',
  figures: [
    { kind: 'monthly_equivalent', label: 'Monthly equivalent', value: 38900, currency: 'COP' },
    { kind: 'savings', label: 'Potential savings', value: 466800, currency: 'COP', months: 12 },
    { kind: 'upcoming_charge', label: 'Expected charge', subject: 'Netflix', value: 38900, currency: 'COP', date: '2026-10-21' },
    { kind: 'declared_uses', label: 'Declared uses', subject: 'Netflix', value: 4 },
    { kind: 'future_kind', label: 'Future figure', value: 1, currency: 'USD' },
  ],
  assumptions: [
    { key: 'no_conversion', text: 'Each currency is reported separately; currencies are never combined or converted.' },
    { key: 'other', text: 'A new backend assumption.' },
  ],
  sources: ['summary', 'usage-records'],
  toolsUsed: ['get_spending_summary'],
};

describe('InsightsPage', () => {
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [InsightsPage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    vi.useRealTimers();
  });

  function render() {
    const fixture = TestBed.createComponent(InsightsPage);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const textarea = element.querySelector('textarea')!;
    const submit = element.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    const type = (text: string) => {
      textarea.value = text;
      textarea.dispatchEvent(new Event('input'));
      fixture.detectChanges();
    };
    const refresh = () => fixture.detectChanges();
    return { fixture, element, textarea, submit, type, refresh };
  }

  function ask(page: ReturnType<typeof render>, text = 'How much do I spend?'): TestRequest {
    page.type(text);
    page.submit.click();
    page.refresh();
    return httpMock.expectOne(url);
  }

  function fail(request: TestRequest, status: number, headers: Record<string, string> = {}) {
    request.flush({ status, correlationId: 'corr-123' }, { status, statusText: 'Error', headers: new HttpHeaders(headers) });
  }

  it('submits the translated suggestion once and renders the evidence in Spanish', () => {
    localStorage.setItem('flowtrim-language', 'es');
    const page = render();

    const suggestion = page.element.querySelector<HTMLButtonElement>('.suggestions button')!;
    suggestion.click();
    page.refresh();

    const request = httpMock.expectOne(url);
    expect(request.request.body).toEqual({ question: '¿Cuánto gasto al mes en suscripciones?' });
    request.flush(answered);
    page.refresh();

    const text = page.element.textContent!;
    expect(page.element.querySelector('.answer')?.textContent).toBe('Gastas 38.900 COP al mes.\nY 10 USD.');
    expect(text).toContain('Equivalente mensual');
    expect(text).toMatch(/\$\s?38\.900/);
    expect(text).toContain('12 mes(es)');
    const date = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeZone: 'UTC' }).format(Date.UTC(2026, 9, 21));
    expect(text).toContain(`Netflix · ${date}`);
    expect(text).toContain('Future figure');
    expect(text).toContain('Cada moneda se muestra por separado');
    expect(text).toContain('A new backend assumption.');
    const links = [...page.element.querySelectorAll<HTMLAnchorElement>('.sources a')];
    expect(links.map((link) => link.getAttribute('href'))).toEqual(['/app/summary']);
    expect(page.element.querySelector('.sources .chip--static')?.textContent).toContain('Registros de uso');
    expect(page.element.querySelector('details')?.textContent).toContain('get_spending_summary');
  });

  it('shows the translated fixed message for unsupported questions and hides the server answer', () => {
    const page = render();

    ask(page, 'Tell me a joke').flush({ ...answered, status: 'unsupported', answer: 'Server text', figures: [], assumptions: [], sources: [], toolsUsed: [] });
    page.refresh();

    expect(page.element.textContent).toContain('I can only answer questions about your FlowTrim money');
    expect(page.element.textContent).not.toContain('Server text');
  });

  it('shows the answer and the subscriptions hint for no_data without a figure list', () => {
    const page = render();

    ask(page, 'What does Disney cost per use?').flush({ ...answered, status: 'no_data', answer: 'I could not find Disney.', figures: [] });
    page.refresh();

    expect(page.element.querySelector('.answer')?.textContent).toBe('I could not find Disney.');
    expect(page.element.querySelector('.hint a')?.getAttribute('href')).toBe('/app/subscriptions');
    expect(page.element.querySelector('.figures')).toBeNull();
  });

  it('translates the fixed no_data message when no tool call was accepted', () => {
    localStorage.setItem('flowtrim-language', 'es');
    const page = render();

    ask(page).flush({ ...answered, status: 'no_data', answer: 'FlowTrim could not get data.', figures: [], assumptions: [], sources: [], toolsUsed: [] });
    page.refresh();

    expect(page.element.querySelector('.answer')?.textContent).toContain('FlowTrim no pudo obtener datos');
  });

  it('does not send empty, whitespace-only or too long questions', () => {
    const page = render();

    for (const text of ['', '   ', 'a'.repeat(501)]) {
      page.type(text);
      expect(page.submit.disabled).toBe(true);
      page.submit.click();
    }

    httpMock.expectNone(url);
    expect(page.textarea.getAttribute('maxlength')).toBe('500');
  });

  it('disables submit while pending and cancel aborts the request keeping the question', () => {
    const page = render();
    const request = ask(page, 'How much do I spend?');

    expect(page.submit.disabled).toBe(true);
    expect(page.element.querySelector('.result')?.getAttribute('aria-busy')).toBe('true');
    expect(page.element.querySelector('.card--loading')?.textContent).toContain('How much do I spend?');

    const cancel = [...page.element.querySelectorAll('button')].find((button) => button.textContent?.trim() === 'Cancel')!;
    cancel.click();
    page.refresh();

    expect(request.cancelled).toBe(true);
    expect(page.element.querySelector('.card--loading')).toBeNull();
    expect(page.textarea.value).toBe('How much do I spend?');
    expect(page.submit.disabled).toBe(false);
  });

  it('counts down from Retry-After and keeps submit disabled until it ends', () => {
    vi.useFakeTimers();
    const page = render();

    fail(ask(page), 429, { 'Retry-After': '30' });
    vi.advanceTimersByTime(0);
    page.refresh();

    expect(page.element.querySelector('[role="alert"]')?.textContent).toContain('You can ask again in 30 s.');
    expect(page.submit.disabled).toBe(true);

    vi.advanceTimersByTime(10_000);
    page.refresh();
    expect(page.element.querySelector('[role="alert"]')?.textContent).toContain('in 20 s.');

    vi.advanceTimersByTime(20_000);
    page.refresh();
    expect(page.element.querySelector('[role="alert"]')).toBeNull();
    expect(page.submit.disabled).toBe(false);
  });

  it.each([
    [502, 'The assistant is not available right now.'],
    [504, 'The assistant took too long to answer.'],
  ])('shows the specific provider error %i with its reference and keeps the question', (status, message) => {
    const page = render();

    fail(ask(page, 'Am I overspending?'), status, { 'X-Correlation-ID': 'corr-123' });
    page.refresh();

    const alert = page.element.querySelector('[role="alert"]')!;
    expect(alert.textContent).toContain(message);
    expect(alert.textContent).toContain('Reference: corr-123');
    expect(page.textarea.value).toBe('Am I overspending?');
  });

  it('renders markup in the answer as literal text', () => {
    const page = render();

    ask(page).flush({ ...answered, answer: '<img src=x onerror=alert(1)>' });
    page.refresh();

    const answer = page.element.querySelector('.answer')!;
    expect(answer.textContent).toBe('<img src=x onerror=alert(1)>');
    expect(answer.querySelector('img')).toBeNull();
  });

  it('submits with Enter but not with Shift+Enter', () => {
    const page = render();
    page.type('How much do I spend?');

    page.textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true }));
    httpMock.expectNone(url);

    page.textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    httpMock.expectOne(url).flush(answered);
  });
});
