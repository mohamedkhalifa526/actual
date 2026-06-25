import type { AccountEntity } from '#types/models';

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
  return Number.isFinite(rate) && rate > 0 ? rate : null;
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
  return Number.isFinite(rate) && rate > 0 ? rate : null;
}

/** SQL expression for budget category sums (main currency). */
export const budgetAmountSqlExpression = 'COALESCE(t.budget_amount, t.amount)';

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
): boolean {
  const main = mainCurrencyCode.trim();
  if (!main || !account || accountCurrency === main) {
    return false;
  }
  if (transaction.is_child || transaction.budget_amount != null) {
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
