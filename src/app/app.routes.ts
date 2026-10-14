import { Routes } from '@angular/router';

import { SubscriptionForm } from './features/subscriptions/subscription-form/subscription-form';
import { SubscriptionList } from './features/subscriptions/subscription-list/subscription-list';

export const routes: Routes = [
  { path: '', component: SubscriptionList },
  { path: 'new', component: SubscriptionForm },
  { path: ':id/edit', component: SubscriptionForm },
];
