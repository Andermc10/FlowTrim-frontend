import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { routes } from '../../app.routes';
import { authGuard } from '../../core/auth/auth.guard';
import { InsightsService } from './insights-service';

describe('InsightsService', () => {
  it('posts the question to the insights endpoint of the FlowTrim API', () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const httpMock = TestBed.inject(HttpTestingController);

    TestBed.inject(InsightsService).ask('How much do I spend?').subscribe();

    const request = httpMock.expectOne(`${environment.apiUrl}/api/insights/questions`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ question: 'How much do I spend?' });
    httpMock.verify();
  });
});

describe('Insights route', () => {
  it('requires a session: it is a lazy child of the guarded workspace', () => {
    const workspace = routes.find((route) => route.path === 'app');
    const insights = workspace?.children?.find((route) => route.path === 'insights');

    expect(workspace?.canActivate).toContain(authGuard);
    expect(insights?.loadComponent).toBeDefined();
  });
});
