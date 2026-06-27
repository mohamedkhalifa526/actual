import type { CurrencyExchangeRates } from '@actual-app/core/shared/currency-transfer';

export type ExchangeRateFetchParams = {
  baseCurrency: string;
  targetCurrencies: string[];
  apiKey: string;
};

export type ExchangeRateFetchResult = {
  rates: CurrencyExchangeRates;
};

export type ExchangeRateProvider = {
  fetchRates: (
    params: ExchangeRateFetchParams,
  ) => Promise<ExchangeRateFetchResult>;
};

export class ExchangeRateProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExchangeRateProviderError';
  }
}
