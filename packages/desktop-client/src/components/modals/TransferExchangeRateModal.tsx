import { useRef, useState } from 'react';
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
  normalizeExchangeRate,
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
import { ExchangeRateInput } from '#components/util/ExchangeRateInput';
import { useFormat } from '#hooks/useFormat';
import { useSyncedPref } from '#hooks/useSyncedPref';
import type { Modal as ModalType } from '#modals/modalsSlice';

type TransferExchangeRateModalProps = Extract<
  ModalType,
  { name: 'transfer-exchange-rate' }
>['options'];

export function TransferExchangeRateModal({
  fromCurrency,
  toCurrency,
  sourceAmount,
  defaultRate = 1,
  onSubmit,
  onCancel,
}: TransferExchangeRateModalProps) {
  const { t } = useTranslation();
  const format = useFormat();
  const [hideFraction] = useSyncedPref('hideFraction');
  const formatFrom = format.forCurrency(fromCurrency);
  const formatTo = format.forCurrency(toCurrency);

  const initialCounterpartyAmount = computeCounterpartyAmount(
    sourceAmount,
    defaultRate,
  );
  const [counterpartyAmount, setCounterpartyAmount] = useState<IntegerAmount>(
    initialCounterpartyAmount,
  );
  const [rate, setRate] = useState(
    () =>
      normalizeExchangeRate(
        computeExchangeRate(sourceAmount, initialCounterpartyAmount) ??
          defaultRate,
      ) ?? defaultRate,
  );
  const [error, setError] = useState<string | null>(null);
  const editingFieldRef = useRef<'amount' | 'rate' | null>(null);

  const fromSymbol = getCurrency(fromCurrency).symbol;
  const toSymbol = getCurrency(toCurrency).symbol;

  const clearError = () => {
    if (error) {
      setError(null);
    }
  };

  const onCounterpartyAmountUpdate = (value: IntegerAmount) => {
    setCounterpartyAmount(value);
    if (editingFieldRef.current === 'amount') {
      const nextRate = computeExchangeRate(sourceAmount, value);
      if (nextRate != null) {
        const normalized = normalizeExchangeRate(nextRate);
        if (normalized != null) {
          setRate(normalized);
        }
      }
    }
    clearError();
  };

  const onRateUpdate = (value: number) => {
    setRate(value);
    if (editingFieldRef.current === 'rate') {
      setCounterpartyAmount(computeCounterpartyAmount(sourceAmount, value));
    }
    clearError();
  };

  const trySubmit = (): boolean => {
    if (!counterpartyAmount) {
      setError(t('Enter the amount in the destination account currency'));
      return false;
    }
    if (Math.sign(counterpartyAmount) === Math.sign(sourceAmount)) {
      setError(
        t('Transfer amount must have the opposite sign of the source amount'),
      );
      return false;
    }
    if (rate <= 0) {
      setError(t('Exchange rate must be a positive number'));
      return false;
    }

    onSubmit(rate);
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
                Enter the exchange rate so both accounts reflect the correct
                transfer amount.
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
                    <Trans>Source amount</Trans>
                  </Text>
                  <FinancialText style={{ fontWeight: 600 }}>
                    {formatFrom(sourceAmount, 'financial')}
                  </FinancialText>
                  <Text style={{ fontSize: 12, color: theme.pageTextSubdued }}>
                    {fromCurrency}
                    {fromSymbol ? ` (${fromSymbol})` : ''}
                  </Text>
                </View>

                <Text
                  style={{
                    color: theme.pageTextSubdued,
                    fontSize: 18,
                    flexShrink: 0,
                  }}
                >
                  →
                </Text>

                <View style={{ flex: 1, minWidth: 0, alignItems: 'flex-end' }}>
                  <Text
                    style={{
                      fontSize: 12,
                      color: theme.pageTextSubdued,
                      marginBottom: 4,
                    }}
                  >
                    <Trans>Destination amount</Trans>
                  </Text>
                  <FinancialText style={{ fontWeight: 600 }}>
                    {formatTo(counterpartyAmount, 'financial')}
                  </FinancialText>
                  <Text style={{ fontSize: 12, color: theme.pageTextSubdued }}>
                    {toCurrency}
                    {toSymbol ? ` (${toSymbol})` : ''}
                  </Text>
                </View>
              </View>

              <Text
                style={{
                  fontSize: 12,
                  color: theme.pageTextSubdued,
                  textAlign: 'center',
                }}
              >
                <Trans>
                  1 {{ fromCurrency }} = {{ rate: formatExchangeRate(rate) }}{' '}
                  {{ toCurrency }}
                </Trans>
              </Text>
            </View>

            <InlineField
              label={t('Amount in {{currency}}', { currency: toCurrency })}
              labelWidth={220}
              width="100%"
            >
              <View style={{ width: 130, flexShrink: 0 }}>
                <InitialFocus>
                  <AmountInput
                    value={counterpartyAmount}
                    autoDecimals={String(hideFraction) !== 'true'}
                    updateOnInput
                    onFocus={() => {
                      editingFieldRef.current = 'amount';
                    }}
                    onBlur={() => {
                      if (editingFieldRef.current === 'amount') {
                        editingFieldRef.current = null;
                      }
                    }}
                    onUpdate={onCounterpartyAmountUpdate}
                    style={{ width: '100%' }}
                  />
                </InitialFocus>
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
              <ExchangeRateInput
                value={rate}
                updateOnInput
                onFocus={() => {
                  editingFieldRef.current = 'rate';
                }}
                onBlur={() => {
                  if (editingFieldRef.current === 'rate') {
                    editingFieldRef.current = null;
                  }
                }}
                onUpdate={onRateUpdate}
                style={{ width: 130, flexShrink: 0 }}
              />
            </InlineField>

            <Text
              style={{
                marginTop: 12,
                color: theme.pageTextSubdued,
                fontSize: 13,
              }}
            >
              <Trans>
                Edit either field — the other updates automatically.
              </Trans>
            </Text>

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
