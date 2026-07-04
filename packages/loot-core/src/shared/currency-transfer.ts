import type { AccountEntity } from '#types/models';

export const EXCHANGE_RATE_DECIMAL_PLACES = 4;
const EXCHANGE_RATE_SCALE = 10 ** EXCHANGE_RATE_DECIMAL_PLACES;

/** Round a rate to 4 decimal places (e.g. 0.0182). */
export function normalizeExchangeRate(rate: number): number | null {
  if (!Number.isFinite(rate) || rate <= 0) {
    return null;
  }
  return Math.round(rate * EXCHANGE_RATE_SCALE) / EXCHANGE_RATE_SCALE;
}

export function formatExchangeRate(rate: number | null | undefined): string {
  const normalized = normalizeExchangeRate(rate ?? NaN);
  if (normalized == null) {
    return '';
  }
  return normalized.toFixed(EXCHANGE_RATE_DECIMAL_PLACES);
}

export function isValidExchangeRateInput(value: string): boolean {
  return /^(\d+([.,]\d{0,4})?)?$/.test(value.trim());
}

export function parseExchangeRateInput(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const parsed = Number(trimmed.replace(',', '.'));
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return normalizeExchangeRate(parsed);
}

export function getAccountCurrency(
  account: Pick<AccountEntity, 'currency'> | null | undefined,
  defaultCurrencyCode = '',
): string {
  const code = account?.currency?.trim();
  if (code) {
    return code;
  }
  return defaultCurrencyCode.trim();
}

export function isCrossCurrencyTransfer(
  fromAccount: Pick<AccountEntity, 'currency'> | null | undefined,
  toAccount: Pick<AccountEntity, 'currency'> | null | undefined,
  defaultCurrencyCode = '',
): boolean {
  const from = getAccountCurrency(fromAccount, defaultCurrencyCode);
  const to = getAccountCurrency(toAccount, defaultCurrencyCode);
  return from !== '' && to !== '' && from !== to;
}

/** Counterparty amount for a transfer given source amount and FX rate. */
export function computeCounterpartyAmount(
  sourceAmount: number,
  exchangeRate: number,
): number {
  if (!sourceAmount || !exchangeRate) {
    return -sourceAmount;
  }

  const sign = sourceAmount < 0 ? 1 : -1;
  return sign * Math.round(Math.abs(sourceAmount) * exchangeRate);
}

export function computeExchangeRate(
  sourceAmount: number,
  destAmount: number,
): number | null {
  if (!sourceAmount || !destAmount) {
    return null;
  }
  if (Math.sign(sourceAmount) === Math.sign(destAmount)) {
    return null;
  }

  const rate = Math.abs(destAmount) / Math.abs(sourceAmount);
  return normalizeExchangeRate(rate);
}

export function isForeignCurrencyAccount(
  account: Pick<AccountEntity, 'currency'> | null | undefined,
  mainCurrencyCode = '',
): boolean {
  const main = mainCurrencyCode.trim();
  if (!main) {
    return false;
  }
  return getAccountCurrency(account, mainCurrencyCode) !== main;
}

/** Convert an account-currency amount to the budget (main) currency. */
export function computeBudgetAmount(
  amount: number,
  exchangeRateToMain: number,
): number {
  if (!amount || !exchangeRateToMain) {
    return amount;
  }

  const sign = Math.sign(amount) || 1;
  return sign * Math.round(Math.abs(amount) * exchangeRateToMain);
}

export function computeExchangeRateToMain(
  amount: number,
  budgetAmount: number,
): number | null {
  if (!amount || !budgetAmount) {
    return null;
  }
  if (Math.sign(amount) !== Math.sign(budgetAmount)) {
    return null;
  }

  const rate = Math.abs(budgetAmount) / Math.abs(amount);
  return normalizeExchangeRate(rate);
}

const mainCurrencySubquery = `(SELECT COALESCE(value, '') FROM preferences WHERE id = 'defaultCurrencyCode' LIMIT 1)`;

function exchangeRateSubquery(currencyExpr: string): string {
  return `(SELECT json_extract(value, '$.' || ${currencyExpr})
           FROM preferences
           WHERE id = 'currencyExchangeRates'
           LIMIT 1)`;
}

export function buildMainAmountSqlExpression(
  amountExpr: string,
  budgetAmountExpr: string,
  accountCurrencyExpr: string,
): string {
  const rateExpr = exchangeRateSubquery(accountCurrencyExpr);
  return `COALESCE(
    ${budgetAmountExpr},
    CASE
      WHEN ${accountCurrencyExpr} IS NOT NULL
        AND ${accountCurrencyExpr} != ''
        AND ${accountCurrencyExpr} != ${mainCurrencySubquery}
        AND ${rateExpr} IS NOT NULL
      THEN (CASE WHEN ${amountExpr} < 0 THEN -1 ELSE 1 END) * CAST(ROUND(ABS(${amountExpr}) * ${rateExpr}) AS INTEGER)
      ELSE ${amountExpr}
    END
  )`;
}

export function mainAmountSqlExpressionForTransaction(): string {
  return buildMainAmountSqlExpression(
    'IFNULL(_.amount, 0)',
    '_.budget_amount',
    '__main_acct.currency',
  );
}

/** SQL expression for budget category sums (main currency). */
export const budgetAmountSqlExpression = buildMainAmountSqlExpression(
  't.amount',
  't.budget_amount',
  'a.currency',
);

export type CurrencyExchangeRates = Record<string, number>;

export function parseCurrencyExchangeRates(
  value: string | null | undefined,
): CurrencyExchangeRates {
  if (!value) {
    return {};
  }

  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }

    const rates: CurrencyExchangeRates = {};
    for (const [code, rate] of Object.entries(parsed)) {
      const normalizedCode = code.trim();
      const numericRate =
        typeof rate === 'number' ? rate : Number.parseFloat(String(rate));
      const normalizedRate = normalizeExchangeRate(numericRate);
      if (normalizedCode && normalizedRate != null) {
        rates[normalizedCode] = normalizedRate;
      }
    }
    return rates;
  } catch {
    return {};
  }
}

export function serializeCurrencyExchangeRates(
  rates: CurrencyExchangeRates,
): string {
  const normalized: CurrencyExchangeRates = {};
  for (const [code, rate] of Object.entries(rates)) {
    const normalizedCode = code.trim();
    const normalizedRate = normalizeExchangeRate(rate);
    if (normalizedCode && normalizedRate != null) {
      normalized[normalizedCode] = normalizedRate;
    }
  }
  return JSON.stringify(normalized);
}

/**
 * Convert provider rates in "1 base = X quote" form to Actual's
 * "1 quote = Y base" exchange rates used in {@link CurrencyExchangeRates}.
 */
export function convertRatesFromBaseConversion(
  conversionRates: Record<string, number>,
  baseCurrency: string,
  targetCurrencies: string[],
): CurrencyExchangeRates {
  const base = baseCurrency.trim().toUpperCase();
  const rates: CurrencyExchangeRates = {};

  for (const code of targetCurrencies) {
    const currency = code.trim().toUpperCase();
    if (!currency || currency === base) {
      continue;
    }

    const apiRate = conversionRates[currency];
    if (apiRate == null || apiRate <= 0) {
      continue;
    }

    const rate = normalizeExchangeRate(1 / apiRate);
    if (rate != null) {
      rates[currency] = rate;
    }
  }

  return rates;
}

export function getExchangeRateToMain(
  currencyCode: string,
  mainCurrencyCode: string,
  rates: CurrencyExchangeRates,
): number | null {
  const currency = currencyCode.trim();
  const main = mainCurrencyCode.trim();
  if (!currency || !main || currency === main) {
    return null;
  }

  const rate = rates[currency];
  return rate != null && rate > 0 ? rate : null;
}

/**
 * Derive a transfer exchange rate (destination units per source unit) from
 * configured "1 quote = Y main" rates in settings.
 *
 * - Main → foreign: inverse of the foreign rate to main
 * - Foreign → main: foreign rate to main
 * - Foreign → foreign: triangulate through main (fromRate / toRate)
 */
export function getTransferExchangeRate(
  fromCurrency: string,
  toCurrency: string,
  mainCurrencyCode: string,
  rates: CurrencyExchangeRates,
): number | null {
  const from = fromCurrency.trim();
  const to = toCurrency.trim();
  const main = mainCurrencyCode.trim();

  if (!from || !to || from === to) {
    return null;
  }

  if (from === main) {
    const toRate = getExchangeRateToMain(to, main, rates);
    if (toRate == null) {
      return null;
    }
    return normalizeExchangeRate(1 / toRate);
  }

  if (to === main) {
    return getExchangeRateToMain(from, main, rates);
  }

  const fromRate = getExchangeRateToMain(from, main, rates);
  const toRate = getExchangeRateToMain(to, main, rates);
  if (fromRate == null || toRate == null) {
    return null;
  }

  return normalizeExchangeRate(fromRate / toRate);
}

export function getAllowedAccountCurrencies(
  mainCurrencyCode: string,
  rates: CurrencyExchangeRates,
): string[] {
  const main = mainCurrencyCode.trim();
  if (!main) {
    return [];
  }

  const codes = new Set<string>([main]);
  for (const code of Object.keys(rates)) {
    if (code && code !== main) {
      codes.add(code);
    }
  }
  return [...codes].sort();
}

export function getBudgetAmountForTransferLeg(
  legAmount: number,
  legCurrency: string,
  otherLegAmount: number,
  otherLegCurrency: string,
  mainCurrency: string,
  _exchangeRateToOther: number | null,
): number | null {
  const main = mainCurrency.trim();
  if (!main || legCurrency === main) {
    return null;
  }

  if (otherLegCurrency === main) {
    return Math.sign(legAmount) * Math.abs(otherLegAmount);
  }

  return null;
}

export function needsBudgetAmountForTransaction(
  transaction: {
    category?: string | null;
    is_child?: boolean;
    budget_amount?: number | null;
  },
  account: Pick<AccountEntity, 'offbudget'> | null | undefined,
  transferAccount: Pick<AccountEntity, 'currency' | 'offbudget'> | null | undefined,
  mainCurrencyCode: string,
  accountCurrency: string,
  isTransfer: boolean,
  exchangeRates: CurrencyExchangeRates = {},
): boolean {
  const main = mainCurrencyCode.trim();
  if (!main || !account || accountCurrency === main) {
    return false;
  }
  if (transaction.is_child || transaction.budget_amount != null) {
    return false;
  }
  if (getExchangeRateToMain(accountCurrency, main, exchangeRates) != null) {
    return false;
  }
  if (account.offbudget) {
    return false;
  }

  if (isTransfer && transferAccount) {
    if (account.offbudget === transferAccount.offbudget) {
      return false;
    }

    const toCurrency = getAccountCurrency(transferAccount, main);
    if (accountCurrency === main || toCurrency === main) {
      return false;
    }

    return !!transaction.category;
  }

  return true;
}

export function canEditTransactionBudgetAmount(
  transaction: {
    category?: string | null;
    is_child?: boolean;
  },
  account: Pick<AccountEntity, 'offbudget'> | null | undefined,
  transferAccount: Pick<AccountEntity, 'currency' | 'offbudget'> | null | undefined,
  mainCurrencyCode: string,
  accountCurrency: string,
  isTransfer: boolean,
): boolean {
  const main = mainCurrencyCode.trim();
  if (!main || !account || accountCurrency === main) {
    return false;
  }
  if (transaction.is_child) {
    return false;
  }
  if (account.offbudget) {
    return false;
  }

  if (isTransfer && transferAccount) {
    if (account.offbudget === transferAccount.offbudget) {
      return false;
    }

    const toCurrency = getAccountCurrency(transferAccount, main);
    if (accountCurrency === main || toCurrency === main) {
      return false;
    }

    return !!transaction.category;
  }

  return true;
}
