import { useCallback, useMemo } from 'react';

import {
  getAllowedAccountCurrencies,
  parseCurrencyExchangeRates,
  serializeCurrencyExchangeRates,
} from '@actual-app/core/shared/currency-transfer';
import type { CurrencyExchangeRates } from '@actual-app/core/shared/currency-transfer';

import { useSyncedPref } from '#hooks/useSyncedPref';

export function useCurrencyExchangeRates() {
  const [raw, setRaw] = useSyncedPref('currencyExchangeRates');
  const rates = useMemo(() => parseCurrencyExchangeRates(raw), [raw]);

  const setRates = useCallback(
    (next: CurrencyExchangeRates) => {
      setRaw(serializeCurrencyExchangeRates(next));
    },
    [setRaw],
  );

  return { rates, setRates };
}

export function useAllowedAccountCurrencies() {
  const [defaultCurrencyCode] = useSyncedPref('defaultCurrencyCode');
  const { rates } = useCurrencyExchangeRates();

  return useMemo(() => {
    const main = defaultCurrencyCode?.trim() || '';
    if (!main) {
      return undefined;
    }
    return getAllowedAccountCurrencies(main, rates);
  }, [defaultCurrencyCode, rates]);
}
