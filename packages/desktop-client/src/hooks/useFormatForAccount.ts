import { useMemo } from 'react';

import {
  getAccountCurrency,
  isForeignCurrencyAccount,
} from '@actual-app/core/shared/currency-transfer';
import type { AccountEntity } from '@actual-app/core/types/models';

import { useFormat } from './useFormat';
import type { FormatType } from './useFormat';
import { useSyncedPref } from './useSyncedPref';

type FormatFn = (value: unknown, type?: FormatType) => string;

export function useFormatForAccount(
  account?: Pick<AccountEntity, 'currency'> | null,
) {
  const format = useFormat();
  const [defaultCurrencyCode] = useSyncedPref('defaultCurrencyCode');
  const mainCurrency = defaultCurrencyCode || '';
  const accountCurrencyCode = getAccountCurrency(account, mainCurrency);
  const isForeignAccount = isForeignCurrencyAccount(account, mainCurrency);

  const formatFinancial: FormatFn = useMemo(() => {
    return isForeignAccount
      ? format.forCurrency(accountCurrencyCode)
      : format;
  }, [format, isForeignAccount, accountCurrencyCode]);

  const formatter = useMemo(() => {
    return isForeignAccount
      ? format.forCurrency(accountCurrencyCode)
      : undefined;
  }, [format, isForeignAccount, accountCurrencyCode]);

  return {
    formatFinancial,
    formatter,
    accountCurrencyCode,
    mainCurrency,
    isForeignAccount,
  };
}
