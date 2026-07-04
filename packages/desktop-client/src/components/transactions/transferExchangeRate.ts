import {
  getAccountCurrency,
  getTransferExchangeRate,
  isCrossCurrencyTransfer,
  computeCounterpartyAmount,
  computeExchangeRate,
  normalizeExchangeRate,
} from '@actual-app/core/shared/currency-transfer';
import type { CurrencyExchangeRates } from '@actual-app/core/shared/currency-transfer';
import type {
  AccountEntity,
  PayeeEntity,
  TransactionEntity,
} from '@actual-app/core/types/models';

import { pushModal } from '#modals/modalsSlice';
import type { AppDispatch } from '#redux/store';

export function canEditTransferExchangeRate(
  fromAccount: AccountEntity | undefined,
  toAccount: AccountEntity | undefined,
  defaultCurrencyCode: string,
): boolean {
  return isCrossCurrencyTransfer(fromAccount, toAccount, defaultCurrencyCode);
}

export function getTransferAccountId(
  payeeId: PayeeEntity['id'] | null | undefined,
  payees: PayeeEntity[],
): AccountEntity['id'] | null {
  if (!payeeId) {
    return null;
  }

  return payees.find(p => p.id === payeeId)?.transfer_acct ?? null;
}

export function resolveTransferAccount(
  transaction: TransactionEntity,
  accounts: AccountEntity[],
  payees: PayeeEntity[],
  allTransactions: TransactionEntity[],
): AccountEntity | undefined {
  const transferAccountId = getTransferAccountId(transaction.payee, payees);
  if (transferAccountId) {
    return accounts.find(a => a.id === transferAccountId);
  }

  const counterparty = transaction.transfer_id
    ? allTransactions.find(t => t.id === transaction.transfer_id)
    : allTransactions.find(t => t.transfer_id === transaction.id);

  if (counterparty) {
    return accounts.find(a => a.id === counterparty.account);
  }

  return undefined;
}

export function promptTransferExchangeRate({
  dispatch,
  fromAccount,
  toAccount,
  defaultCurrencyCode,
  sourceAmount,
  defaultRate = 1,
}: {
  dispatch: AppDispatch;
  fromAccount: AccountEntity | undefined;
  toAccount: AccountEntity | undefined;
  defaultCurrencyCode: string;
  sourceAmount: number;
  defaultRate?: number;
}): Promise<number> {
  const fromCurrency = getAccountCurrency(fromAccount, defaultCurrencyCode);
  const toCurrency = getAccountCurrency(toAccount, defaultCurrencyCode);

  return new Promise((resolve, reject) => {
    dispatch(
      pushModal({
        modal: {
          name: 'transfer-exchange-rate',
          options: {
            fromCurrency,
            toCurrency,
            sourceAmount,
            defaultRate,
            onSubmit: resolve,
            onCancel: reject,
          },
        },
      }),
    );
  });
}

export async function withTransferExchangeRate(
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
  const transferAccountId = getTransferAccountId(transaction.payee, payees);
  if (!transferAccountId) {
    return transaction;
  }

  const fromAccount = accounts.find(a => a.id === transaction.account);
  const toAccount = accounts.find(a => a.id === transferAccountId);

  if (
    !isCrossCurrencyTransfer(fromAccount, toAccount, defaultCurrencyCode) ||
    transaction.exchange_rate != null
  ) {
    return transaction;
  }

  const mainCurrency = defaultCurrencyCode.trim();
  const fromCurrency = getAccountCurrency(fromAccount, mainCurrency);
  const toCurrency = getAccountCurrency(toAccount, mainCurrency);
  const configuredRate = getTransferExchangeRate(
    fromCurrency,
    toCurrency,
    mainCurrency,
    exchangeRates,
  );

  if (configuredRate != null) {
    return {
      ...transaction,
      exchange_rate: configuredRate,
    };
  }

  try {
    const exchangeRate = await promptTransferExchangeRate({
      dispatch,
      fromAccount,
      toAccount,
      defaultCurrencyCode,
      sourceAmount: transaction.amount,
      defaultRate: configuredRate ?? 1,
    });

    return {
      ...transaction,
      exchange_rate: exchangeRate,
    };
  } catch {
    throw new Error('transfer-exchange-rate-cancelled');
  }
}

export async function editTransferExchangeRate(
  transaction: TransactionEntity,
  {
    dispatch,
    accounts,
    payees,
    defaultCurrencyCode,
    exchangeRates = {},
    allTransactions,
  }: {
    dispatch: AppDispatch;
    accounts: AccountEntity[];
    payees: PayeeEntity[];
    defaultCurrencyCode: string;
    exchangeRates?: CurrencyExchangeRates;
    allTransactions: TransactionEntity[];
  },
): Promise<TransactionEntity[]> {
  const fromAccount = accounts.find(a => a.id === transaction.account);
  const toAccount = resolveTransferAccount(
    transaction,
    accounts,
    payees,
    allTransactions,
  );

  if (!canEditTransferExchangeRate(fromAccount, toAccount, defaultCurrencyCode)) {
    return [transaction];
  }

  const mainCurrency = defaultCurrencyCode.trim();
  const fromCurrency = getAccountCurrency(fromAccount, mainCurrency);
  const toCurrency = getAccountCurrency(toAccount, mainCurrency);
  const configuredRate = getTransferExchangeRate(
    fromCurrency,
    toCurrency,
    mainCurrency,
    exchangeRates,
  );

  const counterparty = transaction.transfer_id
    ? allTransactions.find(t => t.id === transaction.transfer_id)
    : allTransactions.find(t => t.transfer_id === transaction.id);

  const defaultRate =
    normalizeExchangeRate(transaction.exchange_rate ?? NaN) ??
    (counterparty
      ? computeExchangeRate(transaction.amount, counterparty.amount)
      : null) ??
    configuredRate ??
    1;

  const exchangeRate = await promptTransferExchangeRate({
    dispatch,
    fromAccount,
    toAccount,
    defaultCurrencyCode,
    sourceAmount: transaction.amount,
    defaultRate,
  });

  const counterpartyAmount = computeCounterpartyAmount(
    transaction.amount,
    exchangeRate,
  );

  const updatedTransaction: TransactionEntity = {
    ...transaction,
    exchange_rate: exchangeRate,
  };

  if (!counterparty) {
    return [updatedTransaction];
  }

  return [
    updatedTransaction,
    {
      ...counterparty,
      amount: counterpartyAmount,
      exchange_rate: exchangeRate,
    },
  ];
}
