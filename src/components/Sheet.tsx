import { X } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '../theme';
import { IconButton } from './IconButton';
import { Text } from './Text';

export function Sheet({
  visible,
  onDismiss,
  title,
  children,
  footer,
}: {
  visible: boolean;
  onDismiss: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const theme = useTheme();
  return (
    <Modal
      animationType="slide"
      transparent
      visible={visible}
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <View style={{ flex: 1, backgroundColor: theme.colors.overlay, justifyContent: 'flex-end' }}>
        <Pressable
          accessibilityLabel="Hintergrund antippen schließt das Fenster"
          onPress={onDismiss}
          style={{ flex: 1 }}
        />
        <SafeAreaView
          edges={['bottom']}
          style={{
            backgroundColor: theme.colors.surface,
            borderTopLeftRadius: theme.radii.xl,
            borderTopRightRadius: theme.radii.xl,
            maxHeight: '90%',
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: theme.spacing[5],
              paddingVertical: theme.spacing[4],
              borderBottomWidth: 1,
              borderBottomColor: theme.colors.divider,
            }}
          >
            <Text variant="heading">{title ?? ''}</Text>
            <IconButton
              accessibilityLabel="Schließen"
              icon={<X color={theme.colors.text} size={24} />}
              onPress={onDismiss}
              size={44}
            />
          </View>
          <View style={{ padding: theme.spacing[5] }}>{children}</View>
          {footer ? (
            <View
              style={{
                paddingHorizontal: theme.spacing[5],
                paddingTop: theme.spacing[3],
                paddingBottom: theme.spacing[4],
                borderTopWidth: 1,
                borderTopColor: theme.colors.divider,
              }}
            >
              {footer}
            </View>
          ) : null}
        </SafeAreaView>
      </View>
    </Modal>
  );
}
