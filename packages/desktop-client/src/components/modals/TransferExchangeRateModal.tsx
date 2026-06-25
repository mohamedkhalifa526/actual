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
  computeCounterpartyAmount,
  normalizeExchangeRate,
} from '@actual-app/core/shared/currency-transfer';

import {
  Modal,
  ModalButtons,
  ModalCloseButton,
  ModalHeader,
  ModalTitle,
} from '#components/common/Modal';
import { useFormat } from '#hooks/useFormat';
import { ExchangeRateInput } from '#components/util/ExchangeRateInput';
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
  const [rate, setRate] = useState(
    () => normalizeExchangeRate(defaultRate) ?? defaultRate,
  );
  const [error, setError] = useState<string | null>(null);

  const counterpartyAmount = computeCounterpartyAmount(sourceAmount, rate);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (rate <= 0) {
      setError(t('Exchange rate must be a positive number'));
      return;
    }

    onSubmit(rate);
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
              handleSubmit(event);
              state.close();
            }}
          >
            <Text style={{ marginBottom: 15, color: theme.pageTextSubdued }}>
              <Trans>
                Enter the exchange rate from {{ fromCurrency }} to{' '}
                {{ toCurrency }}.
              </Trans>
            </Text>

            <InlineField label={t('Exchange rate')} width="100%">
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

            {counterpartyAmount != null && (
              <Text
                style={{
                  marginTop: 10,
                  color: theme.pageTextSubdued,
                  fontSize: 13,
                }}
              >
                <Trans>
                  Counterparty amount:{' '}
                  {{ amount: format(counterpartyAmount, 'financial') }}
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
