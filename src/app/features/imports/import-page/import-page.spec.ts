import { HttpHeaders, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { environment } from '../../../../environments/environment';
import { ToastService } from '../../../core/ui/toast/toast.service';
import { SubscriptionImportPreview } from '../imports.models';
import { ImportsService } from '../imports-service';
import { ImportPage } from './import-page';

const previewUrl = `${environment.apiUrl}/api/subscription-imports/preview`;
const confirmUrl = `${environment.apiUrl}/api/subscription-imports/confirm`;

const preview: SubscriptionImportPreview = {
  rows: [
    {
      rowNumber: 2,
      status: 'valid',
      values: { name: '=Cloud, "Pro"', category: 'Tools', amount: 38900, currency: 'COP', billingCycle: 'Monthly', nextBillingDate: '2026-11-05', status: 'Active' },
      errors: [],
    },
    {
      rowNumber: 3,
      status: 'invalid',
      values: null,
      errors: [
        { field: 'amount', code: 'invalid_amount', message: 'Server amount message.' },
        { field: 'currency', code: 'future_code', message: 'Server message for a new code.' },
      ],
    },
    {
      rowNumber: 4,
      status: 'duplicate',
      values: { name: 'Netflix', category: null, amount: 16.99, currency: 'USD', billingCycle: 'Yearly', nextBillingDate: '2026-12-01', status: 'Inactive' },
      errors: [],
      duplicateOf: 'existing',
    },
    {
      rowNumber: 5,
      status: 'duplicate',
      values: { name: 'cloud', category: null, amount: 1, currency: 'COP', billingCycle: 'Monthly', nextBillingDate: '2026-11-05', status: 'Active' },
      errors: [],
      duplicateOf: 'file',
      duplicateOfRow: 2,
    },
  ],
  summary: { total: 4, valid: 1, invalid: 1, duplicate: 2 },
  ignoredColumns: ['notes'],
};

describe('ImportPage', () => {
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [ImportPage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  function render() {
    const fixture = TestBed.createComponent(ImportPage);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const input = element.querySelector<HTMLInputElement>('input[type="file"]')!;
    const refresh = () => fixture.detectChanges();
    const pick = (file: File) => {
      // jsdom no permite asignar files: se define la propiedad como lo haría el selector del sistema.
      Object.defineProperty(input, 'files', { configurable: true, value: [file] });
      input.dispatchEvent(new Event('change'));
      refresh();
    };
    const button = (text: string) =>
      [...element.querySelectorAll<HTMLButtonElement>('button')].find((candidate) => candidate.textContent?.includes(text));
    return { fixture, element, input, refresh, pick, button };
  }

  function countsOf(element: HTMLElement): string[] {
    return [...element.querySelectorAll('.counts li')].map((item) => item.textContent!.replace(/\s+/g, ' ').trim());
  }

  function csv(name = 'subscriptions.csv'): File {
    return new File(['name,amount,currency,billing_cycle,next_billing_date\n'], name, { type: 'text/csv' });
  }

  function previewOf(page: ReturnType<typeof render>, file = csv()): TestRequest {
    page.pick(file);
    return httpMock.expectOne(previewUrl);
  }

  it('ImportView_InvalidFile_ShowsActionableError', () => {
    const page = render();

    page.pick(new File(['x'], 'notes.txt'));

    httpMock.expectNone(previewUrl);
    expect(page.element.querySelector('[role="alert"]')?.textContent).toContain('Choose a file with the .csv extension.');
    expect(page.button('Choose another file')).toBeDefined();
  });

  it('ImportView_Preview_ShowsStatusesAndReasons', () => {
    const page = render();

    const request = previewOf(page);
    expect(page.element.querySelector('[role="status"]')?.textContent).toContain('Checking the file');
    expect(page.input.disabled).toBe(true);
    request.flush(preview);
    page.refresh();

    const rows = [...page.element.querySelectorAll('tbody tr')];
    expect(rows.map((row) => row.querySelector('.row-status')?.textContent?.trim())).toEqual(['Valid', 'Invalid', 'Duplicate', 'Duplicate']);
    // El texto del archivo se muestra tal cual, nunca interpretado.
    expect(rows[0].textContent).toContain('=Cloud, "Pro"');
    expect(rows[0].textContent).toContain('Will be created');
    expect(rows[1].textContent).toContain('must use digits with a dot');
    expect(rows[1].textContent).toContain('Server message for a new code.');
    expect(rows[2].textContent).toContain('Already in your subscriptions');
    expect(rows[2].textContent).toMatch(/US\$|\$16\.99/);
    expect(rows[3].textContent).toContain('Same as row 2');
    expect(countsOf(page.element)).toEqual(['4 rows', '1 will be created', '1 invalid', '2 duplicates']);
    expect(page.element.textContent).toContain('Ignored columns: notes');
  });

  it('ImportView_NoValidRows_DisablesConfirm', () => {
    const page = render();

    previewOf(page).flush({ ...preview, summary: { total: 4, valid: 0, invalid: 2, duplicate: 2 } });
    page.refresh();

    expect(page.button('Create subscriptions (0)')?.disabled).toBe(true);
    expect(page.element.textContent).toContain('There is nothing to create');
  });

  it('ImportView_ConfirmationDoesNotPersistBeforeSubmit', () => {
    const page = render();

    previewOf(page).flush(preview);
    page.refresh();

    // Solo la vista previa: ninguna confirmación hasta el clic.
    httpMock.expectNone(confirmUrl);
    expect(page.button('Create subscriptions (1)')?.disabled).toBe(false);
  });

  it('ImportView_Confirm_SendsSameFileAndShowsCounts', () => {
    const toast = TestBed.inject(ToastService);
    const page = render();
    const confirmed = vi.spyOn(TestBed.inject(ImportsService), 'confirm');
    const file = csv();
    previewOf(page, file).flush(preview);
    page.refresh();

    page.button('Create subscriptions (1)')!.click();
    page.refresh();
    const request = httpMock.expectOne(confirmUrl);
    // Se reenvía el mismo objeto File elegido para la vista previa (D4).
    expect(confirmed).toHaveBeenCalledWith(file);
    expect(page.element.querySelector('[role="status"]')?.textContent).toContain('Creating subscriptions');
    request.flush({ total: 4, created: 1, invalid: 1, duplicate: 2 });
    page.refresh();

    expect(page.element.textContent).toContain('Import finished');
    expect(countsOf(page.element)).toEqual(['1 created', '1 skipped as invalid', '2 skipped as duplicates']);
    expect(page.element.textContent).not.toContain('The preview expected');
    expect(page.element.querySelector('.done a')?.getAttribute('href')).toBe('/app/subscriptions');
    expect(toast.toasts()[0].message).toBe('Subscriptions imported: 1');
  });

  it('ImportView_Confirm_WhenDataChanged_ExplainsTheDifference', () => {
    const page = render();
    previewOf(page).flush(preview);
    page.refresh();

    page.button('Create subscriptions (1)')!.click();
    httpMock.expectOne(confirmUrl).flush({ total: 4, created: 0, invalid: 1, duplicate: 3 });
    page.refresh();

    expect(page.element.textContent).toContain('The preview expected 1');
  });

  it('ImportView_FileErrorCode_IsTranslated', () => {
    localStorage.setItem('flowtrim-language', 'es');
    const page = render();

    previewOf(page).flush(
      { code: 'missing_columns', detail: 'Missing required columns: amount.' },
      { status: 400, statusText: 'Bad Request' },
    );
    page.refresh();

    expect(page.element.querySelector('[role="alert"]')?.textContent).toContain('La primera fila debe incluir name, amount');
  });

  it('ImportView_BodyLimit413WithoutCode_ShowsTooLarge', () => {
    const page = render();

    previewOf(page).flush({ title: 'Payload Too Large' }, { status: 413, statusText: 'Payload Too Large' });
    page.refresh();

    expect(page.element.querySelector('[role="alert"]')?.textContent).toContain('larger than 256 KB');
  });

  it('ImportView_ServerError_ShowsReferenceAndRetries', () => {
    const page = render();
    previewOf(page).flush(preview);
    page.refresh();
    page.button('Create subscriptions (1)')!.click();

    httpMock.expectOne(confirmUrl).flush(
      { correlationId: 'body-ref' },
      { status: 500, statusText: 'Server Error', headers: new HttpHeaders({ 'X-Correlation-ID': 'corr-500' }) },
    );
    page.refresh();

    const alert = page.element.querySelector('[role="alert"]')!;
    expect(alert.textContent).toContain('Nothing was saved');
    expect(alert.textContent).toContain('Reference: corr-500');

    page.button('Retry')!.click();
    page.refresh();
    httpMock.expectOne(confirmUrl).flush({ total: 4, created: 1, invalid: 1, duplicate: 2 });
    page.refresh();
    expect(page.element.textContent).toContain('Import finished');
  });

  it('ImportView_NetworkErrorOnPreview_RetriesThePreview', () => {
    const page = render();

    previewOf(page).error(new ProgressEvent('error'));
    page.refresh();
    expect(page.element.querySelector('[role="alert"]')?.textContent).toContain('Cannot reach the server');

    page.button('Retry')!.click();
    httpMock.expectOne(previewUrl).flush(preview);
    page.refresh();
    expect(page.element.querySelectorAll('tbody tr').length).toBe(4);
  });

  it('ImportView_ChooseAnotherFile_ResetsState', () => {
    const page = render();
    previewOf(page).flush(preview);
    page.refresh();
    const opened = vi.spyOn(page.input, 'click').mockImplementation(() => undefined);

    page.button('Choose another file')!.click();
    expect(opened).toHaveBeenCalled();

    // Elegir un archivo nuevo descarta la vista previa anterior y pide una nueva.
    const second = previewOf(page, csv('other.csv'));
    expect(page.element.querySelector('table')).toBeNull();
    expect(page.element.textContent).toContain('other.csv');
    second.flush({ ...preview, rows: [], summary: { total: 0, valid: 0, invalid: 0, duplicate: 0 } });
  });

  it('ImportView_SecondPickWhilePreviewing_CancelsTheFirstRequest', () => {
    const page = render();
    const first = previewOf(page);

    // El input está deshabilitado mientras carga, pero un cambio programático no debe dejar dos peticiones vivas.
    page.input.disabled = false;
    const second = previewOf(page, csv('second.csv'));

    expect(first.cancelled).toBe(true);
    second.flush(preview);
  });

  it('ImportView_Template_DownloadsHeaderAndExample', async () => {
    const page = render();
    const created = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:template');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const clicked = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    page.button('Download template')!.click();

    const blob = created.mock.calls[0][0] as Blob;
    const text = await blob.text();
    expect(text.split('\r\n').slice(0, 2)).toEqual(['sep=,', 'name,amount,currency,billing_cycle,next_billing_date,category,status']);
    expect(text).toContain('Example Streaming');
    expect(clicked).toHaveBeenCalled();
    vi.restoreAllMocks();
  });
});
