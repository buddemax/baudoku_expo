import { Camera, FilePlus2 } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';
import { z } from 'zod';

import {
  AppHeader,
  Badge,
  Banner,
  Button,
  Card,
  ChoiceChips,
  DataState,
  EmptyState,
  FormField,
  IconButton,
  Input,
  LoadingBlock,
  Screen,
  SegmentedControl,
  SeverityBadge,
  Skeleton,
  Surface,
  SyncStatusPill,
  Text,
  useConfirm,
  useToast,
  useZodField,
  VStack,
} from '../../components';
import { useTheme } from '../../theme';
import type { Severity } from '../../components';

/**
 * Dev-only design-system gallery. Renders every Phase 3 primitive in all
 * meaningful states. Gated by __DEV__ in App.tsx.
 */
export function StorybookScreen({ onBack }: { onBack: () => void }) {
  const theme = useTheme();
  const toast = useToast();
  const confirm = useConfirm();
  const emailField = useZodField(z.string().email('Bitte gültige E-Mail eingeben'), '');
  const passwordField = useZodField(
    z.string().min(8, 'Mindestens 8 Zeichen'),
    '',
  );
  const [segment, setSegment] = useState<'a' | 'b' | 'c'>('a');
  const [chipValue, setChipValue] = useState('high');

  return (
    <Screen scroll padded>
      <AppHeader title="Design System" subtitle="Dev gallery" onBack={onBack} showBackLabel />

      <Section title="Typografie">
        <Text variant="display">Display 32/40</Text>
        <Text variant="title">Title 24/32</Text>
        <Text variant="heading">Heading 20/28</Text>
        <Text variant="subheading">Subheading 18/26</Text>
        <Text variant="bodyLarge">Body Large — Atkinson Hyperlegible</Text>
        <Text variant="body">Body — Standardtext für Beobachtungen, Beschreibungen und Lauftexte.</Text>
        <Text variant="bodyStrong">Body Strong — Hervorhebung in Lauftext</Text>
        <Text variant="caption">Caption — Sekundärtext oder Metadaten</Text>
        <Text variant="captionStrong">Caption Strong</Text>
        <Text variant="label">Label</Text>
        <Text variant="eyebrow">Eyebrow Übersicht</Text>
      </Section>

      <Section title="Farben — Severität">
        <View style={{ flexDirection: 'row', gap: theme.spacing[2], flexWrap: 'wrap' }}>
          {(['info', 'low', 'medium', 'high', 'critical'] as Severity[]).map((s) => (
            <SeverityBadge key={s} severity={s} />
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: theme.spacing[2], flexWrap: 'wrap' }}>
          {(['info', 'low', 'medium', 'high', 'critical'] as Severity[]).map((s) => (
            <SeverityBadge key={s} severity={s} size="sm" />
          ))}
        </View>
      </Section>

      <Section title="Sync-Status-Pill">
        <View style={{ gap: theme.spacing[2], alignItems: 'flex-start' }}>
          <SyncStatusPill networkOnline autoSyncing={false} pending={0} errors={0} lastSyncedAt={new Date()} />
          <SyncStatusPill networkOnline autoSyncing={true} pending={3} errors={0} lastSyncedAt={null} />
          <SyncStatusPill networkOnline autoSyncing={false} pending={5} errors={0} lastSyncedAt={null} />
          <SyncStatusPill networkOnline autoSyncing={false} pending={2} errors={1} lastSyncedAt={null} />
          <SyncStatusPill networkOnline={false} autoSyncing={false} pending={3} errors={0} lastSyncedAt={null} />
          <SyncStatusPill networkOnline={false} autoSyncing={false} pending={0} errors={0} lastSyncedAt={null} />
        </View>
      </Section>

      <Section title="Buttons">
        <Button label="Primary" onPress={() => undefined} />
        <Button label="Secondary" variant="secondary" onPress={() => undefined} />
        <Button label="Danger" variant="danger" onPress={() => undefined} />
        <Button label="Ghost" variant="ghost" onPress={() => undefined} />
        <Button label="Loading" loading onPress={() => undefined} />
        <Button label="Disabled" disabled onPress={() => undefined} />
        <Button label="With Icon" leftIcon={<FilePlus2 color={theme.colors.textInverse} size={18} />} onPress={() => undefined} />
        <View style={{ flexDirection: 'row', gap: theme.spacing[2] }}>
          <IconButton accessibilityLabel="Kamera" icon={<Camera color={theme.colors.text} size={20} />} onPress={() => undefined} />
        </View>
      </Section>

      <Section title="Toast">
        <Button label="Success" variant="secondary" onPress={() => toast.show({ tone: 'success', message: 'Eintrag gespeichert.' })} />
        <Button label="Error" variant="secondary" onPress={() => toast.show({ tone: 'error', message: 'Konnte nicht gespeichert werden.' })} />
        <Button label="Warning" variant="secondary" onPress={() => toast.show({ tone: 'warning', message: 'Offline – wird später übertragen.' })} />
        <Button label="Info + Action" variant="secondary" onPress={() => toast.show({ tone: 'info', message: 'Update verfügbar.', action: { label: 'Anzeigen', onPress: () => undefined } })} />
      </Section>

      <Section title="Confirm Sheet">
        <Button
          label="Destruktive Bestätigung"
          variant="danger"
          onPress={async () => {
            const ok = await confirm({
              title: 'Eintrag löschen?',
              message: 'Diese Aktion kann nicht rückgängig gemacht werden.',
              confirmLabel: 'Löschen',
              destructive: true,
            });
            toast.show({ tone: ok ? 'success' : 'info', message: ok ? 'Bestätigt' : 'Abgebrochen' });
          }}
        />
      </Section>

      <Section title="Form Field (zod)">
        <FormField field={emailField} label="E-Mail" placeholder="name@example.com" autoCapitalize="none" keyboardType="email-address" />
        <FormField field={passwordField} label="Passwort" placeholder="Mindestens 8 Zeichen" secureTextEntry />
        <Button label="Validieren" variant="secondary" onPress={() => {
          const e = emailField.validate();
          const p = passwordField.validate();
          toast.show({ tone: e && p ? 'success' : 'error', message: e && p ? 'Alle Felder ok' : 'Bitte Eingaben prüfen' });
        }} />
      </Section>

      <Section title="Input — Zustände">
        <Input label="Standard" placeholder="Text eingeben" />
        <Input label="Mit Hilfetext" placeholder="trade-id" helpText="Optional. Leer lassen wenn unbekannt." />
        <Input label="Mit Fehler" placeholder="ungültig" errorText="Pflichtfeld" />
        <Input label="Disabled" placeholder="readonly" editable={false} />
        <Input label="Mehrzeilig" placeholder="Beobachtung" multiline minHeight={120} />
      </Section>

      <Section title="Choice / Segmented">
        <ChoiceChips
          options={[
            { value: 'high', label: 'Hoch' },
            { value: 'medium', label: 'Mittel' },
            { value: 'low', label: 'Niedrig' },
          ]}
          value={chipValue}
          onChange={setChipValue}
        />
        <SegmentedControl
          options={[
            { value: 'a', label: 'Alle' },
            { value: 'b', label: 'Offen' },
            { value: 'c', label: 'Erledigt' },
          ]}
          value={segment}
          onChange={(value) => setSegment(value as 'a' | 'b' | 'c')}
        />
      </Section>

      <Section title="Banner">
        <Banner tone="info" title="Information" message="Sync läuft im Hintergrund." />
        <Banner tone="success" title="Gespeichert" message="Bericht wurde versendet." />
        <Banner tone="warning" title="Offline" message="Eintrag wird beim nächsten Sync übertragen." />
        <Banner tone="error" title="Fehler" message="Foto konnte nicht hochgeladen werden." actionLabel="Erneut versuchen" onAction={() => undefined} />
      </Section>

      <Section title="Skeleton & Loading">
        <Skeleton height={64} />
        <Skeleton height={64} />
        <Skeleton height={120} />
        <LoadingBlock />
      </Section>

      <Section title="EmptyState">
        <EmptyState
          title="Noch keine Einträge"
          message="Wechsle zur Erfassung, um den ersten Mangel zu dokumentieren."
          actionLabel="Zur Erfassung"
          onAction={() => undefined}
        />
      </Section>

      <Section title="DataState — alle Branches">
        <DataState
          loading
          error={null}
          data={null}
          loadingFallback="skeleton"
          skeletonRows={2}
        >
          {(d) => <Text>{String(d)}</Text>}
        </DataState>
        <DataState
          loading={false}
          error="Verbindung fehlgeschlagen"
          data={null}
          onRetry={() => toast.show({ tone: 'info', message: 'Retry' })}
        >
          {(d) => <Text>{String(d)}</Text>}
        </DataState>
        <DataState
          loading={false}
          error={null}
          data={[] as string[]}
          isEmpty={(arr) => arr.length === 0}
          emptyTitle="Liste leer"
          emptyMessage="Lege den ersten Eintrag an."
        >
          {(arr) => <Text>{arr.length} Einträge</Text>}
        </DataState>
        <DataState loading={false} error={null} data={['A', 'B', 'C']}>
          {(arr) => <Text>{arr.length} Einträge geladen.</Text>}
        </DataState>
      </Section>

      <Section title="Surfaces & Cards">
        <Surface variant="card" padding="4" elevated bordered>
          <Text variant="bodyStrong">Surface card</Text>
          <Text variant="caption" tone="secondary">elevated · bordered</Text>
        </Surface>
        <Card onPress={() => toast.show({ tone: 'info', message: 'Karte angetippt' })}>
          <Text variant="bodyStrong">Pressable Card</Text>
          <Text variant="caption" tone="secondary">Tap-Feedback + Haptik</Text>
        </Card>
        <View style={{ flexDirection: 'row', gap: theme.spacing[2], flexWrap: 'wrap' }}>
          <Badge label="Neutral" />
          <Badge label="Primary" tone="primary" />
          <Badge label="Success" tone="success" />
          <Badge label="Warning" tone="warning" />
          <Badge label="Danger" tone="danger" />
          <Badge label="Info" tone="info" />
        </View>
      </Section>
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <VStack gap="3" style={{ marginTop: theme.spacing[5] }}>
      <Text variant="eyebrow" tone="primary">
        {title}
      </Text>
      <VStack gap="3">{children}</VStack>
    </VStack>
  );
}
