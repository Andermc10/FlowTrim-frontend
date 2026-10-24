/**
 * Datos de ejemplo del landing (EP-13 D3). Son ficticios, se muestran con la etiqueta "Datos de ejemplo" y siguen
 * exactamente las fórmulas de la app (EP-12 §5 y el simulador), para que cualquier cifra se pueda reproducir en el
 * workspace. Nada de aquí es un dato real ni una promesa.
 */
export const landingSample = (() => {
  const currency = 'COP';
  const accounts = [
    { name: 'Cash', type: 'Cash' as const, balance: 175000 },
    { name: 'Bank', type: 'Bank' as const, balance: 1000000 },
    { name: 'Visa', type: 'CreditCard' as const, balance: -300000 },
  ];
  // Disponible: efectivo, banco y ahorros; la tarjeta es dinero prestado y no cuenta.
  const available = accounts.filter((account) => account.type !== 'CreditCard').reduce((sum, account) => sum + account.balance, 0);
  const subscriptions = [
    { name: 'Netflix', amount: 38900, dueDay: 28, dueThisMonth: true },
    { name: 'Gym', amount: 90000, dueDay: 5, dueThisMonth: false },
    { name: 'Music', amount: 16900, dueDay: 12, dueThisMonth: false },
  ];
  // Cobros esperados hasta fin de mes: solo los que vencen antes de que termine (hoy es el día 22 de un mes de 31).
  const committed = subscriptions.filter((subscription) => subscription.dueThisMonth).reduce((sum, s) => sum + s.amount, 0);
  const daysLeft = 10;
  const safeToSpend = Math.max(0, Math.round(((available - committed) / daysLeft) * 100) / 100);
  const monthlyBurn = subscriptions.reduce((sum, subscription) => sum + subscription.amount, 0);
  const cancelled = subscriptions.find((subscription) => subscription.name === 'Gym')!;
  return {
    currency,
    accounts,
    available,
    owedOnCards: -accounts.filter((account) => account.type === 'CreditCard').reduce((sum, account) => sum + account.balance, 0),
    committed,
    daysLeft,
    safeToSpend,
    spentToday: 25000,
    quickAddAmount: 25000,
    subscriptions,
    nextCharge: subscriptions[0],
    nextChargeInDays: 6,
    monthlyBurn,
    cancelled,
    savings: [1, 12, 24].map((months) => ({ months, amount: cancelled.amount * months })),
  };
})();
