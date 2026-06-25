import { useEffect, useState } from 'react';
import type { FormEvent, CSSProperties, FocusEvent } from 'react';

import { Input } from '@actual-app/components/input';
import {
  formatExchangeRate,
  isValidExchangeRateInput,
  parseExchangeRateInput,
} from '@actual-app/core/shared/currency-transfer';

type ExchangeRateInputProps = {
  value: number;
  onUpdate: (rate: number) => void;
  style?: CSSProperties;
  updateOnInput?: boolean;
  onFocus?: (event: FocusEvent<HTMLInputElement>) => void;
  onBlur?: (event: FocusEvent<HTMLInputElement>) => void;
};

export function ExchangeRateInput({
  value,
  onUpdate,
  style,
  updateOnInput = false,
  onFocus,
  onBlur,
}: ExchangeRateInputProps) {
  const [text, setText] = useState(() => formatExchangeRate(value));
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (updateOnInput && isFocused) {
      return;
    }
    setText(formatExchangeRate(value));
  }, [value, updateOnInput, isFocused]);

  function handleInput(event: FormEvent<HTMLInputElement>) {
    const next = event.currentTarget.value;
    if (!isValidExchangeRateInput(next)) {
      return;
    }

    setText(next);

    if (updateOnInput) {
      const parsed = parseExchangeRateInput(next);
      if (parsed != null) {
        onUpdate(parsed);
      }
    }
  }

  return (
    <Input
      inputMode="decimal"
      value={text}
      onInput={handleInput}
      onFocus={e => {
        setIsFocused(true);
        onFocus?.(e);
      }}
      onBlur={e => {
        setIsFocused(false);
        onBlur?.(e);
      }}
      onUpdate={next => {
        const parsed = parseExchangeRateInput(next);
        if (parsed != null) {
          if (!updateOnInput) {
            onUpdate(parsed);
          }
          setText(formatExchangeRate(parsed));
        }
      }}
      style={style}
    />
  );
}
