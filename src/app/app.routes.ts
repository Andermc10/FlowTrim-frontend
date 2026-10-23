import { Routes } from '@angular/router';

import { NotFound } from './not-found';
import { Landing } from './features/landing/landing';
import { Login } from './features/auth/login';
import { AuthCallback } from './features/auth/callback';
import { authGuard } from './core/auth/auth.guard';
import { AnalyticsSelection } from './features/analytics/analytics-selection';

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
        path: 'transactions',
        title: 'nav.transactions',
        loadComponent: () => import('./features/transactions/transactions-page/transactions-page').then((m) => m.TransactionsPage),
      },
      {
        path: 'accounts',
        title: 'nav.accounts',
        loadComponent: () => import('./features/accounts/accounts-page/accounts-page').then((m) => m.AccountsPage),
      },
      {
        path: 'categories',
        title: 'nav.categories',
        loadComponent: () => import('./features/categories/categories-page/categories-page').then((m) => m.CategoriesPage),
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
      // Analítica y reportes (HU-59): pestañas sobre los mismos datos; Chart.js solo se descarga al abrirlas.
      {
        path: 'analytics',
        loadComponent: () => import('./features/analytics/analytics-hub/analytics-hub').then((m) => m.AnalyticsHub),
        providers: [AnalyticsSelection],
        children: [
          {
            path: '',
            pathMatch: 'full',
            title: 'analytics.tabCharts',
            loadComponent: () => import('./features/analytics/analytics-page/analytics-page').then((m) => m.AnalyticsPage),
          },
          {
            path: 'report',
            title: 'analytics.tabReport',
            loadComponent: () => import('./features/reports/report-page/report-page').then((m) => m.ReportPage),
          },
        ],
      },
      {
        path: 'insights',
        title: 'nav.insights',
        loadComponent: () => import('./features/insights/insights-page/insights-page').then((m) => m.InsightsPage),
      },
      { path: 'report', redirectTo: 'analytics/report', pathMatch: 'full' },
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
