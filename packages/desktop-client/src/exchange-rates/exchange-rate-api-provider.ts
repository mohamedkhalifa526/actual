import { convertRatesFromBaseConversion } from '@actual-app/core/shared/currency-transfer';

import {
  ExchangeRateProviderError,
  type ExchangeRateProvider,
} from './types';

const BASE_URL = 'https://v6.exchangerate-api.com/v6';

type ExchangeRateApiSuccessResponse = {
  result: 'success';
  base_code: string;
  conversion_rates: Record<string, number>;
};

type ExchangeRateApiErrorResponse = {
  result: 'error';
  'error-type'?: string;
};

type ExchangeRateApiResponse =
  | ExchangeRateApiSuccessResponse
  | ExchangeRateApiErrorResponse;

export const exchangeRateApiProvider: ExchangeRateProvider = {
  async fetchRates({ baseCurrency, targetCurrencies, apiKey }) {
    const trimmedKey = apiKey.trim();
    const base = baseCurrency.trim();

    if (!trimmedKey) {
      throw new ExchangeRateProviderError('API key is required');
    }
    if (!base) {
      throw new ExchangeRateProviderError('Base currency is required');
    }

    const url = `${BASE_URL}/${encodeURIComponent(trimmedKey)}/latest/${encodeURIComponent(base)}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new ExchangeRateProviderError(
        `Request failed with status ${response.status}`,
      );
    }

    const data = (await response.json()) as ExchangeRateApiResponse;
    if (data.result !== 'success') {
      throw new ExchangeRateProviderError(
        data['error-type'] ?? 'Exchange rate API request failed',
      );
    }

    return {
      rates: convertRatesFromBaseConversion(
        data.conversion_rates,
        data.base_code,
        targetCurrencies,
      ),
    };
  },
};
