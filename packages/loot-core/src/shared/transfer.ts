import type { AccountEntity, TransactionEntity } from '#types/models';

import {
  computeCounterpartyAmount,
  computeExchangeRate,
  getAccountCurrency,
  isCrossCurrencyTransfer,
} from './currency-transfer';

type TransferValidationAccount = Pick<AccountEntity, 'id' | 'currency'>;

export function validForTransfer(
  fromTransaction: TransactionEntity,
  toTransaction: TransactionEntity,
  options?: {
    accounts?: TransferValidationAccount[];
    defaultCurrencyCode?: string;
  },
) {
  if (
    ![fromTransaction, toTransaction].every(tran => tran.transfer_id == null) ||
    fromTransaction.account === toTransaction.account
  ) {
    return false;
  }

  const accounts = options?.accounts;
  const defaultCurrencyCode = options?.defaultCurrencyCode ?? '';

  if (accounts) {
    const fromAccount = accounts.find(a => a.id === fromTransaction.account);
    const toAccount = accounts.find(a => a.id === toTransaction.account);

    if (isCrossCurrencyTransfer(fromAccount, toAccount, defaultCurrencyCode)) {
      if (!fromTransaction.amount || !toTransaction.amount) {
        return false;
      }
      return Math.sign(fromTransaction.amount) !== Math.sign(toTransaction.amount);
    }
  }

  return fromTransaction.amount + toTransaction.amount === 0;
}

export function getTransferExchangeRate(
  fromTransaction: TransactionEntity,
  toTransaction: TransactionEntity,
): number | null {
  return (
    fromTransaction.exchange_rate ??
    toTransaction.exchange_rate ??
    computeExchangeRate(fromTransaction.amount, toTransaction.amount)
  );
}

export { computeCounterpartyAmount, isCrossCurrencyTransfer, getAccountCurrency };
