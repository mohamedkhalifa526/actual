import { useMemo, useState } from 'react';
import { Form } from 'react-aria-components';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { FormError } from '@actual-app/components/form-error';
import { InitialFocus } from '@actual-app/components/initial-focus';
import { InlineField } from '@actual-app/components/inline-field';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { getCurrency } from '@actual-app/core/shared/currencies';
import {
  computeCounterpartyAmount,
  computeExchangeRate,
  formatExchangeRate,
} from '@actual-app/core/shared/currency-transfer';
import type { IntegerAmount } from '@actual-app/core/shared/util';

import { FinancialText } from '#components/FinancialText';
import {
  Modal,
  ModalButtons,
  ModalCloseButton,
  ModalHeader,
  ModalTitle,
} from '#components/common/Modal';
import { AmountInput } from '#components/util/AmountInput';
import { useFormat } from '#hooks/useFormat';
import { useSyncedPref } from '#hooks/useSyncedPref';
import type { Modal as ModalType } from '#modals/modalsSlice';

type TransferExchangeRateModalProps = Extract<
  ModalType,
  { name: 'transfer-exchange-rate' }
>['options'];

const readOnlyRateStyle = {
  width: 130,
  flexShrink: 0,
  padding: '5px 8px',
  borderRadius: 4,
  backgroundColor: theme.tableBackground,
  border: `1px solid ${theme.formInputBorder}`,
  color: theme.pageTextSubdued,
  textAlign: 'right' as const,
};

export function TransferExchangeRateModal({
  fromCurrency,
  toCurrency,
  mainCurrency,
  sourceAmount,
  counterpartyAmount: initialCounterpartyAmount,
  defaultRate = 1,
  onSubmit,
  onCancel,
}: TransferExchangeRateModalProps) {
  const { t } = useTranslation();
  const format = useFormat();
  const [hideFraction] = useSyncedPref('hideFraction');

  const initialToAmount =
    initialCounterpartyAmount ??
    computeCounterpartyAmount(sourceAmount, defaultRate);

  const [fromLegAmount, setFromLegAmount] =
    useState<IntegerAmount>(sourceAmount);
  const [toLegAmount, setToLegAmount] =
    useState<IntegerAmount>(initialToAmount);
  const [error, setError] = useState<string | null>(null);

  const involvesMain =
    mainCurrency !== '' &&
    (fromCurrency === mainCurrency || toCurrency === mainCurrency);
  const otherCurrency = involvesMain
    ? fromCurrency === mainCurrency
      ? toCurrency
      : fromCurrency
    : null;

  const formatFrom = format.forCurrency(fromCurrency);
  const formatTo = format.forCurrency(toCurrency);
  const formatMain = mainCurrency ? format.forCurrency(mainCurrency) : format;
  const formatOther = otherCurrency ? format.forCurrency(otherCurrency) : format;

  const fromSymbol = getCurrency(fromCurrency).symbol;
  const toSymbol = getCurrency(toCurrency).symbol;
  const mainSymbol = mainCurrency ? getCurrency(mainCurrency).symbol : '';
  const otherSymbol = otherCurrency ? getCurrency(otherCurrency).symbol : '';

  const defaultLegAmount = useMemo(() => {
    if (fromCurrency === mainCurrency) {
      return fromLegAmount;
    }
    if (toCurrency === mainCurrency) {
      return toLegAmount;
    }
    return null;
  }, [fromCurrency, mainCurrency, toCurrency, fromLegAmount, toLegAmount]);

  const otherLegAmount = useMemo(() => {
    if (fromCurrency === mainCurrency) {
      return toLegAmount;
    }
    if (toCurrency === mainCurrency) {
      return fromLegAmount;
    }
    return null;
  }, [fromCurrency, mainCurrency, toCurrency, fromLegAmount, toLegAmount]);

  const setDefaultLegAmount = (value: IntegerAmount) => {
    if (fromCurrency === mainCurrency) {
      setFromLegAmount(value);
    } else if (toCurrency === mainCurrency) {
      setToLegAmount(value);
    }
    if (error) {
      setError(null);
    }
  };

  const setOtherLegAmount = (value: IntegerAmount) => {
    if (fromCurrency === mainCurrency) {
      setToLegAmount(value);
    } else if (toCurrency === mainCurrency) {
      setFromLegAmount(value);
    }
    if (error) {
      setError(null);
    }
  };

  const rateFromTo = computeExchangeRate(fromLegAmount, toLegAmount);
  const rateToFrom = computeExchangeRate(toLegAmount, fromLegAmount);

  const otherToDefault =
    involvesMain && otherLegAmount != null && defaultLegAmount != null
      ? computeExchangeRate(otherLegAmount, defaultLegAmount)
      : null;
  const defaultToOther =
    involvesMain && defaultLegAmount != null && otherLegAmount != null
      ? computeExchangeRate(defaultLegAmount, otherLegAmount)
      : null;

  const trySubmit = (): boolean => {
    if (!fromLegAmount || !toLegAmount) {
      setError(t('Enter amounts in both account currencies'));
      return false;
    }
    if (Math.sign(fromLegAmount) === Math.sign(toLegAmount)) {
      setError(
        t('Transfer amounts must have opposite signs in each account'),
      );
      return false;
    }
    if (rateFromTo == null || rateFromTo <= 0) {
      setError(t('Exchange rate must be a positive number'));
      return false;
    }

    onSubmit({
      exchangeRate: rateFromTo,
      fromAmount: fromLegAmount,
      toAmount: toLegAmount,
    });
    return true;
  };

  return (
    <Modal
      name="transfer-exchange-rate"
      onClose={onCancel}
      isDismissable={false}
    >
      {({ state }) => (
        <>
          <ModalHeader
            title={
              <ModalTitle
                title={t('Cross-currency transfer')}
                shrinkOnOverflow
              />
            }
            rightContent={<ModalCloseButton onPress={() => state.close()} />}
          />
          <Form
            onSubmit={event => {
              event.preventDefault();
              if (trySubmit()) {
                state.close();
              }
            }}
          >
            <Text style={{ marginBottom: 16, color: theme.pageTextSubdued }}>
              <Trans>
                Enter the transfer amounts in each account currency. Exchange
                rates are calculated automatically.
              </Trans>
            </Text>

            <View
              style={{
                padding: 12,
                marginBottom: 20,
                borderRadius: 6,
                backgroundColor: theme.tableRowBackgroundHover,
                gap: 12,
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                }}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    style={{
                      fontSize: 12,
                      color: theme.pageTextSubdued,
                      marginBottom: 4,
                    }}
                  >
                    {involvesMain ? (
                      <Trans>Other currency amount</Trans>
                    ) : (
                      <Trans>From account amount</Trans>
                    )}
                  </Text>
                  <FinancialText style={{ fontWeight: 600 }}>
                    {involvesMain
                      ? formatOther(otherLegAmount ?? 0, 'financial')
                      : formatFrom(fromLegAmount, 'financial')}
                  </FinancialText>
                  <Text style={{ fontSize: 12, color: theme.pageTextSubdued }}>
                    {involvesMain ? otherCurrency : fromCurrency}
                    {(involvesMain ? otherSymbol : fromSymbol)
                      ? ` (${involvesMain ? otherSymbol : fromSymbol})`
                      : ''}
                  </Text>
                </View>

                <Text
                  style={{
                    color: theme.pageTextSubdued,
                    fontSize: 18,
                    flexShrink: 0,
                  }}
                >
                  ↔
                </Text>

                <View style={{ flex: 1, minWidth: 0, alignItems: 'flex-end' }}>
                  <Text
                    style={{
                      fontSize: 12,
                      color: theme.pageTextSubdued,
                      marginBottom: 4,
                    }}
                  >
                    {involvesMain ? (
                      <Trans>Default currency amount</Trans>
                    ) : (
                      <Trans>To account amount</Trans>
                    )}
                  </Text>
                  <FinancialText style={{ fontWeight: 600 }}>
                    {involvesMain
                      ? formatMain(defaultLegAmount ?? 0, 'financial')
                      : formatTo(toLegAmount, 'financial')}
                  </FinancialText>
                  <Text style={{ fontSize: 12, color: theme.pageTextSubdued }}>
                    {involvesMain ? mainCurrency : toCurrency}
                    {(involvesMain ? mainSymbol : toSymbol)
                      ? ` (${involvesMain ? mainSymbol : toSymbol})`
                      : ''}
                  </Text>
                </View>
              </View>

              {involvesMain && otherCurrency && (
                <>
                  <Text
                    style={{
                      fontSize: 12,
                      color: theme.pageTextSubdued,
                      textAlign: 'center',
                    }}
                  >
                    <Trans>
                      1 {{ otherCurrency }} ={' '}
                      {{ rate: formatExchangeRate(otherToDefault) }}{' '}
                      {{ mainCurrency }}
                    </Trans>
                  </Text>
                  <Text
                    style={{
                      fontSize: 12,
                      color: theme.pageTextSubdued,
                      textAlign: 'center',
                    }}
                  >
                    <Trans>
                      1 {{ mainCurrency }} ={' '}
                      {{ rate: formatExchangeRate(defaultToOther) }}{' '}
                      {{ otherCurrency }}
                    </Trans>
                  </Text>
                </>
              )}

              {!involvesMain && (
                <>
                  <Text
                    style={{
                      fontSize: 12,
                      color: theme.pageTextSubdued,
                      textAlign: 'center',
                    }}
                  >
                    <Trans>
                      1 {{ fromCurrency }} ={' '}
                      {{ rate: formatExchangeRate(rateFromTo) }} {{ toCurrency }}
                    </Trans>
                  </Text>
                  <Text
                    style={{
                      fontSize: 12,
                      color: theme.pageTextSubdued,
                      textAlign: 'center',
                    }}
                  >
                    <Trans>
                      1 {{ toCurrency }} ={' '}
                      {{ rate: formatExchangeRate(rateToFrom) }} {{ fromCurrency }}
                    </Trans>
                  </Text>
                </>
              )}
            </View>

            {involvesMain && otherCurrency ? (
              <>
                <InlineField
                  label={t('Amount in {{currency}}', {
                    currency: otherCurrency,
                  })}
                  labelWidth={220}
                  width="100%"
                >
                  <View style={{ width: 130, flexShrink: 0 }}>
                    <InitialFocus>
                      <AmountInput
                        value={otherLegAmount ?? 0}
                        autoDecimals={String(hideFraction) !== 'true'}
                        updateOnInput
                        onUpdate={setOtherLegAmount}
                        style={{ width: '100%' }}
                      />
                    </InitialFocus>
                  </View>
                </InlineField>

                <InlineField
                  label={t('Amount in {{currency}}', {
                    currency: mainCurrency,
                  })}
                  labelWidth={220}
                  width="100%"
                  style={{ marginTop: 16 }}
                >
                  <View style={{ width: 130, flexShrink: 0 }}>
                    <AmountInput
                      value={defaultLegAmount ?? 0}
                      autoDecimals={String(hideFraction) !== 'true'}
                      updateOnInput
                      onUpdate={setDefaultLegAmount}
                      style={{ width: '100%' }}
                    />
                  </View>
                </InlineField>

                <InlineField
                  label={t('Exchange rate ({{from}} to {{to}})', {
                    from: otherCurrency,
                    to: mainCurrency,
                  })}
                  labelWidth={220}
                  width="100%"
                  style={{ marginTop: 16 }}
                >
                  <Text style={readOnlyRateStyle}>
                    {formatExchangeRate(otherToDefault)}
                  </Text>
                </InlineField>

                <InlineField
                  label={t('Exchange rate ({{from}} to {{to}})', {
                    from: mainCurrency,
                    to: otherCurrency,
                  })}
                  labelWidth={220}
                  width="100%"
                  style={{ marginTop: 16 }}
                >
                  <Text style={readOnlyRateStyle}>
                    {formatExchangeRate(defaultToOther)}
                  </Text>
                </InlineField>
              </>
            ) : (
              <>
                <InlineField
                  label={t('Amount in {{currency}}', { currency: fromCurrency })}
                  labelWidth={220}
                  width="100%"
                >
                  <View style={{ width: 130, flexShrink: 0 }}>
                    <InitialFocus>
                      <AmountInput
                        value={fromLegAmount}
                        autoDecimals={String(hideFraction) !== 'true'}
                        updateOnInput
                        onUpdate={value => {
                          setFromLegAmount(value);
                          if (error) {
                            setError(null);
                          }
                        }}
                        style={{ width: '100%' }}
                      />
                    </InitialFocus>
                  </View>
                </InlineField>

                <InlineField
                  label={t('Amount in {{currency}}', { currency: toCurrency })}
                  labelWidth={220}
                  width="100%"
                  style={{ marginTop: 16 }}
                >
                  <View style={{ width: 130, flexShrink: 0 }}>
                    <AmountInput
                      value={toLegAmount}
                      autoDecimals={String(hideFraction) !== 'true'}
                      updateOnInput
                      onUpdate={value => {
                        setToLegAmount(value);
                        if (error) {
                          setError(null);
                        }
                      }}
                      style={{ width: '100%' }}
                    />
                  </View>
                </InlineField>

                <InlineField
                  label={t('Exchange rate ({{from}} to {{to}})', {
                    from: fromCurrency,
                    to: toCurrency,
                  })}
                  labelWidth={220}
                  width="100%"
                  style={{ marginTop: 16 }}
                >
                  <Text style={readOnlyRateStyle}>
                    {formatExchangeRate(rateFromTo)}
                  </Text>
                </InlineField>

                <InlineField
                  label={t('Exchange rate ({{from}} to {{to}})', {
                    from: toCurrency,
                    to: fromCurrency,
                  })}
                  labelWidth={220}
                  width="100%"
                  style={{ marginTop: 16 }}
                >
                  <Text style={readOnlyRateStyle}>
                    {formatExchangeRate(rateToFrom)}
                  </Text>
                </InlineField>
              </>
            )}

            {error && <FormError style={{ marginTop: 12 }}>{error}</FormError>}

            <ModalButtons>
              <Button
                onPress={() => {
                  onCancel?.();
                  state.close();
                }}
              >
                <Trans>Cancel</Trans>
              </Button>
              <Button
                type="submit"
                variant="primary"
                style={{ marginLeft: 10 }}
              >
                <Trans>Apply</Trans>
              </Button>
            </ModalButtons>
          </Form>
        </>
      )}
    </Modal>
  );
}
