import DateTimePicker from '@react-native-community/datetimepicker';
import { Calendar } from 'lucide-react-native';
import { useState } from 'react';
import { Platform, Pressable, View } from 'react-native';

import { isoDateToPickerDate, pickerDateToIsoDate } from '../features/projects/date';
import { formatDate, today } from '../lib/formatters';
import { useTheme } from '../theme';
import { Button } from './Button';
import { Text } from './Text';

export function ProjectDatePickerField({
  disabled,
  onChange,
  value,
}: {
  disabled?: boolean;
  onChange: (value: string) => void;
  value: string;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(Platform.OS === 'ios');
  const pickerDate = isoDateToPickerDate(value);

  return (
    <View style={{ gap: theme.spacing[2] }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Datum auswählen"
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={({ pressed }) => ({
          minHeight: theme.layout.touchTargetMin,
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing[3],
          paddingHorizontal: theme.layout.inputPaddingX,
          paddingVertical: theme.spacing[3],
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          borderWidth: 1,
          borderRadius: theme.radii.md,
          opacity: disabled ? 0.55 : pressed ? 0.85 : 1,
        })}
      >
        <Calendar color={theme.colors.primary} size={22} />
        <View style={{ flex: 1 }}>
          <Text variant="bodyStrong">{formatDate(value)}</Text>
          <Text variant="caption" tone="muted">
            Datum tippen zum Ändern
          </Text>
        </View>
      </Pressable>
      {open ? (
        <DateTimePicker
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          mode="date"
          onChange={(_event, selectedDate) => {
            if (Platform.OS !== 'ios') {
              setOpen(false);
            }
            if (selectedDate) {
              onChange(pickerDateToIsoDate(selectedDate));
            }
          }}
          value={pickerDate}
        />
      ) : null}
      {Platform.OS === 'ios' ? (
        <Button label="Heute" onPress={() => onChange(today())} disabled={disabled} variant="ghost" size="sm" />
      ) : null}
    </View>
  );
}
