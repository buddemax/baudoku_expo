import { useCallback, useMemo, useState } from 'react';
import type { ZodType } from 'zod';

import { Input, type InputProps } from './Input';

type FormFieldState<T> = {
  value: T;
  error: string | null;
  touched: boolean;
  setValue: (next: T) => void;
  setError: (error: string | null) => void;
  validate: () => boolean;
  reset: () => void;
};

/**
 * useZodField — single-field state machine driven by a zod schema.
 *
 * Validates lazily on blur (`validate()`) and on demand at submit time.
 * Errors clear automatically when the value changes after a touch.
 */
export function useZodField<T>(schema: ZodType<T>, initial: T): FormFieldState<T> {
  const [value, setValueState] = useState<T>(initial);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  const setValue = useCallback((next: T) => {
    setValueState(next);
    setError((current) => (current ? null : current));
  }, []);

  const validate = useCallback((): boolean => {
    const result = schema.safeParse(value);
    setTouched(true);
    if (result.success) {
      setError(null);
      return true;
    }
    setError(result.error.issues[0]?.message ?? 'Ungültige Eingabe');
    return false;
  }, [schema, value]);

  const reset = useCallback(() => {
    setValueState(initial);
    setError(null);
    setTouched(false);
  }, [initial]);

  return useMemo(
    () => ({ value, error, touched, setValue, setError, validate, reset }),
    [value, error, touched, setValue, validate, reset],
  );
}

type FormFieldProps = Omit<InputProps, 'value' | 'onChangeText' | 'errorText' | 'onBlur'> & {
  field: FormFieldState<string>;
};

/**
 * FormField — Input bound to a useZodField state machine.
 *
 * Validates on blur. Display the schema's first issue message as Input.errorText
 * so screen readers announce it via the existing label/helpText/error pattern.
 */
export function FormField({ field, ...inputProps }: FormFieldProps) {
  return (
    <Input
      {...inputProps}
      value={field.value}
      onChangeText={field.setValue}
      errorText={field.error ?? undefined}
      onBlur={() => field.validate()}
    />
  );
}
