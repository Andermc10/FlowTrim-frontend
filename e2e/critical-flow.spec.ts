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
    await page.getByRole('button', { name: 'Add your first recurring payment' }).click();
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
    await page.getByRole('button', { name: 'Create payment' }).click();

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
    await expect(page.locator('.result .answer')).toHaveText(/^I can only answer questions about your FlowTrim money/);

    health.expect(`/api/subscriptions/${missingId}`);
    await page.goto(`/app/subscriptions/${missingId}/edit`);
    await expect(page.getByRole('alert')).toHaveText('Recurring payment not found.');
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
    await expect(page.getByText('No recurring payments yet.')).toBeVisible();
    await page.screenshot({ path: `${checkpoints}/03-account-b-empty.png`, fullPage: true });

    health.expect(`/api/subscriptions/${subscriptionId}`);
    await page.goto(`/app/subscriptions/${subscriptionId}/edit`);
    await expect(page.getByRole('alert')).toHaveText('Recurring payment not found.');
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
    // EP-14 HU-73: sin cuentas en COP el diálogo solo permite mover la fecha y lo explica.
    const payDialog = page.getByRole('dialog', { name: 'Mark as paid' });
    await expect(payDialog.getByRole('note')).toContainText('no active account in COP');
    await payDialog.getByRole('button', { name: 'Move next date' }).click();
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

    // EP-15 HU-76: un presupuesto de Comida de 40.000 pasa a "cerca del límite" con un gasto de 35.000 y se ve en Hoy.
    await page.getByRole('link', { name: 'Budgets' }).first().click();
    await page.getByRole('button', { name: 'Create your first budget' }).click();
    const budgetDialog = page.getByRole('dialog', { name: 'New budget' });
    await budgetDialog.getByText('Food', { exact: true }).click();
    await budgetDialog.getByLabel('Monthly limit').fill('40000');
    await budgetDialog.getByRole('button', { name: 'Create budget' }).click();
    await expect(page.locator('.card').filter({ hasText: 'Food' })).toContainText('0 % · On track');
    await page.locator('main h1').click();
    await page.keyboard.press('n');
    const quickAdd = page.getByRole('dialog', { name: 'Quick add' });
    await quickAdd.locator('#tx-amount').fill('35000');
    await quickAdd.getByText('Food', { exact: true }).click();
    await quickAdd.getByRole('button', { name: 'Save transaction' }).click();
    await expect(quickAdd).toHaveCount(0);
    await expect(page.locator('.card').filter({ hasText: 'Food' })).toContainText('87.5 % · Close to the limit');
    await page.getByRole('link', { name: 'Today' }).first().click();
    await expect(page.locator('.panel--budgets')).toContainText('Food');
    // EP-16 HU-80: el asistente responde sobre los presupuestos con la misma cifra que la página.
    await page.goto('/app/insights');
    await page.getByRole('button', { name: 'How are my budgets?' }).click();
    await expect(page.locator('.result')).toHaveAttribute('aria-busy', 'false');
    await expect(page.locator('.figures li').filter({ hasText: 'Spent' })).toContainText('35,000');
    await expect(page.locator('.sources').getByRole('link', { name: 'Budgets' })).toHaveAttribute('href', '/app/budgets');
    // EP-16 HU-78: el estado de cuenta del mes refleja ese gasto en Comida.
    await page.goto('/app/analytics/statement');
    await expect(page.getByRole('tab', { name: 'Statement' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('.block').filter({ hasText: 'COP' })).toContainText('−COP 35,000');
    await expect(page.locator('.categories')).toContainText('Food');
    await page.goto('/app/transactions');
    await row.filter({ hasText: 'COP 35,000' }).getByRole('button', { name: /Delete transaction/ }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete transaction' }).click();
    await expect(row).toHaveCount(0);

    // EP-14 HU-73: marcar Gym como pagado registra el gasto en Bank y queda en "Últimos pagos" del pago.
    await page.goto('/app/subscriptions');
    await page.getByRole('row', { name: /Gym/ }).getByRole('button', { name: 'Mark as paid' }).click();
    const payDialog = page.getByRole('dialog', { name: 'Mark as paid' });
    await expect(payDialog.getByLabel('Pay from')).toHaveValue(/.+/);
    await payDialog.getByText('Health', { exact: true }).click();
    await payDialog.getByLabel('Amount paid (COP)').fill('91500');
    await payDialog.getByRole('button', { name: 'Record payment' }).click();
    await expect(page.locator('app-toast-item').filter({ hasText: 'for "Gym" recorded in Bank' })).toBeVisible();
    await page.getByRole('row', { name: /Gym/ }).getByRole('button', { name: 'Edit' }).click();
    await expect(page.getByRole('dialog').locator('.payments')).toContainText('COP 91,500');
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();

    await page.goto('/app/transactions');
    await expect(row).toHaveCount(1);
    await expect(row).toContainText('Gym');
    await expect(row).toContainText('-COP 91,500');
    await row.getByRole('button', { name: /Delete transaction/ }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete transaction' }).click();
    await expect(row).toHaveCount(0);

    // EP-16 HU-79: un CSV del banco con un gasto y un ingreso se importa a Bank; reimportarlo no duplica nada.
    await page.goto('/app/transactions/import');
    const bankCsv = {
      name: 'bank.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(`date,description,amount
${nextBillingDate(0)},Bakery,-12000
${nextBillingDate(0)},Refund,50000
`),
    };
    await page.locator('#bank-file').setInputFiles(bankCsv);
    await expect(page.locator('.counts--valid')).toContainText('2');
    await page.getByRole('button', { name: 'Add 2 movements' }).click();
    await expect(page.locator('.done')).toContainText('2');
    await page.getByRole('button', { name: 'Import another file' }).click();
    await page.locator('#bank-file').setInputFiles(bankCsv);
    await expect(page.locator('.counts--duplicate')).toContainText('2');
    await page.goto('/app/transactions');
    await expect(row).toHaveCount(2);
    for (let remaining = 2; remaining > 0; remaining--) {
      await row.first().getByRole('button', { name: /Delete transaction/ }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Delete transaction' }).click();
      await expect(row).toHaveCount(remaining - 1);
    }

    await page.goto('/app/accounts');
    await page.getByRole('button', { name: 'Delete account: Bank' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete account' }).click();
    await expect(page.getByText('You have no accounts yet.')).toBeVisible();
  });

  await test.step('EP-14 HU-72: a weekly bill with a payment link', async () => {
    await page.goto('/app/subscriptions');
    await page.getByRole('button', { name: 'Add payment' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Type').selectOption('Bill');
    await dialog.getByLabel('Name').fill('Water bill');
    await dialog.getByLabel('Amount').fill('25000');
    await dialog.getByLabel('Billing cycle').selectOption('Weekly');
    await dialog.getByLabel('Next billing date').fill(nextBillingDate(2));
    await dialog.getByLabel('Payment link').fill('http://pay.example.com');
    await dialog.getByLabel('Payment link').blur();
    await expect(dialog.getByText('Use an https:// address without a user name or password')).toBeVisible();
    await dialog.getByLabel('Payment link').fill('https://pay.example.com/water');
    await dialog.getByRole('button', { name: 'Create payment' }).click();

    const row = page.getByRole('row', { name: /Water bill/ });
    await expect(row.locator('.kind-badge')).toHaveText('Bill');
    await expect(row.getByRole('cell', { name: 'Weekly', exact: true })).toBeVisible();
    await expect(row.getByRole('link', { name: /Pay at provider/ })).toHaveAttribute('href', 'https://pay.example.com/water');
    await page.getByLabel('Filter by type').selectOption('Bill');
    await expect(page.locator('tbody tr')).toHaveCount(1);
    await page.getByLabel('Filter by type').selectOption('');
  });

  await test.step('EP-14 HU-75: the calendar places the weekly bill on its day', async () => {
    const due = nextBillingDate(2);
    await page.getByRole('link', { name: 'Calendar' }).first().click();
    await expect(page.getByRole('heading', { name: 'What is due, day by day.' })).toBeVisible();
    if (due.slice(0, 7) !== nextBillingDate(0).slice(0, 7)) {
      await page.getByRole('button', { name: 'Next month' }).click();
    }
    const day = Number(due.slice(8));
    await page.locator('.grid .cell:not(.cell--blank)').nth(day - 1).click();
    const panel = page.locator('.panel');
    await expect(panel).toContainText('Water bill');
    await expect(panel).toContainText('COP 25,000');
    await expect(panel.getByRole('link', { name: /Pay at provider/ })).toHaveAttribute('href', 'https://pay.example.com/water');
    await page.screenshot({ path: `${checkpoints}/10-calendar.png`, fullPage: true });
  });

  await test.step('EP-14 HU-74: paying the last instalment completes the plan', async () => {
    await page.goto('/app/subscriptions');
    await page.getByRole('button', { name: 'Add payment' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Type').selectOption('Instalment');
    await dialog.getByLabel('Name').fill('Laptop');
    await dialog.getByLabel('Amount').fill('250000');
    await dialog.getByLabel('Next billing date').fill(nextBillingDate(1));
    await dialog.getByLabel('Number of instalments').fill('2');
    await dialog.getByLabel('Instalments already paid').fill('1');
    await dialog.getByRole('button', { name: 'Create payment' }).click();

    const row = page.getByRole('row', { name: /Laptop/ });
    await expect(row.locator('.instalments')).toHaveText('1 of 2 paid');
    await row.getByRole('button', { name: 'Mark as paid' }).click();
    await page.getByRole('dialog', { name: 'Mark as paid' }).getByRole('button', { name: 'Move next date' }).click();
    await expect(page.locator('app-toast-item').filter({ hasText: '"Laptop" is fully paid' })).toBeVisible();
    await expect(row.locator('.instalments')).toHaveText('2 of 2 paid');
    await expect(row.locator('.status')).toHaveText('Completed');
  });

  await test.step('EP-15 HU-77: a savings goal with a contribution', async () => {
    await page.getByRole('link', { name: 'Goals' }).first().click();
    await page.getByRole('button', { name: 'Create your first goal' }).click();
    const goalDialog = page.getByRole('dialog', { name: 'New goal' });
    await goalDialog.getByLabel('Name').fill('Trip');
    await goalDialog.getByLabel('Target amount').fill('1000000');
    await goalDialog.getByRole('button', { name: 'Create goal' }).click();
    const card = page.locator('.card').filter({ hasText: 'Trip' });
    await expect(card).toContainText('0 %');

    await card.getByRole('button', { name: 'Add or withdraw' }).click();
    const contribution = page.getByRole('dialog', { name: 'Add or withdraw: Trip' });
    await contribution.getByLabel('Amount (COP)').fill('250000');
    await contribution.getByRole('button', { name: 'Save' }).click();
    await expect(card).toContainText('25 %');
    await expect(card).toContainText('COP 250,000');

    await card.getByRole('button', { name: 'Delete goal: Trip' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete goal' }).click();
    await expect(page.getByText('No savings goals yet.')).toBeVisible();
  });

  await test.step('account A deletes its data', async () => {
    await page.goto('/app/subscriptions');
    for (const name of ['Netflix', 'Gym', 'Cloud Storage', 'Water bill', 'Laptop']) {
      await page.getByRole('row', { name: new RegExp(name) }).getByRole('button', { name: 'Delete' }).click();
      const dialog = page.getByRole('dialog', { name: 'Delete recurring payment?' });
      await dialog.getByRole('button', { name: 'Delete' }).click();
      await expect(page.getByRole('row', { name: new RegExp(name) })).toHaveCount(0);
    }
    await expect(page.getByText('No recurring payments yet.')).toBeVisible();
  });

  expect(health.unexpected(), 'unexpected console errors or failed requests').toEqual([]);
});
