import type { ReactNode } from 'react';
import { View } from 'react-native';

import { useTheme } from '../theme';
import { Banner, type BannerTone } from './Banner';
import { Button } from './Button';
import { ChoiceChips } from './ChoiceChips';
import { EmptyState as NewEmptyState } from './EmptyState';
import { LoadingBlock as NewLoadingBlock } from './Loading';
import { Text } from './Text';

export function FieldLabel({ label }: { label: string }) {
  return (
    <Text variant="label" style={{ marginTop: 4 }}>
      {label}
    </Text>
  );
}

export function DetailRow({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View
      style={{
        gap: theme.spacing[1],
        paddingTop: theme.spacing[3],
        borderTopWidth: 1,
        borderTopColor: theme.colors.divider,
      }}
    >
      <Text variant="caption" tone="muted">
        {label}
      </Text>
      <Text variant="body" tone="default">
        {value}
      </Text>
    </View>
  );
}

export function LoadingBlock({ label }: { label: string }) {
  return <NewLoadingBlock label={label} />;
}

export function EmptyState({
  actionLabel,
  message,
  onAction,
  title,
}: {
  actionLabel: string;
  message: string;
  onAction: () => void;
  title: string;
}) {
  return <NewEmptyState title={title} message={message} actionLabel={actionLabel} onAction={onAction} />;
}

export function InlineNotice({
  actionLabel,
  message,
  onAction,
  title,
  tone,
}: {
  actionLabel?: string;
  message: string;
  onAction?: () => void;
  title: string;
  tone: 'error' | 'info' | 'success' | 'warning';
}) {
  const bannerTone: BannerTone = tone === 'error' ? 'error' : tone === 'success' ? 'success' : tone === 'warning' ? 'warning' : 'info';
  return <Banner title={title} message={message} tone={bannerTone} actionLabel={actionLabel} onAction={onAction} />;
}

export function ChoiceButton({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <ChoiceChips<string>
      value={active ? '__active' : '__inactive'}
      options={[{ value: '__active', label }]}
      onChange={onPress}
    />
  );
}

export function PrimaryButton({
  disabled,
  label,
  loading,
  onPress,
  size = 'default',
}: {
  disabled?: boolean;
  label: string;
  loading?: boolean;
  onPress: () => void;
  size?: 'default' | 'small';
}) {
  return (
    <Button
      label={label}
      onPress={onPress}
      disabled={disabled}
      loading={loading}
      variant="primary"
      size={size === 'small' ? 'sm' : 'lg'}
      fullWidth={size !== 'small'}
    />
  );
}

export function SecondaryButton({
  disabled,
  label,
  onPress,
  size = 'default',
}: {
  disabled?: boolean;
  label: string;
  onPress: () => void;
  size?: 'default' | 'small';
}) {
  return (
    <Button
      label={label}
      onPress={onPress}
      disabled={disabled}
      variant="secondary"
      size={size === 'small' ? 'sm' : 'lg'}
      fullWidth={size !== 'small'}
    />
  );
}

export function DangerButton({
  disabled,
  label,
  onPress,
  size = 'default',
}: {
  disabled?: boolean;
  label: string;
  onPress: () => void;
  size?: 'default' | 'small';
}) {
  return (
    <Button
      label={label}
      onPress={onPress}
      disabled={disabled}
      variant="danger"
      size={size === 'small' ? 'sm' : 'lg'}
      fullWidth={size !== 'small'}
    />
  );
}

// Pass-through children wrapper kept for any legacy usage
export function LegacyView({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
