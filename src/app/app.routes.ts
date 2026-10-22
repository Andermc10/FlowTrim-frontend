import { Routes } from '@angular/router';

import { NotFound } from './not-found';
import { Landing } from './features/landing/landing';
import { Login } from './features/auth/login';
import { AuthCallback } from './features/auth/callback';
import { authGuard } from './core/auth/auth.guard';

// El landing y el inicio de sesión van en el bundle inicial; todo el workspace se carga al entrar en él, así el
// visitante del landing no descarga pantallas que todavía no puede usar (presupuesto inicial de 500 kB).
// `title` es una clave de traducción que muestra TranslatedTitleStrategy.
export const routes: Routes = [
  { path: '', component: Landing },
  { path: 'auth/login', component: Login },
  { path: 'auth/callback', component: AuthCallback },
  {
    path: 'app',
    loadComponent: () => import('./app-shell').then((m) => m.AppShell),
    canActivate: [authGuard],
    children: [
      {
        path: '',
        pathMatch: 'full',
        title: 'nav.overview',
        loadComponent: () => import('./features/summary/summary-dashboard/summary-dashboard').then((m) => m.SummaryDashboard),
      },
      {
        path: 'subscriptions',
        title: 'nav.subscriptions',
        loadComponent: () => import('./features/subscriptions/subscription-list/subscription-list').then((m) => m.SubscriptionList),
      },
      {
        path: 'subscriptions/new',
        title: 'nav.addSubscription',
        loadComponent: () => import('./features/subscriptions/subscription-form/subscription-form').then((m) => m.SubscriptionForm),
      },
      {
        path: 'subscriptions/import',
        title: 'imports.open',
        loadComponent: () => import('./features/imports/import-page/import-page').then((m) => m.ImportPage),
      },
      {
        path: 'subscriptions/:id/edit',
        title: 'subscriptions.edit',
        loadComponent: () => import('./features/subscriptions/subscription-form/subscription-form').then((m) => m.SubscriptionForm),
      },
      {
        path: 'subscriptions/:id/usage',
        title: 'subscriptions.usage',
        loadComponent: () => import('./features/subscriptions/usage/usage').then((m) => m.Usage),
      },
      {
        path: 'upcoming',
        title: 'nav.upcoming',
        loadComponent: () => import('./features/subscriptions/upcoming-panel/upcoming-panel').then((m) => m.UpcomingPanel),
      },
      {
        path: 'summary',
        title: 'nav.overview',
        loadComponent: () => import('./features/summary/summary-dashboard/summary-dashboard').then((m) => m.SummaryDashboard),
      },
      {
        path: 'simulator',
        title: 'nav.simulator',
        loadComponent: () => import('./features/simulator/simulator/simulator').then((m) => m.Simulator),
      },
      // Chart.js solo se descarga al abrir la analítica o el reporte.
      {
        path: 'analytics',
        title: 'nav.analytics',
        loadComponent: () => import('./features/analytics/analytics-page/analytics-page').then((m) => m.AnalyticsPage),
      },
      {
        path: 'insights',
        title: 'nav.insights',
        loadComponent: () => import('./features/insights/insights-page/insights-page').then((m) => m.InsightsPage),
      },
      {
        path: 'report',
        title: 'nav.report',
        loadComponent: () => import('./features/reports/report-page/report-page').then((m) => m.ReportPage),
      },
    ],
  },
  { path: 'new', redirectTo: 'app/subscriptions/new', pathMatch: 'full' },
  { path: 'upcoming', redirectTo: 'app/upcoming', pathMatch: 'full' },
  { path: 'summary', redirectTo: 'app/summary', pathMatch: 'full' },
  { path: 'simulator', redirectTo: 'app/simulator', pathMatch: 'full' },
  { path: ':id/edit', redirectTo: 'app/subscriptions/:id/edit', pathMatch: 'full' },
  { path: ':id/usage', redirectTo: 'app/subscriptions/:id/usage', pathMatch: 'full' },
  { path: '**', component: NotFound },
];
