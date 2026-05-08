import { CheckCircle2, Info, TriangleAlert, XCircle } from 'lucide-react-native';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from 'react';
import { Pressable, View } from 'react-native';
import Animated, {
  FadeInUp,
  FadeOutUp,
  LinearTransition,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../theme';
import { Text } from './Text';

type ToastTone = 'success' | 'error' | 'warning' | 'info';

type ToastInput = {
  message: string;
  tone?: ToastTone;
  duration?: number;
  action?: { label: string; onPress: () => void };
};

type ToastEntry = ToastInput & { id: string };

type ToastApi = {
  show: (input: ToastInput) => string;
  dismiss: (id?: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

const DEFAULT_DURATION = 4000;
const MAX_VISIBLE = 3;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<ToastEntry[]>([]);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const dismiss = useCallback((id?: string) => {
    setEntries((current) => {
      if (!id) {
        Object.values(timers.current).forEach(clearTimeout);
        timers.current = {};
        return [];
      }
      const timer = timers.current[id];
      if (timer) {
        clearTimeout(timer);
        delete timers.current[id];
      }
      return current.filter((entry) => entry.id !== id);
    });
  }, []);

  const show = useCallback<ToastApi['show']>(
    (input) => {
      const id = `toast_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
      const duration = input.duration ?? DEFAULT_DURATION;
      setEntries((current) => [...current, { ...input, id }].slice(-MAX_VISIBLE));
      timers.current[id] = setTimeout(() => dismiss(id), duration);
      return id;
    },
    [dismiss],
  );

  useEffect(
    () => () => {
      Object.values(timers.current).forEach(clearTimeout);
      timers.current = {};
    },
    [],
  );

  const api: ToastApi = { show, dismiss };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastStack entries={entries} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
}

type IconComponent = ComponentType<{ color: string; size: number }>;

function ToastStack({
  entries,
  onDismiss,
}: {
  entries: ToastEntry[];
  onDismiss: (id: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  if (entries.length === 0) return null;

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        top: insets.top + theme.spacing[2],
        left: 0,
        right: 0,
        alignItems: 'center',
        gap: theme.spacing[2],
      }}
    >
      {entries.map((entry) => (
        <ToastItem key={entry.id} entry={entry} onDismiss={() => onDismiss(entry.id)} />
      ))}
    </View>
  );
}

function ToastItem({ entry, onDismiss }: { entry: ToastEntry; onDismiss: () => void }) {
  const theme = useTheme();
  const tone = entry.tone ?? 'info';
  const palette: Record<ToastTone, { bg: string; fg: string; icon: IconComponent }> = {
    success: { bg: theme.colors.successSoft, fg: theme.colors.success, icon: CheckCircle2 },
    error: { bg: theme.colors.dangerSoft, fg: theme.colors.danger, icon: XCircle },
    warning: { bg: theme.colors.warningSoft, fg: theme.colors.warning, icon: TriangleAlert },
    info: { bg: theme.colors.infoSoft, fg: theme.colors.info, icon: Info },
  };
  const { bg, fg, icon: Icon } = palette[tone];

  return (
    <Animated.View
      entering={FadeInUp.duration(220)}
      exiting={FadeOutUp.duration(180)}
      layout={LinearTransition.duration(180)}
      style={{
        maxWidth: 560,
        width: '92%',
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing[3],
        backgroundColor: bg,
        borderColor: fg,
        borderWidth: 1,
        borderRadius: theme.radii.lg,
        paddingHorizontal: theme.spacing[4],
        paddingVertical: theme.spacing[3],
      }}
    >
      <Icon color={fg} size={20} />
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong" style={{ color: fg }}>
          {entry.message}
        </Text>
      </View>
      {entry.action ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={entry.action.label}
          onPress={() => {
            entry.action?.onPress();
            onDismiss();
          }}
          hitSlop={8}
        >
          <Text variant="captionStrong" style={{ color: fg, textDecorationLine: 'underline' }}>
            {entry.action.label}
          </Text>
        </Pressable>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Schließen"
        onPress={onDismiss}
        hitSlop={8}
      >
        <Text variant="caption" style={{ color: fg }}>
          ✕
        </Text>
      </Pressable>
    </Animated.View>
  );
}
