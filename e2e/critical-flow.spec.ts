import { Page, expect, test } from '@playwright/test';

import { BrowserHealth } from './support/browser-health';
import { e2eSettings } from './support/settings';

// HU-48: recorrido crítico real en el navegador, del inicio de sesión a una respuesta de Insights con evidencia, más
// el aislamiento entre dos cuentas. Datos sintéticos; el flujo borra lo que crea.
const checkpoints = 'e2e/results/checkpoints';
const missingId = '00000000-0000-4000-8000-000000000000';

async function signIn(page: Page, account: 'A' | 'B'): Promise<void> {
  await page.goto('/app');
  await expect(page).toHaveURL(/\/auth\/login/);
  await page.getByRole('button', { name: 'Continue with secure sign-in' }).click();
  await page.getByRole('button', { name: `Sign in as Account ${account}` }).click();
  await expect(page).toHaveURL(/\/app$/);
}

async function signOut(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(`${e2eSettings.appOrigin}/`);
}

// Fecha en la zona de referencia del producto (America/Bogota, HU-04): en UTC, después de las 19:00 de Bogotá el
// día ya cambió y el cobro saldría de la ventana de aviso de 3 días.
function nextBillingDate(daysFromToday: number): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' })
    .format(new Date(Date.now() + daysFromToday * 86_400_000));
}

test('CriticalFlow_SignInToInsights_AndIsolation', async ({ page }) => {
  const health = new BrowserHealth(page);
  let subscriptionId = '';

  await test.step('signed out, /app asks to sign in', async () => {
    await page.goto('/app');
    await expect(page).toHaveURL(/\/auth\/login\?returnUrl=/);
  });

  await test.step('account A signs in and sees the empty overview', async () => {
    await signIn(page, 'A');
    await expect(page.getByText('No active subscriptions yet.')).toBeVisible();
  });

  await test.step('account A creates a subscription through the form', async () => {
    await page.goto('/app/subscriptions');
    await page.getByRole('button', { name: 'Add your first subscription' }).click();
    await page.getByLabel('Name').fill('Netflix');
    await page.getByLabel('Amount').fill('38900');
    await page.getByLabel('Currency').fill('COP');
    await page.getByLabel('Next billing date').fill(nextBillingDate(3));
    await page.getByRole('button', { name: 'Create subscription' }).click();

    const row = page.getByRole('row', { name: /Netflix/ });
    await expect(row).toBeVisible();
    const usageHref = await row.getByRole('link', { name: 'Usage' }).getAttribute('href');
    subscriptionId = usageHref?.match(/subscriptions\/([0-9a-f-]{36})\/usage/)?.[1] ?? '';
    expect(subscriptionId).not.toBe('');

    await page.goto('/app');
    await expect(page.locator('main')).toContainText('38,900');
    await page.screenshot({ path: `${checkpoints}/01-overview-account-a.png`, fullPage: true });
  });

  await test.step('Insights answers with evidence that matches the overview', async () => {
    await page.goto('/app/insights');
    await page.getByRole('button', { name: 'How much do I spend per month on subscriptions?' }).click();
    await expect(page.locator('.result')).toHaveAttribute('aria-busy', 'true');
    const figure = page.locator('.figures li').filter({ hasText: 'Monthly equivalent' });
    await expect(figure).toContainText('38,900');
    await expect(page.locator('.result')).toHaveAttribute('aria-busy', 'false');
    await page.screenshot({ path: `${checkpoints}/02-insights-answer.png`, fullPage: true });

    await page.locator('.sources').getByRole('link', { name: 'Overview' }).click();
    await expect(page).toHaveURL(/\/app\/summary$/);
    await expect(page.locator('main')).toContainText('38,900');
  });

  await test.step('bounded states: unsupported question and unknown subscription', async () => {
    await page.goto('/app/insights');
    await page.getByLabel('Your question').fill('Tell me a joke');
    await page.getByRole('button', { name: 'Ask', exact: true }).click();
    await expect(page.locator('.result .answer')).toHaveText(/^I can only answer questions about your FlowTrim subscriptions/);

    health.expect(`/api/subscriptions/${missingId}`);
    await page.goto(`/app/subscriptions/${missingId}/edit`);
    await expect(page.getByRole('alert')).toHaveText('Subscription not found.');
    await expect(page.locator('form')).toHaveCount(0);
  });

  await test.step('signing out closes the workspace', async () => {
    await signOut(page);
    await page.goto('/app');
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  await test.step('account B cannot see account A data', async () => {
    await signIn(page, 'B');
    await page.goto('/app/subscriptions');
    await expect(page.getByText('No subscriptions yet.')).toBeVisible();
    await page.screenshot({ path: `${checkpoints}/03-account-b-empty.png`, fullPage: true });

    health.expect(`/api/subscriptions/${subscriptionId}`);
    await page.goto(`/app/subscriptions/${subscriptionId}/edit`);
    await expect(page.getByRole('alert')).toHaveText('Subscription not found.');
    await expect(page.locator('main')).not.toContainText('Netflix');
    await signOut(page);
  });

  await test.step('account A signs in again, gets the charge alert and deletes its data', async () => {
    await signIn(page, 'A');
    await expect(page.locator('app-toast-item').filter({ hasText: '1 charge needs attention' })).toBeVisible();

    await page.goto('/app/subscriptions');
    await page.getByRole('row', { name: /Netflix/ }).getByRole('button', { name: 'Delete' }).click();
    const dialog = page.getByRole('dialog', { name: 'Delete subscription?' });
    await dialog.getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByText('No subscriptions yet.')).toBeVisible();
  });

  expect(health.unexpected(), 'unexpected console errors or failed requests').toEqual([]);
});
