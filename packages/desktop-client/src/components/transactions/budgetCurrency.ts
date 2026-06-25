import {
  computeBudgetAmount,
  computeExchangeRateToMain,
  getAccountCurrency,
  getExchangeRateToMain,
  needsBudgetAmountForTransaction,
  canEditTransactionBudgetAmount,
} from '@actual-app/core/shared/currency-transfer';
import type { CurrencyExchangeRates } from '@actual-app/core/shared/currency-transfer';
import type {
  AccountEntity,
  PayeeEntity,
  TransactionEntity,
} from '@actual-app/core/types/models';

import { pushModal } from '#modals/modalsSlice';
import type { AppDispatch } from '#redux/store';

import { getTransferAccountId } from './transferExchangeRate';
import { withTransferExchangeRate } from './transferExchangeRate';

type TransactionCurrencyContext = {
  dispatch: AppDispatch;
  accounts: AccountEntity[];
  payees: PayeeEntity[];
  defaultCurrencyCode: string;
  exchangeRates?: CurrencyExchangeRates;
};

export async function prepareForeignCurrencyTransaction(
  transaction: TransactionEntity,
  context: TransactionCurrencyContext,
): Promise<TransactionEntity> {
  const withRate = await withTransferExchangeRate(transaction, context);
  return withBudgetCurrencyAmount(withRate, context);
}

export function promptBudgetCurrencyAmount({
  dispatch,
  accountCurrency,
  mainCurrency,
  sourceAmount,
  defaultBudgetAmount,
  defaultRate = 1,
}: {
  dispatch: AppDispatch;
  accountCurrency: string;
  mainCurrency: string;
  sourceAmount: number;
  defaultBudgetAmount?: number | null;
  defaultRate?: number;
}): Promise<number> {
  return new Promise((resolve, reject) => {
    dispatch(
      pushModal({
        modal: {
          name: 'budget-currency',
          options: {
            accountCurrency,
            mainCurrency,
            sourceAmount,
            defaultBudgetAmount,
            defaultRate,
            onSubmit: resolve,
            onCancel: reject,
          },
        },
      }),
    );
  });
}

export async function withBudgetCurrencyAmount(
  transaction: TransactionEntity,
  {
    dispatch,
    accounts,
    payees,
    defaultCurrencyCode,
    exchangeRates = {},
  }: {
    dispatch: AppDispatch;
    accounts: AccountEntity[];
    payees: PayeeEntity[];
    defaultCurrencyCode: string;
    exchangeRates?: CurrencyExchangeRates;
  },
): Promise<TransactionEntity> {
  const account = accounts.find(a => a.id === transaction.account);
  const mainCurrency = defaultCurrencyCode.trim();
  const accountCurrency = getAccountCurrency(account, mainCurrency);
  const transferAccountId = getTransferAccountId(transaction.payee, payees);
  const transferAccount = transferAccountId
    ? accounts.find(a => a.id === transferAccountId)
    : undefined;
  const configuredRate = getExchangeRateToMain(
    accountCurrency,
    mainCurrency,
    exchangeRates,
  );

  if (
    !needsBudgetAmountForTransaction(
      transaction,
      account,
      transferAccount,
      mainCurrency,
      accountCurrency,
      !!transferAccountId,
      exchangeRates,
    )
  ) {
    return transaction;
  }

  try {
    const budgetAmount = await promptBudgetCurrencyAmount({
      dispatch,
      accountCurrency,
      mainCurrency,
      sourceAmount: transaction.amount,
      defaultBudgetAmount: transaction.budget_amount,
      defaultRate: configuredRate ?? 1,
    });

    return {
      ...transaction,
      budget_amount: budgetAmount,
    };
  } catch {
    throw new Error('budget-currency-cancelled');
  }
}

export async function editTransactionBudgetAmount(
  transaction: TransactionEntity,
  {
    dispatch,
    accounts,
    payees,
    defaultCurrencyCode,
    exchangeRates = {},
  }: {
    dispatch: AppDispatch;
    accounts: AccountEntity[];
    payees: PayeeEntity[];
    defaultCurrencyCode: string;
    exchangeRates?: CurrencyExchangeRates;
  },
): Promise<TransactionEntity> {
  const account = accounts.find(a => a.id === transaction.account);
  const mainCurrency = defaultCurrencyCode.trim();
  const accountCurrency = getAccountCurrency(account, mainCurrency);
  const transferAccountId = getTransferAccountId(transaction.payee, payees);
  const transferAccount = transferAccountId
    ? accounts.find(a => a.id === transferAccountId)
    : undefined;

  if (
    !canEditTransactionBudgetAmount(
      transaction,
      account,
      transferAccount,
      mainCurrency,
      accountCurrency,
      !!transferAccountId,
    )
  ) {
    return transaction;
  }

  const configuredRate = getExchangeRateToMain(
    accountCurrency,
    mainCurrency,
    exchangeRates,
  );
  const defaultBudgetAmount =
    transaction.budget_amount ??
    (configuredRate != null
      ? computeBudgetAmount(transaction.amount, configuredRate)
      : null);

  const budgetAmount = await promptBudgetCurrencyAmount({
    dispatch,
    accountCurrency,
    mainCurrency,
    sourceAmount: transaction.amount,
    defaultBudgetAmount,
    defaultRate:
      configuredRate ??
      computeExchangeRateToMain(
        transaction.amount,
        defaultBudgetAmount ?? transaction.amount,
      ) ??
      1,
  });

  return {
    ...transaction,
    budget_amount: budgetAmount,
  };
}

export { canEditTransactionBudgetAmount };
