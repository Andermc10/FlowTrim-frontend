import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';

import { environment } from '../../../../environments/environment';
import { SubscriptionForm } from './subscription-form';

describe('SubscriptionForm (edit)', () => {
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('flowtrim-language', 'es');
    TestBed.configureTestingModule({
      imports: [SubscriptionForm],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: 'missing-id' }) } } },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    // Cuentas y categorías para los valores por defecto (EP-14 HU-72): se responden vacías.
    httpMock
      .match((request) => /\/api\/(accounts|categories)$/.test(request.url))
      .forEach((request) => request.flush([]));
    httpMock.verify();
  });

  function load(status: number) {
    const fixture = TestBed.createComponent(SubscriptionForm);
    fixture.detectChanges();
    httpMock
      .expectOne(`${environment.apiUrl}/api/subscriptions/missing-id`)
      .flush({ status }, { status, statusText: 'Error' });
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows the translated not-found message and hides the form for a 404', () => {
    const element = load(404);

    expect(element.querySelector('[role="alert"]')?.textContent).toContain('Pago recurrente no encontrado.');
    expect(element.querySelector('form')).toBeNull();
  });

  it('shows the translated load error for other failures', () => {
    const element = load(500);

    expect(element.querySelector('[role="alert"]')?.textContent).toContain('No se pudo cargar el pago recurrente.');
    expect(element.querySelector('form')).toBeNull();
  });
});
