import { useState } from 'react';
import type { FormEvent } from 'react';
import { Form } from 'react-aria-components';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { FormError } from '@actual-app/components/form-error';
import { InitialFocus } from '@actual-app/components/initial-focus';
import { InlineField } from '@actual-app/components/inline-field';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import {
  computeBudgetAmount,
  computeExchangeRateToMain,
  normalizeExchangeRate,
} from '@actual-app/core/shared/currency-transfer';
import type { IntegerAmount } from '@actual-app/core/shared/util';

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

type InputMode = 'amount' | 'rate';

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
  const [inputMode, setInputMode] = useState<InputMode>('amount');
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

  const computedFromRate = computeBudgetAmount(sourceAmount, rate);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (inputMode === 'amount') {
      if (!budgetAmount) {
        setError(t('Enter the amount in your budget currency'));
        return;
      }
      if (Math.sign(budgetAmount) !== sign) {
        setError(
          t('Budget amount must have the same sign as the transaction'),
        );
        return;
      }
      onSubmit(budgetAmount);
      return;
    }

    if (rate <= 0) {
      setError(t('Exchange rate must be a positive number'));
      return;
    }

    onSubmit(computeBudgetAmount(sourceAmount, rate));
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
              handleSubmit(event);
              state.close();
            }}
          >
            <Text style={{ marginBottom: 15, color: theme.pageTextSubdued }}>
              <Trans>
                This account uses {{ accountCurrency }}. Enter the equivalent in
                your budget currency ({{ mainCurrency }}) so category totals are
                accurate.
              </Trans>
            </Text>

            <Text style={{ marginBottom: 10, color: theme.pageTextSubdued }}>
              <Trans>
                Account amount: {{ amount: format(sourceAmount, 'financial') }}{' '}
                ({{ accountCurrency }})
              </Trans>
            </Text>

            <View
              style={{
                flexDirection: 'row',
                gap: 8,
                marginBottom: 15,
              }}
            >
              <Button
                variant={inputMode === 'amount' ? 'primary' : 'normal'}
                onPress={() => setInputMode('amount')}
              >
                <Trans>Budget amount</Trans>
              </Button>
              <Button
                variant={inputMode === 'rate' ? 'primary' : 'normal'}
                onPress={() => setInputMode('rate')}
              >
                <Trans>Exchange rate</Trans>
              </Button>
            </View>

            {inputMode === 'amount' ? (
              <InlineField
                label={t('Amount in {{currency}}', { currency: mainCurrency })}
                width="100%"
              >
                <InitialFocus>
                  <AmountInput
                    value={budgetAmount}
                    autoDecimals={String(hideFraction) !== 'true'}
                    onUpdate={value => {
                      setBudgetAmount(value);
                      if (error) {
                        setError(null);
                      }
                    }}
                  />
                </InitialFocus>
              </InlineField>
            ) : (
              <InlineField
                label={t('Exchange rate ({{from}} to {{to}})', {
                  from: accountCurrency,
                  to: mainCurrency,
                })}
                width="100%"
              >
                <InitialFocus>
                  <ExchangeRateInput
                    value={rate}
                    onUpdate={value => {
                      setRate(value);
                      if (error) {
                        setError(null);
                      }
                    }}
                    style={{ flex: 1 }}
                  />
                </InitialFocus>
              </InlineField>
            )}

            {inputMode === 'rate' && (
              <Text
                style={{
                  marginTop: 10,
                  color: theme.pageTextSubdued,
                  fontSize: 13,
                }}
              >
                <Trans>
                  Budget amount:{' '}
                  {{ amount: format(computedFromRate, 'financial') }}
                </Trans>
              </Text>
            )}

            {error && <FormError style={{ marginTop: 10 }}>{error}</FormError>}

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
