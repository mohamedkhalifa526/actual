import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  getExchangeRateProvider,
  ExchangeRateProviderError,
} from '#exchange-rates';
import { useCurrencyExchangeRates } from '#hooks/useCurrencyExchangeRates';
import { useSyncedPref } from '#hooks/useSyncedPref';
import { addNotification } from '#notifications/notificationsSlice';
import { useDispatch } from '#redux';

export function useExchangeRateRefresh(mainCurrencyCode: string) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const { rates, setRates } = useCurrencyExchangeRates();
  const [apiKey, setApiKey] = useSyncedPref('exchangeRateApiKey');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refreshRates = useCallback(async () => {
    const main = mainCurrencyCode.trim();
    const targetCurrencies = Object.keys(rates).filter(
      code => code && code !== main,
    );

    if (!apiKey?.trim()) {
      dispatch(
        addNotification({
          notification: {
            type: 'error',
            message: t('Enter an ExchangeRate-API key in settings first'),
          },
        }),
      );
      return;
    }

    if (targetCurrencies.length === 0) {
      dispatch(
        addNotification({
          notification: {
            type: 'error',
            message: t('Add at least one foreign currency before refreshing rates'),
          },
        }),
      );
      return;
    }

    setIsRefreshing(true);
    try {
      const provider = getExchangeRateProvider();
      const { rates: fetchedRates } = await provider.fetchRates({
        baseCurrency: main,
        targetCurrencies,
        apiKey,
      });

      const updatedCount = Object.keys(fetchedRates).length;
      if (updatedCount === 0) {
        dispatch(
          addNotification({
            notification: {
              type: 'error',
              message: t('No exchange rates were returned for the configured currencies'),
            },
          }),
        );
        return;
      }

      setRates({ ...rates, ...fetchedRates });
      dispatch(
        addNotification({
          notification: {
            type: 'message',
            message: t('Updated {{count}} exchange rate(s)', {
              count: updatedCount,
            }),
          },
        }),
      );
    } catch (error) {
      const message =
        error instanceof ExchangeRateProviderError
          ? error.message
          : t('Failed to refresh exchange rates');
      dispatch(
        addNotification({
          notification: {
            type: 'error',
            message,
          },
        }),
      );
    } finally {
      setIsRefreshing(false);
    }
  }, [apiKey, dispatch, mainCurrencyCode, rates, setRates, t]);

  return {
    apiKey: apiKey ?? '',
    setApiKey,
    refreshRates,
    isRefreshing,
  };
}
