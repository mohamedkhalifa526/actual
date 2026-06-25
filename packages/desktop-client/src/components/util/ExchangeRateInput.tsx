import { useEffect, useState } from 'react';

import { Input } from '@actual-app/components/input';
import {
  formatExchangeRate,
  isValidExchangeRateInput,
  parseExchangeRateInput,
} from '@actual-app/core/shared/currency-transfer';
import type { CSSProperties } from 'react';

type ExchangeRateInputProps = {
  value: number;
  onUpdate: (rate: number) => void;
  style?: CSSProperties;
};

export function ExchangeRateInput({
  value,
  onUpdate,
  style,
}: ExchangeRateInputProps) {
  const [text, setText] = useState(() => formatExchangeRate(value));

  useEffect(() => {
    setText(formatExchangeRate(value));
  }, [value]);

  return (
    <Input
      inputMode="decimal"
      value={text}
      onChangeValue={next => {
        if (isValidExchangeRateInput(next)) {
          setText(next);
        }
      }}
      onUpdate={next => {
        const parsed = parseExchangeRateInput(next);
        if (parsed != null) {
          onUpdate(parsed);
          setText(formatExchangeRate(parsed));
        }
      }}
      style={style}
    />
  );
}
