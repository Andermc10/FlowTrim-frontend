import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withInterceptors, withXhr } from '@angular/common/http';
import { TitleStrategy, provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { httpErrorInterceptor } from './core/http-error.interceptor';
import { authInterceptor } from './core/auth/auth.interceptor';
import { TranslatedTitleStrategy } from './core/i18n/translated-title-strategy';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    { provide: TitleStrategy, useExisting: TranslatedTitleStrategy },
    provideHttpClient(withXhr(), withInterceptors([authInterceptor, httpErrorInterceptor])),
  ],
};
