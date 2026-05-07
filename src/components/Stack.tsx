import { View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';

import { useTheme } from '../theme';
import type { SpacingKey } from '../theme';

type StackProps = Omit<ViewProps, 'style'> & {
  gap?: SpacingKey;
  padding?: SpacingKey;
  paddingX?: SpacingKey;
  paddingY?: SpacingKey;
  align?: 'flex-start' | 'flex-end' | 'center' | 'stretch' | 'baseline';
  justify?: 'flex-start' | 'flex-end' | 'center' | 'space-between' | 'space-around' | 'space-evenly';
  flex?: number;
  wrap?: boolean;
  style?: StyleProp<ViewStyle>;
};

const buildBase = (
  gap: number,
  padding: number | undefined,
  paddingX: number | undefined,
  paddingY: number | undefined,
  align: StackProps['align'],
  justify: StackProps['justify'],
  flex: number | undefined,
  wrap: boolean | undefined,
): ViewStyle => ({
  gap,
  padding,
  paddingHorizontal: paddingX,
  paddingVertical: paddingY,
  alignItems: align,
  justifyContent: justify,
  flex,
  flexWrap: wrap ? 'wrap' : undefined,
});

export function VStack({
  gap = '3',
  padding,
  paddingX,
  paddingY,
  align,
  justify,
  flex,
  wrap,
  style,
  children,
  ...rest
}: StackProps) {
  const theme = useTheme();
  return (
    <View
      {...rest}
      style={[
        { flexDirection: 'column' },
        buildBase(
          theme.spacing[gap],
          padding ? theme.spacing[padding] : undefined,
          paddingX ? theme.spacing[paddingX] : undefined,
          paddingY ? theme.spacing[paddingY] : undefined,
          align,
          justify,
          flex,
          wrap,
        ),
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function HStack({
  gap = '3',
  padding,
  paddingX,
  paddingY,
  align = 'center',
  justify,
  flex,
  wrap,
  style,
  children,
  ...rest
}: StackProps) {
  const theme = useTheme();
  return (
    <View
      {...rest}
      style={[
        { flexDirection: 'row' },
        buildBase(
          theme.spacing[gap],
          padding ? theme.spacing[padding] : undefined,
          paddingX ? theme.spacing[paddingX] : undefined,
          paddingY ? theme.spacing[paddingY] : undefined,
          align,
          justify,
          flex,
          wrap,
        ),
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Spacer({ size = '4' }: { size?: SpacingKey }) {
  const theme = useTheme();
  return <View style={{ height: theme.spacing[size], width: theme.spacing[size] }} />;
}

export function Divider({ inset = false }: { inset?: boolean }) {
  const theme = useTheme();
  return (
    <View
      style={{
        height: 1,
        backgroundColor: theme.colors.divider,
        marginHorizontal: inset ? theme.spacing[5] : 0,
      }}
    />
  );
}
