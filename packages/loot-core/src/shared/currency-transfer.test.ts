import { describe, expect, it } from 'vitest';

import {
  computeBudgetAmount,
  computeCounterpartyAmount,
  computeExchangeRate,
  computeExchangeRateToMain,
  getAccountCurrency,
  getBudgetAmountForTransferLeg,
  isCrossCurrencyTransfer,
  isForeignCurrencyAccount,
  needsBudgetAmountForTransaction,
} from './currency-transfer';

describe('currency-transfer', () => {
  it('uses account currency when set, otherwise budget default', () => {
    expect(getAccountCurrency({ currency: 'EUR' }, 'USD')).toBe('EUR');
    expect(getAccountCurrency({ currency: null }, 'USD')).toBe('USD');
    expect(getAccountCurrency(undefined, 'USD')).toBe('USD');
  });

  it('detects cross-currency transfers', () => {
    expect(
      isCrossCurrencyTransfer({ currency: 'EUR' }, { currency: 'USD' }, ''),
    ).toBe(true);
    expect(
      isCrossCurrencyTransfer({ currency: 'EUR' }, { currency: null }, 'USD'),
    ).toBe(true);
    expect(
      isCrossCurrencyTransfer({ currency: null }, { currency: null }, 'USD'),
    ).toBe(false);
  });

  it('computes counterparty amounts from exchange rate', () => {
    expect(computeCounterpartyAmount(-10000, 1.08)).toBe(10800);
    expect(computeCounterpartyAmount(10000, 1.08)).toBe(-10800);
  });

  it('derives exchange rate from transfer amounts', () => {
    expect(computeExchangeRate(-10000, 10800)).toBe(1.08);
    expect(computeExchangeRate(-10000, -10800)).toBeNull();
  });

  it('converts amounts to budget currency', () => {
    expect(computeBudgetAmount(-10000, 1.08)).toBe(-10800);
    expect(computeExchangeRateToMain(-10000, -10800)).toBe(1.08);
  });

  it('detects foreign currency accounts', () => {
    expect(isForeignCurrencyAccount({ currency: 'EUR' }, 'USD')).toBe(true);
    expect(isForeignCurrencyAccount({ currency: null }, 'USD')).toBe(false);
  });

  it('computes budget amount for transfer legs', () => {
    expect(
      getBudgetAmountForTransferLeg(-10000, 'EUR', 10800, 'USD', 'USD', 1.08),
    ).toBe(-10800);
    expect(
      getBudgetAmountForTransferLeg(10800, 'USD', -10000, 'EUR', 'USD', 1.08),
    ).toBeNull();
  });

  it('decides when budget amount prompt is needed', () => {
    const foreignOnBudget = { currency: 'EUR', offbudget: 0 };
    const mainOnBudget = { currency: null, offbudget: 0 };

    expect(
      needsBudgetAmountForTransaction(
        { category: 'cat1' },
        foreignOnBudget,
        null,
        'USD',
        'EUR',
        false,
      ),
    ).toBe(true);

    expect(
      needsBudgetAmountForTransaction(
        { category: 'cat1' },
        mainOnBudget,
        null,
        'USD',
        'USD',
        false,
      ),
    ).toBe(false);

    expect(
      needsBudgetAmountForTransaction(
        { category: 'cat1' },
        foreignOnBudget,
        foreignOnBudget,
        'USD',
        'EUR',
        true,
      ),
    ).toBe(false);
  });
});
