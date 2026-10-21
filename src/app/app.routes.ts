import { Routes } from '@angular/router';

import { AppShell } from './app-shell';
import { NotFound } from './not-found';
import { Landing } from './features/landing/landing';
import { SubscriptionForm } from './features/subscriptions/subscription-form/subscription-form';
import { SubscriptionList } from './features/subscriptions/subscription-list/subscription-list';
import { Usage } from './features/subscriptions/usage/usage';
import { UpcomingPanel } from './features/subscriptions/upcoming-panel/upcoming-panel';
import { SummaryDashboard } from './features/summary/summary-dashboard/summary-dashboard';
import { Simulator } from './features/simulator/simulator/simulator';
import { Login } from './features/auth/login';
import { AuthCallback } from './features/auth/callback';
import { authGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  { path: '', component: Landing },
  { path: 'auth/login', component: Login },
  { path: 'auth/callback', component: AuthCallback },
  {
    path: 'app',
    component: AppShell,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', component: SummaryDashboard },
      { path: 'subscriptions', component: SubscriptionList },
      { path: 'subscriptions/new', component: SubscriptionForm },
      // Carga diferida: la importación CSV (HU-46) solo se descarga al abrirla.
      {
        path: 'subscriptions/import',
        loadComponent: () => import('./features/imports/import-page/import-page').then((m) => m.ImportPage),
      },
      { path: 'subscriptions/:id/edit', component: SubscriptionForm },
      { path: 'subscriptions/:id/usage', component: Usage },
      { path: 'upcoming', component: UpcomingPanel },
      { path: 'summary', component: SummaryDashboard },
      { path: 'simulator', component: Simulator },
      // Carga diferida: Chart.js solo se descarga al abrir la analítica (mantiene el bundle inicial < 500 kB).
      {
        path: 'analytics',
        loadComponent: () => import('./features/analytics/analytics-page/analytics-page').then((m) => m.AnalyticsPage),
      },
      // Carga diferida: Insights solo se descarga al abrirlo.
      {
        path: 'insights',
        loadComponent: () => import('./features/insights/insights-page/insights-page').then((m) => m.InsightsPage),
      },
      {
        path: 'report',
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
