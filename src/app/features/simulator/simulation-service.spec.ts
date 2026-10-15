import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { SimulationResponse } from './simulation.models';
import { SimulationService } from './simulation-service';

describe('SimulationService', () => {
  let service: SimulationService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(SimulationService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('POSTs the simulation request to /api/simulations', () => {
    let result: SimulationResponse | undefined;
    service.simulate({ subscriptionIds: ['abc'], horizons: [1, 12, 24] }).subscribe((r) => (result = r));

    const httpRequest = httpMock.expectOne(`${environment.apiUrl}/api/simulations`);
    expect(httpRequest.request.method).toBe('POST');
    expect(httpRequest.request.body).toEqual({ subscriptionIds: ['abc'], horizons: [1, 12, 24] });
    httpRequest.flush({ horizons: [1, 12, 24], currencies: [], assumptions: ['Not guaranteed.'] });

    expect(result?.assumptions.length).toBe(1);
  });
});
