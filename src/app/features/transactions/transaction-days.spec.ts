import { TransactionResponse } from './transactions.models';
import { groupByDay, monthRange, shiftMonth } from './transaction-days';

function tx(overrides: Partial<TransactionResponse>): TransactionResponse {
  return {
    id: crypto.randomUUID(),
    type: 'Expense',
    accountId: 'bank',
    accountName: 'Bank',
    toAccountId: null,
    toAccountName: null,
    categoryId: 'food',
    categoryName: 'Food',
    categoryColor: 'orange',
    categoryIcon: 'food',
    amount: 10,
    currency: 'COP',
    date: '2026-10-20',
    description: null,
    note: null,
    createdAt: '2026-10-20T15:00:00Z',
    updatedAt: '2026-10-20T15:00:00Z',
    ...overrides,
  };
}

describe('transaction days', () => {
  it('groups consecutive dates and nets income minus expenses per currency, ignoring transfers', () => {
    const days = groupByDay([
      tx({ date: '2026-10-20', type: 'Income', amount: 5000 }),
      tx({ date: '2026-10-20', amount: 38900.1 }),
      tx({ date: '2026-10-20', type: 'Transfer', amount: 100000, categoryId: null }),
      tx({ date: '2026-10-20', currency: 'USD', amount: 0.2 }),
      tx({ date: '2026-10-18', amount: 0.1 }),
    ]);

    expect(days.map((day) => day.date)).toEqual(['2026-10-20', '2026-10-18']);
    expect(days[0].items).toHaveLength(4);
    expect(days[0].net).toEqual([{ currency: 'COP', amount: -33900.1 }, { currency: 'USD', amount: -0.2 }]);
    expect(days[1].net).toEqual([{ currency: 'COP', amount: -0.1 }]);
  });

  it('computes inclusive month ranges, including leap years', () => {
    expect(monthRange('2026-10')).toEqual({ from: '2026-10-01', to: '2026-10-31' });
    expect(monthRange('2028-02')).toEqual({ from: '2028-02-01', to: '2028-02-29' });
    expect(monthRange('2026-02')).toEqual({ from: '2026-02-01', to: '2026-02-28' });
  });

  it('shifts months across year boundaries', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
  });
});
