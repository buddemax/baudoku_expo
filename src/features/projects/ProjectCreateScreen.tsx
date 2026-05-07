import type { Session } from '@supabase/supabase-js';
import { CheckCircle2 } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import {
  AppHeader,
  Banner,
  Button,
  ChoiceChips,
  Input,
  Screen,
  Surface,
  Text,
  VStack,
} from '../../components';
import { ProjectDatePickerField } from '../../components/ProjectDatePickerField';
import { projectsApi } from '../../lib/api';
import { useTheme } from '../../theme';
import type { Profile, Project } from '../../types/projects';
import { appraisalTypes, type AppraisalType } from '../../types/projects';
import { projectDateError, projectDateHint } from './date';
import {
  initialProjectForm,
  profileById,
  profileLabel,
  toProjectCreateInput,
  type ProjectFormState,
} from './helpers';

export function ProjectCreateScreen({
  onCancel,
  onCreated,
  profiles,
  session,
  userEmail,
}: {
  onCancel: () => void;
  onCreated: (project: Project) => void;
  profiles: Profile[];
  session: Session;
  userEmail: string;
}) {
  const theme = useTheme();
  const [form, setForm] = useState<ProjectFormState>(() => initialProjectForm());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const currentUserId = session.user.id;
    setForm((current) => ({
      ...current,
      lead_user_id: current.lead_user_id ?? currentUserId,
    }));
  }, [session.user.id]);

  const update = (key: keyof ProjectFormState, value: string | null) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const missingFields = useMemo(
    () =>
      [
        form.project_number.trim(),
        form.client_name.trim(),
        form.object_address.trim(),
        form.site_visit_date.trim(),
        form.appraisal_type,
      ].filter((value) => !value).length,
    [form],
  );

  const dateError = projectDateError(form.site_visit_date);
  const canSubmit = missingFields === 0 && !dateError && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const project = await projectsApi.create(session, toProjectCreateInput(form));
      onCreated(project);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Projekt konnte nicht gespeichert werden.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen scroll keyboardAvoiding edges={['bottom']} padded>
      <AppHeader title="Neues Projekt" subtitle="Stammdaten erfassen" onBack={onCancel} showBackLabel backLabel="Abbrechen" />

      <Surface variant="card" padding="5" elevated bordered style={{ gap: theme.spacing[4] }}>
        <Text variant="heading">Projektdaten</Text>

        <Input
          label="Projektnummer"
          autoCapitalize="characters"
          editable={!submitting}
          onChangeText={(value) => update('project_number', value)}
          placeholder="BBA-2026-001"
          value={form.project_number}
        />

        <Input
          label="Auftraggeber"
          editable={!submitting}
          onChangeText={(value) => update('client_name', value)}
          placeholder="Muster GmbH"
          value={form.client_name}
        />

        <Input
          label="Objektadresse"
          editable={!submitting}
          multiline
          minHeight={96}
          onChangeText={(value) => update('object_address', value)}
          placeholder="Straße, PLZ Ort"
          value={form.object_address}
        />

        <View style={{ gap: theme.spacing[2] }}>
          <Text variant="label">Datum Ortstermin</Text>
          <ProjectDatePickerField
            disabled={submitting}
            onChange={(value) => update('site_visit_date', value)}
            value={form.site_visit_date}
          />
          <Text variant="caption" tone="muted">
            {projectDateHint}
          </Text>
        </View>

        <View style={{ gap: theme.spacing[2] }}>
          <Text variant="label">Art des Gutachtens</Text>
          <ChoiceChips<AppraisalType>
            value={form.appraisal_type}
            options={appraisalTypes.map((type) => ({ value: type, label: type }))}
            onChange={(value) => update('appraisal_type', value)}
          />
        </View>

        <View style={{ gap: theme.spacing[2] }}>
          <Text variant="label">Bearbeiter</Text>
          <Surface variant="muted" padding="3" radius="md">
            <Text variant="bodyStrong">
              {profileLabel(profileById(profiles, form.lead_user_id), userEmail)}
            </Text>
          </Surface>
          {profiles.length > 0 ? (
            <ChoiceChips<string>
              value={form.lead_user_id ?? ''}
              options={profiles.map((profile) => ({ value: profile.id, label: profile.display_name }))}
              onChange={(value) => update('lead_user_id', value)}
            />
          ) : null}
        </View>

        {error ? <Banner tone="error" title="Speichern fehlgeschlagen" message={error} /> : null}
        {dateError ? <Banner tone="warning" title="Datum prüfen" message={dateError} /> : null}
        {missingFields > 0 ? (
          <Text variant="caption" tone="muted">
            Es fehlen noch {missingFields} Pflichtangaben.
          </Text>
        ) : null}
      </Surface>

      <View style={{ flexDirection: 'row', gap: theme.spacing[3] }}>
        <View style={{ flex: 1 }}>
          <Button label="Abbrechen" onPress={onCancel} variant="secondary" size="lg" fullWidth disabled={submitting} />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            label="Speichern"
            onPress={submit}
            variant="primary"
            size="lg"
            fullWidth
            disabled={!canSubmit}
            loading={submitting}
            leftIcon={<CheckCircle2 color={theme.colors.onPrimary} size={22} />}
          />
        </View>
      </View>
    </Screen>
  );
}
