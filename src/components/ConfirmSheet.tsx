import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { View } from 'react-native';

import { useTheme } from '../theme';
import { Button } from './Button';
import { Sheet } from './Sheet';
import { Text } from './Text';

type ConfirmOptions = {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

type ConfirmRequest = ConfirmOptions & {
  resolve: (value: boolean) => void;
};

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);

  const confirm = useCallback<ConfirmFn>((options) => {
    return new Promise<boolean>((resolve) => {
      setRequest({ ...options, resolve });
    });
  }, []);

  const handleResolve = useCallback(
    (value: boolean) => {
      if (request) {
        request.resolve(value);
        setRequest(null);
      }
    },
    [request],
  );

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <ConfirmSheet
        request={request}
        onConfirm={() => handleResolve(true)}
        onCancel={() => handleResolve(false)}
      />
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error('useConfirm must be used within a ConfirmProvider');
  }
  return ctx;
}

function ConfirmSheet({
  request,
  onConfirm,
  onCancel,
}: {
  request: ConfirmRequest | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const theme = useTheme();
  const visible = Boolean(request);

  const footer = useMemo(() => {
    if (!request) return null;
    return (
      <View style={{ flexDirection: 'row', gap: theme.spacing[3] }}>
        <Button
          label={request.cancelLabel ?? 'Abbrechen'}
          variant="ghost"
          onPress={onCancel}
          style={{ flex: 1 }}
        />
        <Button
          label={request.confirmLabel ?? 'Bestätigen'}
          variant={request.destructive ? 'danger' : 'primary'}
          onPress={onConfirm}
          style={{ flex: 1 }}
        />
      </View>
    );
  }, [onCancel, onConfirm, request, theme.spacing]);

  return (
    <Sheet
      visible={visible}
      onDismiss={onCancel}
      title={request?.title ?? ''}
      footer={footer}
    >
      {request?.message ? (
        <Text variant="body" tone="secondary">
          {request.message}
        </Text>
      ) : null}
    </Sheet>
  );
}
