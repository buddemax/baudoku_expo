import * as Haptics from 'expo-haptics';
import { MoreVertical } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '../theme';
import { IconButton } from './IconButton';
import { Text } from './Text';

export type OverflowMenuItem = {
  key: string;
  label: string;
  icon?: ReactNode;
  destructive?: boolean;
  onSelect: () => void;
  disabled?: boolean;
};

export function OverflowMenu({
  items,
  accessibilityLabel = 'Mehr Aktionen',
}: {
  items: OverflowMenuItem[];
  accessibilityLabel?: string;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);

  const handleSelect = (item: OverflowMenuItem) => {
    if (item.disabled) {
      return;
    }
    void Haptics.selectionAsync();
    setOpen(false);
    setTimeout(() => item.onSelect(), 100);
  };

  return (
    <>
      <View accessibilityState={{ expanded: open }}>
        <IconButton
          accessibilityLabel={accessibilityLabel}
          icon={<MoreVertical color={theme.colors.text} size={24} />}
          onPress={() => setOpen(true)}
          variant="soft"
          size={theme.layout.touchTargetMin}
        />
      </View>
      <Modal animationType="fade" transparent visible={open} onRequestClose={() => setOpen(false)}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Menü schließen"
          onPress={() => setOpen(false)}
          style={{ flex: 1, backgroundColor: theme.colors.overlay, justifyContent: 'flex-end' }}
        >
          <SafeAreaView
            edges={['bottom']}
            style={{
              backgroundColor: theme.colors.surface,
              borderTopLeftRadius: theme.radii.xl,
              borderTopRightRadius: theme.radii.xl,
              padding: theme.spacing[3],
            }}
          >
            <View style={{ gap: theme.spacing[1] }} accessibilityRole="menu">
              {items.map((item) => (
                <Pressable
                  key={item.key}
                  accessibilityRole="menuitem"
                  accessibilityLabel={item.label}
                  accessibilityState={{ disabled: item.disabled }}
                  disabled={item.disabled}
                  onPress={() => handleSelect(item)}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: theme.spacing[3],
                    minHeight: theme.layout.touchTargetMin,
                    paddingHorizontal: theme.spacing[4],
                    borderRadius: theme.radii.md,
                    backgroundColor: pressed ? theme.colors.surfaceMuted : 'transparent',
                    opacity: item.disabled ? 0.5 : 1,
                  })}
                >
                  {item.icon ? <View>{item.icon}</View> : null}
                  <Text
                    variant="body"
                    style={{ color: item.destructive ? theme.colors.danger : theme.colors.text, flex: 1 }}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </SafeAreaView>
        </Pressable>
      </Modal>
    </>
  );
}
