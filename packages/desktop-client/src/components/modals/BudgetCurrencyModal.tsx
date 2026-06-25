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
  computeBudgetAmount,
  computeExchangeRateToMain,
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

type BudgetCurrencyModalProps = Extract<
  ModalType,
  { name: 'budget-currency' }
>['options'];

export function BudgetCurrencyModal({
  accountCurrency,
  mainCurrency,
  sourceAmount,
  defaultBudgetAmount,
  defaultRate = 1,
  onSubmit,
  onCancel,
}: BudgetCurrencyModalProps) {
  const { t } = useTranslation();
  const format = useFormat();
  const [hideFraction] = useSyncedPref('hideFraction');
  const sign = sourceAmount < 0 ? -1 : 1;
  const initialBudgetAmount =
    defaultBudgetAmount ??
    computeBudgetAmount(sourceAmount, defaultRate) ??
    sourceAmount;
  const [budgetAmount, setBudgetAmount] = useState<IntegerAmount>(
    sign * Math.abs(initialBudgetAmount),
  );
  const [rate, setRate] = useState(
    () =>
      normalizeExchangeRate(
        computeExchangeRateToMain(sourceAmount, initialBudgetAmount) ??
          defaultRate,
      ) ?? defaultRate,
  );
  const [error, setError] = useState<string | null>(null);
  const editingFieldRef = useRef<'amount' | 'rate' | null>(null);

  const accountSymbol = getCurrency(accountCurrency).symbol;
  const mainSymbol = getCurrency(mainCurrency).symbol;

  const clearError = () => {
    if (error) {
      setError(null);
    }
  };

  const onBudgetAmountUpdate = (value: IntegerAmount) => {
    setBudgetAmount(value);
    if (editingFieldRef.current === 'amount') {
      const nextRate = computeExchangeRateToMain(sourceAmount, value);
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
      setBudgetAmount(computeBudgetAmount(sourceAmount, value));
    }
    clearError();
  };

  const trySubmit = (): boolean => {
    if (!budgetAmount) {
      setError(t('Enter the amount in your budget currency'));
      return false;
    }
    if (Math.sign(budgetAmount) !== sign) {
      setError(
        t('Budget amount must have the same sign as the transaction'),
      );
      return false;
    }
    if (rate <= 0) {
      setError(t('Exchange rate must be a positive number'));
      return false;
    }

    onSubmit(budgetAmount);
    return true;
  };

  return (
    <Modal name="budget-currency" onClose={onCancel} isDismissable={false}>
      {({ state }) => (
        <>
          <ModalHeader
            title={
              <ModalTitle
                title={t('Budget currency amount')}
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
                Convert this transaction to your budget currency so category
                totals stay accurate.
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
                    <Trans>Account amount</Trans>
                  </Text>
                  <FinancialText style={{ fontWeight: 600 }}>
                    {format(sourceAmount, 'financial')}
                  </FinancialText>
                  <Text style={{ fontSize: 12, color: theme.pageTextSubdued }}>
                    {accountCurrency}
                    {accountSymbol ? ` (${accountSymbol})` : ''}
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
                    <Trans>Budget amount</Trans>
                  </Text>
                  <FinancialText style={{ fontWeight: 600 }}>
                    {format(budgetAmount, 'financial')}
                  </FinancialText>
                  <Text style={{ fontSize: 12, color: theme.pageTextSubdued }}>
                    {mainCurrency}
                    {mainSymbol ? ` (${mainSymbol})` : ''}
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
                  1 {{ accountCurrency }} = {{ rate: formatExchangeRate(rate) }}{' '}
                  {{ mainCurrency }}
                </Trans>
              </Text>
            </View>

            <InlineField
              label={t('Amount in {{currency}}', { currency: mainCurrency })}
              labelWidth={220}
              width="100%"
            >
              <View style={{ width: 130, flexShrink: 0 }}>
                <InitialFocus>
                  <AmountInput
                    value={budgetAmount}
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
                    onUpdate={onBudgetAmountUpdate}
                    style={{ width: '100%' }}
                  />
                </InitialFocus>
              </View>
            </InlineField>

            <InlineField
              label={t('Exchange rate ({{from}} to {{to}})', {
                from: accountCurrency,
                to: mainCurrency,
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
