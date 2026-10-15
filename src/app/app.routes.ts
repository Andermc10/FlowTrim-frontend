import { Routes } from '@angular/router';

import { SubscriptionForm } from './features/subscriptions/subscription-form/subscription-form';
import { SubscriptionList } from './features/subscriptions/subscription-list/subscription-list';
import { UpcomingPanel } from './features/subscriptions/upcoming-panel/upcoming-panel';
import { SummaryDashboard } from './features/summary/summary-dashboard/summary-dashboard';

export const routes: Routes = [
  { path: '', component: SubscriptionList },
  { path: 'new', component: SubscriptionForm },
  { path: 'upcoming', component: UpcomingPanel },
  { path: 'summary', component: SummaryDashboard },
  { path: ':id/edit', component: SubscriptionForm },
];
