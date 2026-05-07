import {
  Download,
  FileText,
  Image as ImageIcon,
  Mail,
  MailPlus,
  Plus,
  Save,
  Send,
  Trash2,
} from 'lucide-react-native';
import { useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { Linking, View } from 'react-native';

import { Banner, Button, Disclosure, Input, Sheet, Surface, Text, VStack } from '../../../components';
import { formatDateTime } from '../../../lib/formatters';
import { useTheme } from '../../../theme';
import type {
  EmailRecipient,
  GeneralFinding,
  PlanFile,
  Profile,
  Project,
  ProjectConclusion,
  ReportEmailRequest,
  ReportEmailResponse,
  ReportPreview,
  ReportVersion,
  ReportWarning,
} from '../../../types/projects';

type ReportEmailTarget =
  | {
      type: 'version';
      version: ReportVersion;
    }
  | {
      type: 'generate';
    };

type ReportEmailFormState = {
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  body: string;
};

type ReportEmailFieldErrors = Partial<Record<keyof ReportEmailFormState, string>>;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const splitEmailInput = (value: string) =>
  value
    .split(/[\n,;]+/)
    .map((item) => item.trim())
    .filter(Boolean);

const toRecipients = (value: string): EmailRecipient[] =>
  splitEmailInput(value).map((email) => ({ email }));

const invalidEmails = (value: string) =>
  splitEmailInput(value).filter((email) => !emailPattern.test(email));

const invalidEmailMessage = (emails: string[]) =>
  emails.length === 1
    ? `Ungültige E-Mail-Adresse: ${emails[0]}`
    : `Ungültige E-Mail-Adressen: ${emails.join(', ')}`;

const defaultReportEmailForm = (
  project: Project,
  currentUserProfile: Profile | null,
  currentUserEmail?: string | null,
): ReportEmailFormState => {
  const profileName = currentUserProfile?.display_name.trim();
  const profileEmail = currentUserProfile?.email.trim();
  const fallbackEmail = currentUserEmail?.trim();
  const replyEmail = profileEmail || fallbackEmail;
  const signature = profileName || replyEmail || '';
  const replyLine = replyEmail
    ? `Bei Rückfragen erreichen Sie mich unter ${replyEmail}.`
    : 'Bei Rückfragen melden Sie sich gerne.';

  return {
    to: '',
    cc: '',
    bcc: '',
    subject: `Bericht ${project.project_number} - ${project.object_address}`,
    body: [
      'Guten Tag,',
      `anbei erhalten Sie den Bericht ${project.project_number} zum Objekt ${project.object_address} als Word- und PDF-Datei.`,
      replyLine,
      'Mit freundlichen Grüßen',
      signature,
    ]
      .filter(Boolean)
      .join('\n\n'),
  };
};

const validateReportEmailForm = (
  form: ReportEmailFormState,
): { errors: ReportEmailFieldErrors; request: ReportEmailRequest | null } => {
  const errors: ReportEmailFieldErrors = {};
  const to = toRecipients(form.to);
  const cc = toRecipients(form.cc);
  const bcc = toRecipients(form.bcc);
  const invalidTo = invalidEmails(form.to);
  const invalidCc = invalidEmails(form.cc);
  const invalidBcc = invalidEmails(form.bcc);

  if (!to.length) {
    errors.to = 'Bitte mindestens einen Empfänger eintragen.';
  } else if (invalidTo.length) {
    errors.to = invalidEmailMessage(invalidTo);
  }
  if (invalidCc.length) {
    errors.cc = invalidEmailMessage(invalidCc);
  }
  if (invalidBcc.length) {
    errors.bcc = invalidEmailMessage(invalidBcc);
  }
  if (!form.subject.trim()) {
    errors.subject = 'Bitte einen Betreff eintragen.';
  }
  if (!form.body.trim()) {
    errors.body = 'Bitte einen Begleittext eintragen.';
  }

  if (Object.keys(errors).length) {
    return { errors, request: null };
  }

  return {
    errors,
    request: {
      to,
      cc,
      bcc,
      subject: form.subject.trim(),
      message: form.body.trim(),
    },
  };
};

const reportWarningSeverityRank: Record<ReportWarning['severity'], number> = {
  warning: 0,
  info: 1,
};

const countLabel = (count: number, singular: string, plural: string) =>
  `${count} ${count === 1 ? singular : plural}`;

const reportWarningSummary = (warnings: ReportWarning[]) => {
  const warningCount = warnings.filter((warning) => warning.severity === 'warning').length;
  const infoCount = warnings.filter((warning) => warning.severity === 'info').length;
  const parts = [
    warningCount ? countLabel(warningCount, 'Warnung', 'Warnungen') : null,
    infoCount ? countLabel(infoCount, 'Hinweis', 'Hinweise') : null,
  ].filter(Boolean);

  return parts.length ? parts.join(', ') : 'Keine offenen Hinweise';
};

export function ReportTab({
  busy,
  conclusion,
  conclusionText,
  currentUserEmail,
  currentUserProfile,
  findingDrafts,
  generalFindings,
  newFindingText,
  onCreateGeneralFinding,
  onDeleteGeneralFinding,
  onExportPlan,
  onGenerateReport,
  onSaveConclusion,
  onSendReport,
  onUpdateGeneralFinding,
  plans,
  planExportBusy,
  preview,
  project,
  setConclusionText,
  setFindingDrafts,
  setNewFindingText,
  versions,
}: {
  busy: string | null;
  conclusion: ProjectConclusion | null;
  conclusionText: string;
  currentUserEmail?: string | null;
  currentUserProfile: Profile | null;
  findingDrafts: Record<string, string>;
  generalFindings: GeneralFinding[];
  newFindingText: string;
  onCreateGeneralFinding: () => void;
  onDeleteGeneralFinding: (findingId: string) => void;
  onExportPlan: (plan: PlanFile, format: 'source' | 'image') => void;
  onGenerateReport: () => void;
  onSaveConclusion: () => void;
  onSendReport: (
    versionId: string | null,
    input: ReportEmailRequest,
  ) => Promise<ReportEmailResponse | null>;
  onUpdateGeneralFinding: (finding: GeneralFinding) => void;
  plans: PlanFile[];
  planExportBusy: string | null;
  preview: ReportPreview | null;
  project: Project;
  setConclusionText: (value: string) => void;
  setFindingDrafts: Dispatch<SetStateAction<Record<string, string>>>;
  setNewFindingText: (value: string) => void;
  versions: ReportVersion[];
}) {
  const theme = useTheme();
  const defaultEmailForm = useMemo(
    () => defaultReportEmailForm(project, currentUserProfile, currentUserEmail),
    [currentUserEmail, currentUserProfile, project],
  );
  const [emailTarget, setEmailTarget] = useState<ReportEmailTarget | null>(null);
  const [emailForm, setEmailForm] = useState<ReportEmailFormState>(defaultEmailForm);
  const [emailFieldErrors, setEmailFieldErrors] = useState<ReportEmailFieldErrors>({});
  const [emailError, setEmailError] = useState<string | null>(null);
  const targetVersionId = emailTarget?.type === 'version' ? emailTarget.version.id : null;
  const emailBusy =
    busy === 'report-generate-send' ||
    (targetVersionId ? busy === `report-send-${targetVersionId}` : Boolean(busy?.startsWith('report-send-')));
  const reportWarnings = preview?.warnings ?? [];
  const sortedReportWarnings = useMemo(
    () =>
      [...reportWarnings].sort(
        (left, right) => reportWarningSeverityRank[left.severity] - reportWarningSeverityRank[right.severity],
      ),
    [reportWarnings],
  );
  const reportWarningsSummary = useMemo(() => reportWarningSummary(reportWarnings), [reportWarnings]);

  const openEmailSheet = (target: ReportEmailTarget) => {
    setEmailTarget(target);
    setEmailForm(defaultEmailForm);
    setEmailFieldErrors({});
    setEmailError(null);
  };

  const dismissEmailSheet = () => {
    if (emailBusy) {
      return;
    }
    setEmailTarget(null);
    setEmailFieldErrors({});
    setEmailError(null);
  };

  const updateEmailForm = (key: keyof ReportEmailFormState, value: string) => {
    setEmailForm((current) => ({ ...current, [key]: value }));
    setEmailFieldErrors((current) => ({ ...current, [key]: undefined }));
    setEmailError(null);
  };

  const submitEmail = async () => {
    if (!emailTarget || emailBusy) {
      return;
    }

    const validation = validateReportEmailForm(emailForm);
    setEmailFieldErrors(validation.errors);
    if (!validation.request) {
      setEmailError('Bitte die markierten Felder korrigieren.');
      return;
    }

    setEmailError(null);
    try {
      const response = await onSendReport(targetVersionId, validation.request);
      if (response) {
        setEmailTarget(null);
      }
    } catch (sendError) {
      setEmailError(sendError instanceof Error ? sendError.message : 'Bericht konnte nicht versendet werden.');
    }
  };

  return (
    <VStack gap="4">
      <Surface variant="card" padding="5" elevated bordered style={{ gap: theme.spacing[3] }}>
        <Text variant="heading">Allgemeine Feststellungen</Text>
        <Input
          multiline
          minHeight={120}
          onChangeText={setNewFindingText}
          placeholder="Neue Feststellung – frei beschreiben"
          value={newFindingText}
        />
        <Button
          label="Feststellung hinzufügen"
          onPress={onCreateGeneralFinding}
          variant="primary"
          size="md"
          fullWidth
          leftIcon={<Plus color={theme.colors.onPrimary} size={20} />}
          loading={busy === 'finding-create'}
          disabled={!newFindingText.trim() || Boolean(busy)}
        />
        {generalFindings.length === 0 ? (
          <Text variant="caption" tone="muted">
            Noch keine allgemeinen Feststellungen.
          </Text>
        ) : null}
        {generalFindings.map((finding, index) => (
          <Surface key={finding.id} variant="muted" padding="3" radius="md" style={{ gap: theme.spacing[2] }}>
            <Text variant="captionStrong" tone="muted">
              Feststellung {index + 1}
            </Text>
            <Input
              multiline
              minHeight={96}
              onChangeText={(value) => setFindingDrafts((current) => ({ ...current, [finding.id]: value }))}
              placeholder="Text der Feststellung"
              value={findingDrafts[finding.id] ?? finding.text}
            />
            <View style={{ flexDirection: 'row', gap: theme.spacing[2] }}>
              <Button
                label="Speichern"
                onPress={() => onUpdateGeneralFinding(finding)}
                variant="secondary"
                size="sm"
                leftIcon={<Save color={theme.colors.text} size={18} />}
                disabled={Boolean(busy)}
              />
              <Button
                label="Löschen"
                onPress={() => onDeleteGeneralFinding(finding.id)}
                variant="ghost"
                size="sm"
                leftIcon={<Trash2 color={theme.colors.danger} size={18} />}
                disabled={Boolean(busy)}
              />
            </View>
          </Surface>
        ))}
      </Surface>

      <Surface variant="card" padding="5" elevated bordered style={{ gap: theme.spacing[3] }}>
        <Text variant="heading">Fazit</Text>
        <Input
          multiline
          minHeight={140}
          onChangeText={setConclusionText}
          placeholder="Fazit für den Bericht"
          value={conclusionText}
        />
        <Button
          label={conclusion ? 'Fazit speichern' : 'Fazit anlegen'}
          onPress={onSaveConclusion}
          variant="primary"
          size="md"
          fullWidth
          leftIcon={<Save color={theme.colors.onPrimary} size={20} />}
          loading={busy === 'conclusion-save'}
          disabled={!conclusionText.trim() || Boolean(busy)}
        />
      </Surface>

      <Surface variant="card" padding="5" elevated bordered style={{ gap: theme.spacing[3] }}>
        <Disclosure
          defaultOpen={false}
          accessibilityLabel="Hinweise zum Bericht ein- oder ausklappen"
          trigger={
            <View style={{ gap: theme.spacing[1] }}>
              <Text variant="heading">Hinweise zum Bericht</Text>
              <Text variant="caption" tone="muted">
                {reportWarningsSummary}
              </Text>
            </View>
          }
        >
          {sortedReportWarnings.length ? (
            <VStack gap="2">
              {sortedReportWarnings.map((warning) => (
                <Banner
                  key={`${warning.code}-${warning.message}`}
                  tone={warning.severity === 'warning' ? 'warning' : 'info'}
                  title={warning.severity === 'warning' ? 'Warnung' : 'Hinweis'}
                  message={warning.message}
                />
              ))}
            </VStack>
          ) : (
            <Text variant="body" tone="muted">
              Keine offenen Hinweise – der Bericht ist bereit.
            </Text>
          )}
        </Disclosure>
      </Surface>

      <Surface variant="card" padding="5" elevated bordered style={{ gap: theme.spacing[3] }}>
        <Text variant="heading">Bericht erzeugen</Text>
        <Button
          label="Bericht als Word herunterladen"
          onPress={onGenerateReport}
          variant="primary"
          size="lg"
          fullWidth
          leftIcon={<FileText color={theme.colors.onPrimary} size={22} />}
          loading={busy === 'report'}
          disabled={Boolean(busy)}
        />
        <Button
          label="Bericht erzeugen und per E-Mail senden"
          onPress={() => openEmailSheet({ type: 'generate' })}
          variant="secondary"
          size="lg"
          fullWidth
          leftIcon={<MailPlus color={theme.colors.text} size={22} />}
          loading={busy === 'report-generate-send' || (emailTarget?.type === 'generate' && Boolean(busy?.startsWith('report-send-')))}
          disabled={Boolean(busy)}
        />
        {versions.length === 0 ? (
          <Text variant="caption" tone="muted">
            Noch keine erzeugten Berichte.
          </Text>
        ) : null}
        <VStack gap="2">
          {versions.map((version) => (
            <View
              key={version.id}
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: theme.spacing[2],
                paddingTop: theme.spacing[3],
                borderTopWidth: 1,
                borderTopColor: theme.colors.divider,
              }}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="bodyStrong">Version {version.version_number}</Text>
                <Text variant="caption" tone="muted">
                  {formatDateTime(version.generated_at)} – {version.warning_count} Hinweise
                </Text>
              </View>
              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: theme.spacing[2],
                  justifyContent: 'flex-end',
                }}
              >
                {version.download_url ? (
                  <Button
                    label="Word öffnen"
                    onPress={() => Linking.openURL(version.download_url as string)}
                    variant="secondary"
                    size="sm"
                    leftIcon={<Download color={theme.colors.text} size={18} />}
                  />
                ) : null}
                {version.pdf_download_url ? (
                  <Button
                    label="PDF öffnen"
                    onPress={() => Linking.openURL(version.pdf_download_url as string)}
                    variant="secondary"
                    size="sm"
                    leftIcon={<FileText color={theme.colors.text} size={18} />}
                  />
                ) : null}
                <Button
                  label="E-Mail"
                  onPress={() => openEmailSheet({ type: 'version', version })}
                  variant="secondary"
                  size="sm"
                  leftIcon={<Mail color={theme.colors.text} size={18} />}
                  loading={busy === `report-send-${version.id}`}
                  disabled={Boolean(busy)}
                />
              </View>
            </View>
          ))}
        </VStack>
      </Surface>

      <Surface variant="card" padding="5" elevated bordered style={{ gap: theme.spacing[3] }}>
        <Text variant="heading">Zeichnungen herunterladen</Text>
        {plans.length === 0 ? (
          <Text variant="caption" tone="muted">
            Noch keine Zeichnungen im Projekt.
          </Text>
        ) : null}
        <VStack gap="2">
          {plans.map((plan) => (
            <View
              key={plan.id}
              style={{
                gap: theme.spacing[2],
                paddingTop: theme.spacing[3],
                borderTopWidth: 1,
                borderTopColor: theme.colors.divider,
              }}
            >
              <View style={{ gap: 2 }}>
                <Text variant="bodyStrong">{plan.name}</Text>
                <Text variant="caption" tone="muted">
                  {plan.file_type.toUpperCase()} – {plan.markers.length} Marker
                </Text>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing[2] }}>
                <Button
                  label={plan.file_type === 'pdf' ? 'Markiertes PDF herunterladen' : 'Markiertes Bild herunterladen'}
                  onPress={() => onExportPlan(plan, 'source')}
                  variant="primary"
                  size="sm"
                  loading={planExportBusy === `${plan.id}:source`}
                  disabled={Boolean(planExportBusy)}
                  leftIcon={<Download color={theme.colors.onPrimary} size={18} />}
                />
                {plan.file_type === 'pdf' ? (
                  <Button
                    label="Markiertes Planbild herunterladen"
                    onPress={() => onExportPlan(plan, 'image')}
                    variant="secondary"
                    size="sm"
                    loading={planExportBusy === `${plan.id}:image`}
                    disabled={Boolean(planExportBusy)}
                    leftIcon={<ImageIcon color={theme.colors.text} size={18} />}
                  />
                ) : null}
                {plan.media_asset?.signed_url ? (
                  <Button
                    label="Original herunterladen"
                    onPress={() => Linking.openURL(plan.media_asset?.signed_url as string)}
                    variant="ghost"
                    size="sm"
                    leftIcon={<Download color={theme.colors.text} size={18} />}
                  />
                ) : null}
              </View>
            </View>
          ))}
        </VStack>
      </Surface>

      <Sheet
        visible={Boolean(emailTarget)}
        onDismiss={dismissEmailSheet}
        title={emailTarget?.type === 'generate' ? 'Bericht per E-Mail senden' : 'Version per E-Mail senden'}
        footer={
          <View style={{ flexDirection: 'row', gap: theme.spacing[3] }}>
            <View style={{ flex: 1 }}>
              <Button
                label="Abbrechen"
                onPress={dismissEmailSheet}
                variant="secondary"
                size="md"
                fullWidth
                disabled={emailBusy}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                label={emailTarget?.type === 'generate' ? 'Erzeugen und senden' : 'Senden'}
                onPress={submitEmail}
                variant="primary"
                size="md"
                fullWidth
                loading={emailBusy}
                disabled={emailBusy}
                leftIcon={<Send color={theme.colors.onPrimary} size={18} />}
              />
            </View>
          </View>
        }
      >
        <VStack gap="4">
          {emailError ? <Banner tone="error" title="E-Mail nicht gesendet" message={emailError} /> : null}
          <Input
            autoCapitalize="none"
            autoCorrect={false}
            errorText={emailFieldErrors.to}
            inputMode="email"
            keyboardType="email-address"
            label="Empfänger"
            onChangeText={(value) => updateEmailForm('to', value)}
            placeholder="name@example.com"
            value={emailForm.to}
          />
          <Input
            autoCapitalize="none"
            autoCorrect={false}
            errorText={emailFieldErrors.cc}
            helpText="Mehrere Adressen mit Komma oder Zeilenumbruch trennen."
            inputMode="email"
            keyboardType="email-address"
            label="CC"
            multiline
            minHeight={76}
            onChangeText={(value) => updateEmailForm('cc', value)}
            placeholder="kopie@example.com"
            value={emailForm.cc}
          />
          <Input
            autoCapitalize="none"
            autoCorrect={false}
            errorText={emailFieldErrors.bcc}
            helpText="Mehrere Adressen mit Komma oder Zeilenumbruch trennen."
            inputMode="email"
            keyboardType="email-address"
            label="BCC"
            multiline
            minHeight={76}
            onChangeText={(value) => updateEmailForm('bcc', value)}
            placeholder="blindkopie@example.com"
            value={emailForm.bcc}
          />
          <Input
            errorText={emailFieldErrors.subject}
            label="Betreff"
            onChangeText={(value) => updateEmailForm('subject', value)}
            value={emailForm.subject}
          />
          <Input
            errorText={emailFieldErrors.body}
            label="Begleittext"
            multiline
            minHeight={150}
            onChangeText={(value) => updateEmailForm('body', value)}
            value={emailForm.body}
          />
        </VStack>
      </Sheet>
    </VStack>
  );
}
