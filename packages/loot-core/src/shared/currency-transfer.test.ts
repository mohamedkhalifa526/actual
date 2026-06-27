import { describe, expect, it } from 'vitest';

import {
  computeBudgetAmount,
  computeCounterpartyAmount,
  computeExchangeRate,
  computeExchangeRateToMain,
  convertRatesFromBaseConversion,
  getAccountCurrency,
  getBudgetAmountForTransferLeg,
  getAllowedAccountCurrencies,
  canEditTransactionBudgetAmount,
  isForeignCurrencyAccount,
  needsBudgetAmountForTransaction,
  parseCurrencyExchangeRates,
  serializeCurrencyExchangeRates,
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

  it('converts provider base rates to budget exchange rates', () => {
    expect(
      convertRatesFromBaseConversion(
        { USD: 1, EUR: 0.8778, GBP: 0.7573 },
        'USD',
        ['EUR', 'GBP'],
      ),
    ).toEqual({
      EUR: 1.1392,
      GBP: 1.3205,
    });
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

    expect(
      needsBudgetAmountForTransaction(
        { category: 'cat1' },
        foreignOnBudget,
        null,
        'USD',
        'EUR',
        false,
        { EUR: 1.08 },
      ),
    ).toBe(false);
  });

  it('parses and serializes exchange rates', () => {
    expect(parseCurrencyExchangeRates('{"EUR":1.08,"GBP":"1.27"}')).toEqual({
      EUR: 1.08,
      GBP: 1.27,
    });
    expect(parseCurrencyExchangeRates('{"JPY":0.0182}')).toEqual({
      JPY: 0.0182,
    });
    expect(
      serializeCurrencyExchangeRates({ EUR: 1.08, GBP: 1.27 }),
    ).toBe('{"EUR":1.08,"GBP":1.27}');
    expect(serializeCurrencyExchangeRates({ JPY: 0.0182 })).toBe(
      '{"JPY":0.0182}',
    );
  });

  it('normalizes exchange rates to 4 decimal places', () => {
    expect(parseCurrencyExchangeRates('{"JPY":0.018234}')).toEqual({
      JPY: 0.0182,
    });
    expect(computeExchangeRateToMain(-54321, -987)).toBe(0.0182);
  });

  it('lists allowed account currencies', () => {
    expect(getAllowedAccountCurrencies('USD', { EUR: 1.08 })).toEqual([
      'EUR',
      'USD',
    ]);
  });

  it('allows editing budget amount for eligible foreign transactions', () => {
    const foreignOnBudget = { currency: 'EUR', offbudget: 0 };

    expect(
      canEditTransactionBudgetAmount(
        { category: 'cat1' },
        foreignOnBudget,
        null,
        'USD',
        'EUR',
        false,
      ),
    ).toBe(true);

    expect(
      canEditTransactionBudgetAmount(
        { category: 'cat1', budget_amount: 10800 },
        foreignOnBudget,
        null,
        'USD',
        'EUR',
        false,
      ),
    ).toBe(true);

    expect(
      canEditTransactionBudgetAmount(
        { category: 'cat1' },
        { currency: null, offbudget: 0 },
        null,
        'USD',
        'USD',
        false,
      ),
    ).toBe(false);
  });
});
