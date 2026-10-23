import { AccountResponse } from './accounts.models';
import { totalsByCurrency } from './account-totals';

function account(overrides: Partial<AccountResponse>): AccountResponse {
  return {
    id: crypto.randomUUID(),
    name: 'Account',
    type: 'Bank',
    currency: 'COP',
    openingBalance: 0,
    balance: 0,
    isArchived: false,
    hasTransactions: false,
    createdAt: '2026-10-20T15:00:00Z',
    updatedAt: '2026-10-20T15:00:00Z',
    ...overrides,
  };
}

describe('totalsByCurrency', () => {
  it('adds cash, bank and savings per currency and keeps credit cards apart', () => {
    const totals = totalsByCurrency([
      account({ type: 'Cash', balance: 200000 }),
      account({ type: 'Bank', balance: 1000000 }),
      account({ type: 'Savings', balance: 50000 }),
      account({ type: 'CreditCard', balance: -300000 }),
      account({ type: 'Bank', currency: 'USD', balance: 120.5 }),
    ]);

    expect(totals).toEqual([
      { currency: 'COP', inAccounts: 1250000, creditCards: -300000, hasCreditCards: true },
      { currency: 'USD', inAccounts: 120.5, creditCards: 0, hasCreditCards: false },
    ]);
  });

  it('ignores archived accounts', () => {
    const totals = totalsByCurrency([
      account({ balance: 100 }),
      account({ balance: 900, isArchived: true }),
      account({ currency: 'EUR', balance: 5, isArchived: true }),
    ]);

    expect(totals).toEqual([{ currency: 'COP', inAccounts: 100, creditCards: 0, hasCreditCards: false }]);
  });

  it('rounds to cents so floating point leftovers never show', () => {
    const totals = totalsByCurrency([
      account({ currency: 'USD', balance: 0.1 }),
      account({ currency: 'USD', balance: 0.2 }),
    ]);

    expect(totals[0].inAccounts).toBe(0.3);
  });
});
