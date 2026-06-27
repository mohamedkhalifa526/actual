import { exchangeRateApiProvider } from './exchange-rate-api-provider';
import type { ExchangeRateProvider } from './types';

/** Active exchange rate provider. Swap the implementation here to change services. */
export function getExchangeRateProvider(): ExchangeRateProvider {
  return exchangeRateApiProvider;
}

export type {
  ExchangeRateFetchParams,
  ExchangeRateFetchResult,
  ExchangeRateProvider,
} from './types';
export { ExchangeRateProviderError } from './types';
