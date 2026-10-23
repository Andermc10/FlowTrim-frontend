import { readFile } from 'node:fs/promises';
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

  await test.step('account A signs in on Today and sees the first-use guide', async () => {
    await signIn(page, 'A');
    // EP-12 D9: /app es el panel Hoy; el resumen de suscripciones vive en /app/summary.
    await expect(page.getByRole('heading', { name: 'Add an account' })).toBeVisible();
    await page.goto('/app/summary');
    await expect(page.getByText('No active subscriptions yet.')).toBeVisible();
  });

  await test.step('account A creates a subscription through the form', async () => {
    await page.goto('/app/subscriptions');
    await page.getByRole('button', { name: 'Add your first subscription' }).click();
    await page.getByLabel('Name').fill('Netflix');

    // EP-11: los errores aparecen al salir del campo, sin pulsar Guardar, y desaparecen al corregir.
    await page.getByLabel('Amount').fill('-5');
    await page.getByLabel('Amount').blur();
    await expect(page.getByText('Amount must be greater than zero.')).toBeVisible();
    await page.getByLabel('Amount').fill('38900');
    await expect(page.getByText('Amount must be greater than zero.')).toHaveCount(0);
    await page.getByLabel('Next billing date').fill(nextBillingDate(-1));
    await expect(page.getByText('Next billing date cannot be in the past.')).toBeVisible();

    await page.getByLabel('Currency').fill('COP');
    await page.getByLabel('Next billing date').fill(nextBillingDate(3));
    await page.getByRole('button', { name: 'Create subscription' }).click();

    const row = page.getByRole('row', { name: /Netflix/ });
    await expect(row).toBeVisible();
    const usageHref = await row.getByRole('link', { name: 'Usage' }).getAttribute('href');
    subscriptionId = usageHref?.match(/subscriptions\/([0-9a-f-]{36})\/usage/)?.[1] ?? '';
    expect(subscriptionId).not.toBe('');

    await page.goto('/app/summary');
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

  await test.step('account A signs in again and gets the charge alert', async () => {
    await signIn(page, 'A');
    await expect(page.locator('app-toast-item').filter({ hasText: '1 charge needs attention' })).toBeVisible();
  });

  await test.step('account A imports a CSV: preview first, then only the valid rows are created', async () => {
    await page.goto('/app/subscriptions');
    await page.getByRole('link', { name: 'Import CSV' }).click();
    await expect(page).toHaveURL(/\/app\/subscriptions\/import$/);

    // Fechas lejanas: no cambian la alerta de cobros del paso anterior.
    const csv =
      'name,amount,currency,billing_cycle,next_billing_date,status\n' +
      `Gym,90000,COP,Monthly,${nextBillingDate(20)},Active\n` +
      `netflix,38900,COP,Monthly,${nextBillingDate(20)},Active\n` +
      `Cloud Storage,120,USD,Yearly,${nextBillingDate(40)},Inactive\n`;
    await page.getByLabel('Choose CSV file').setInputFiles({ name: 'subscriptions.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });

    const rows = page.locator('tbody tr');
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(1)).toContainText('Duplicate');
    await expect(rows.nth(1)).toContainText('Already in your subscriptions');
    await page.screenshot({ path: `${checkpoints}/04-import-preview.png`, fullPage: true });

    await page.getByRole('button', { name: 'Create subscriptions (2)' }).click();
    await expect(page.locator('.done')).toContainText('Import finished');
    await expect(page.locator('.done .counts li').first()).toHaveText(/2\s+created/);

    await page.getByRole('link', { name: 'View subscriptions' }).click();
    await expect(page.getByRole('row', { name: /Gym/ })).toBeVisible();
    await expect(page.getByRole('row', { name: /Cloud Storage/ })).toContainText('Inactive');
    await expect(page.getByRole('row', { name: /Netflix/i })).toHaveCount(1);
  });

  await test.step('the downloaded template previews as valid', async () => {
    await page.goto('/app/subscriptions/import');
    await page.getByText('File format').click();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Download template' }).click(),
    ]);
    // Playwright guarda la descarga sin extensión: se sube su contenido con el nombre sugerido por la app.
    expect(download.suggestedFilename()).toBe('flowtrim-import-template.csv');
    await page.getByLabel('Choose CSV file').setInputFiles({
      name: download.suggestedFilename(),
      mimeType: 'text/csv',
      buffer: await readFile(await download.path()),
    });

    // La plantilla trae sep=, y fechas calculadas desde hoy: sus cuatro ejemplos son válidos (no se confirma).
    const rows = page.locator('tbody tr');
    await expect(rows).toHaveCount(4);
    await expect(page.locator('tbody .row-status--valid')).toHaveCount(4);
  });

  await test.step('account A marks the due charge as paid and reads the report tab', async () => {
    await page.goto('/app/upcoming');
    const netflix = page.locator('li.row').filter({ hasText: 'Netflix' });
    await netflix.getByRole('button', { name: 'Mark as paid' }).click();
    await expect(page.locator('app-toast-item').filter({ hasText: '"Netflix" marked as paid' })).toBeVisible();
    // Un mes después ya no está en la ventana de aviso: el botón desaparece.
    await expect(netflix.getByRole('button', { name: 'Mark as paid' })).toHaveCount(0);

    await page.goto('/app/report');
    await expect(page).toHaveURL(/\/app\/analytics\/report$/);
    await expect(page.getByRole('tab', { name: 'Report' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('main')).toContainText('Netflix');
    await page.getByRole('tab', { name: 'Charts' }).click();
    await expect(page).toHaveURL(/\/app\/analytics$/);
  });

  await test.step('account A records an expense with quick add and Today updates without a reload', async () => {
    // EP-12: cuenta → registro rápido solo con teclado (HU-67 AC-1) → el panel Hoy cambia → el movimiento está listado.
    await page.goto('/app/accounts');
    await page.getByRole('button', { name: 'Add your first account' }).click();
    const accountDialog = page.getByRole('dialog', { name: 'New account' });
    await accountDialog.getByLabel('Name').fill('Bank');
    await accountDialog.getByLabel('Opening balance').fill('500000');
    await accountDialog.getByRole('button', { name: 'Create account' }).click();
    await expect(page.locator('li.account').filter({ hasText: 'Bank' })).toContainText('COP 500,000');

    await page.getByRole('link', { name: 'Today' }).first().click();
    const spentToday = page.locator('.tile').filter({ hasText: 'Spent today' });
    await expect(spentToday).toContainText('COP 0');
    await page.locator('main h1').click();
    await page.keyboard.press('n');
    await expect(page.locator('#tx-amount')).toBeFocused();
    await page.keyboard.type('38900');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog', { name: 'Quick add' })).toHaveCount(0);
    await expect(spentToday).toContainText('COP 38,900');
    await expect(page.locator('.formula')).toContainText('COP 461,100');
    await page.screenshot({ path: `${checkpoints}/09-today-after-quick-add.png`, fullPage: true });

    await page.goto('/app/transactions');
    const row = page.locator('li.row');
    await expect(row).toHaveCount(1);
    await expect(row).toContainText('-COP 38,900');
    await row.getByRole('button', { name: /Delete transaction/ }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete transaction' }).click();
    await expect(row).toHaveCount(0);

    await page.goto('/app/accounts');
    await page.getByRole('button', { name: 'Delete account: Bank' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete account' }).click();
    await expect(page.getByText('You have no accounts yet.')).toBeVisible();
  });

  await test.step('account A deletes its data', async () => {
    await page.goto('/app/subscriptions');
    for (const name of ['Netflix', 'Gym', 'Cloud Storage']) {
      await page.getByRole('row', { name: new RegExp(name) }).getByRole('button', { name: 'Delete' }).click();
      const dialog = page.getByRole('dialog', { name: 'Delete subscription?' });
      await dialog.getByRole('button', { name: 'Delete' }).click();
      await expect(page.getByRole('row', { name: new RegExp(name) })).toHaveCount(0);
    }
    await expect(page.getByText('No subscriptions yet.')).toBeVisible();
  });

  expect(health.unexpected(), 'unexpected console errors or failed requests').toEqual([]);
});
