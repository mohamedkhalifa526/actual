import {
  getAccountCurrency,
  isCrossCurrencyTransfer,
} from '@actual-app/core/shared/currency-transfer';
import type {
  AccountEntity,
  PayeeEntity,
  TransactionEntity,
} from '@actual-app/core/types/models';

import { pushModal } from '#modals/modalsSlice';
import type { AppDispatch } from '#redux/store';

export function getTransferAccountId(
  payeeId: PayeeEntity['id'] | null | undefined,
  payees: PayeeEntity[],
): AccountEntity['id'] | null {
  if (!payeeId) {
    return null;
  }

  return payees.find(p => p.id === payeeId)?.transfer_acct ?? null;
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
  }: {
    dispatch: AppDispatch;
    accounts: AccountEntity[];
    payees: PayeeEntity[];
    defaultCurrencyCode: string;
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

  try {
    const exchangeRate = await promptTransferExchangeRate({
      dispatch,
      fromAccount,
      toAccount,
      defaultCurrencyCode,
      sourceAmount: transaction.amount,
    });

    return {
      ...transaction,
      exchange_rate: exchangeRate,
    };
  } catch {
    throw new Error('transfer-exchange-rate-cancelled');
  }
}
