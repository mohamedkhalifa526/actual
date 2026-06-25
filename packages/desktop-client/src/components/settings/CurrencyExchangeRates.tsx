import { useMemo, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { Input } from '@actual-app/components/input';
import { Select } from '@actual-app/components/select';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { currencies, getCurrency } from '@actual-app/core/shared/currencies';
import {
  formatExchangeRate,
  getAllowedAccountCurrencies,
  isValidExchangeRateInput,
  parseExchangeRateInput,
} from '@actual-app/core/shared/currency-transfer';
import { css } from '@emotion/css';

import { ExchangeRateInput } from '#components/util/ExchangeRateInput';
import { useCurrencyExchangeRates } from '#hooks/useCurrencyExchangeRates';

import { Column } from './UI';

type CurrencyExchangeRatesProps = {
  mainCurrencyCode: string;
};

export function CurrencyExchangeRatesSettings({
  mainCurrencyCode,
}: CurrencyExchangeRatesProps) {
  const { t } = useTranslation();
  const { rates, setRates } = useCurrencyExchangeRates();
  const [newCurrency, setNewCurrency] = useState('');
  const [newRate, setNewRate] = useState('1.0000');

  const currencyLabels = useMemo(() => {
    return new Map(
      currencies
        .filter(currency => currency.code)
        .map(currency => [currency.code, `${currency.code} (${currency.symbol})`]),
    );
  }, []);

  const availableToAdd = useMemo(() => {
    const used = new Set(getAllowedAccountCurrencies(mainCurrencyCode, rates));
    return currencies
      .filter(
        currency =>
          currency.code &&
          currency.code !== mainCurrencyCode &&
          !used.has(currency.code),
      )
      .map(currency => [
        currency.code,
        currencyLabels.get(currency.code) ?? currency.code,
      ] as [string, string]);
  }, [currencyLabels, mainCurrencyCode, rates]);

  const selectButtonClassName = css({
    '&[data-hovered]': {
      backgroundColor: theme.buttonNormalBackgroundHover,
    },
  });

  if (!mainCurrencyCode) {
    return null;
  }

  const foreignCurrencies = Object.keys(rates)
    .filter(code => code && code !== mainCurrencyCode)
    .sort();

  return (
    <View style={{ display: 'flex', flexDirection: 'column', gap: '1em' }}>
      <Column title={t('Exchange rates to {{currency}}', { currency: mainCurrencyCode })}>
        <Text style={{ color: theme.pageTextSubdued, marginBottom: 10 }}>
          <Trans>
            Add foreign currencies used in your budget and set their exchange
            rate to your main currency. These rates are used for budget totals
            and account summaries.
          </Trans>
        </Text>

        {foreignCurrencies.length === 0 ? (
          <Text style={{ color: theme.pageTextSubdued, fontSize: 13 }}>
            <Trans>No foreign currencies configured yet.</Trans>
          </Text>
        ) : (
          <View style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {foreignCurrencies.map(code => {
              const currency = getCurrency(code);
              return (
                <View
                  key={code}
                  style={{
                    display: 'flex',
                    flexDirection: 'row',
                    gap: 8,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ width: 56, flexShrink: 0 }}>{code}</Text>
                  <ExchangeRateInput
                    value={rates[code] ?? 0}
                    onUpdate={parsed => {
                      setRates({ ...rates, [code]: parsed });
                    }}
                    style={{ flex: 1 }}
                  />
                  <Text style={{ color: theme.pageTextSubdued, fontSize: 12 }}>
                    {currency.symbol}
                  </Text>
                  <Button
                    onPress={() => {
                      const next = { ...rates };
                      delete next[code];
                      setRates(next);
                    }}
                  >
                    <Trans>Remove</Trans>
                  </Button>
                </View>
              );
            })}
          </View>
        )}
      </Column>

      {availableToAdd.length > 0 && (
        <View
          style={{
            display: 'flex',
            flexDirection: 'row',
            gap: 8,
            alignItems: 'flex-end',
            flexWrap: 'wrap',
          }}
        >
          <View style={{ flex: 1, minWidth: 160 }}>
            <Text style={{ marginBottom: 4, fontSize: 13 }}>
              <Trans>Add currency</Trans>
            </Text>
            <Select
              value={newCurrency}
              onChange={setNewCurrency}
              options={[['', t('Select currency')], ...availableToAdd]}
              className={selectButtonClassName}
              style={{ width: '100%' }}
            />
          </View>
          <View style={{ width: 120 }}>
            <Text style={{ marginBottom: 4, fontSize: 13 }}>
              <Trans>Rate</Trans>
            </Text>
            <Input
              inputMode="decimal"
              value={newRate}
              onChangeValue={value => {
                if (isValidExchangeRateInput(value)) {
                  setNewRate(value);
                }
              }}
              onUpdate={value => {
                const parsed = parseExchangeRateInput(value);
                if (parsed != null) {
                  setNewRate(formatExchangeRate(parsed));
                }
              }}
              style={{ width: '100%' }}
            />
          </View>
          <Button
            variant="primary"
            isDisabled={!newCurrency}
            onPress={() => {
              const parsed = parseExchangeRateInput(newRate);
              if (!newCurrency || parsed == null) {
                return;
              }
              setRates({ ...rates, [newCurrency]: parsed });
              setNewCurrency('');
              setNewRate('1.0000');
            }}
          >
            <Trans>Add</Trans>
          </Button>
        </View>
      )}
    </View>
  );
}
