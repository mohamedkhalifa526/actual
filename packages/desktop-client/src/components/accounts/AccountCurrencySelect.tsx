import type { CSSProperties } from 'react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { Select } from '@actual-app/components/select';
import { currencies } from '@actual-app/core/shared/currencies';

type AccountCurrencySelectProps = {
  value: string;
  onChange: (currencyCode: string) => void;
  style?: CSSProperties;
};

export function AccountCurrencySelect({
  value,
  onChange,
  style,
}: AccountCurrencySelectProps) {
  const { t } = useTranslation();

  const currencyTranslations = useMemo(
    () =>
      new Map<string, string>([
        ['', t('Budget default')],
        ['AED', t('UAE Dirham')],
        ['ARS', t('Argentinian Peso')],
        ['AUD', t('Australian Dollar')],
        ['BRL', t('Brazilian Real')],
        ['BYN', t('Belarusian Ruble')],
        ['CAD', t('Canadian Dollar')],
        ['CHF', t('Swiss Franc')],
        ['CLP', t('Chilean Peso')],
        ['CNY', t('Yuan Renminbi')],
        ['COP', t('Colombian Peso')],
        ['CRC', t('Costa Rican Colón')],
        ['CZK', t('Czech Koruna')],
        ['DKK', t('Danish Krone')],
        ['DOP', t('Dominican Peso')],
        ['EGP', t('Egyptian Pound')],
        ['EUR', t('Euro')],
        ['GBP', t('Pound Sterling')],
        ['GTQ', t('Guatemalan Quetzal')],
        ['HKD', t('Hong Kong Dollar')],
        ['HUF', t('Hungarian Forint')],
        ['IDR', t('Indonesian Rupiah')],
        ['INR', t('Indian Rupee')],
        ['IRR', t('Iranian Rial')],
        ['JMD', t('Jamaican Dollar')],
        ['JPY', t('Japanese Yen')],
        ['KRW', t('South Korean Won')],
        ['LKR', t('Sri Lankan Rupee')],
        ['MDL', t('Moldovan Leu')],
        ['MXN', t('Mexican Peso')],
        ['MYR', t('Malaysian Ringgit')],
        ['PHP', t('Philippine Peso')],
        ['PKR', t('Pakistani Rupee')],
        ['PLN', t('Polish Złoty')],
        ['QAR', t('Qatari Riyal')],
        ['RON', t('Romanian Leu')],
        ['RSD', t('Serbian Dinar')],
        ['RUB', t('Russian Ruble')],
        ['SAR', t('Saudi Riyal')],
        ['SEK', t('Swedish Krona')],
        ['SGD', t('Singapore Dollar')],
        ['THB', t('Thai Baht')],
        ['TRY', t('Turkish Lira')],
        ['TWD', t('New Taiwan Dollar')],
        ['UAH', t('Ukrainian Hryvnia')],
        ['USD', t('US Dollar')],
        ['UZS', t('Uzbek Soum')],
      ]),
    [t],
  );

  const options: [string, string][] = currencies
    .filter(currency => currency.code !== '')
    .map(currency => {
      const translatedName =
        currencyTranslations.get(currency.code) ?? currency.name;
      return [currency.code, `${currency.code} — ${translatedName}`];
    });

  return (
    <Select
      value={value}
      onChange={onChange}
      options={[['', currencyTranslations.get('') ?? 'Budget default'], ...options]}
      defaultLabel={currencyTranslations.get('') ?? 'Budget default'}
      style={{ width: '100%', ...style }}
    />
  );
}
