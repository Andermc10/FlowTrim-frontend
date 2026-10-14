import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { SummaryResponse } from './summary.models';
import { SummaryService } from './summary-service';

describe('SummaryService', () => {
  let service: SummaryService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(SummaryService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('GETs /api/summary and returns the per-currency totals', () => {
    let result: SummaryResponse | undefined;
    service.getSummary().subscribe((response) => (result = response));

    const httpRequest = httpMock.expectOne(`${environment.apiUrl}/api/summary`);
    expect(httpRequest.request.method).toBe('GET');
    httpRequest.flush({
      currencies: [
        { currency: 'COP', monthlyEquivalent: 48900, annualProjection: 586800, activeCount: 2 },
      ],
    } satisfies SummaryResponse);

    expect(result?.currencies.length).toBe(1);
    expect(result?.currencies[0].currency).toBe('COP');
  });
});
