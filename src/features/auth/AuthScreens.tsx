import { Mail, KeyRound, Lock } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { Banner, Button, Input, Screen, Surface, Text, VStack } from '../../components';
import { config } from '../../lib/config';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../../theme';

const authErrorMessage = (message: string) => {
  const normalized = message.toLowerCase();
  if (normalized.includes('invalid login credentials')) {
    return 'E-Mail oder Passwort ist nicht korrekt.';
  }
  if (normalized.includes('email not confirmed')) {
    return 'Diese E-Mail-Adresse ist noch nicht bestätigt.';
  }
  return message;
};

export function LoginScreen() {
  const theme = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetNotice, setResetNotice] = useState<string | null>(null);

  const canSubmit = email.trim().length > 0 && password.length > 0 && !loading && !resetLoading;
  const canResetPassword = email.trim().length > 0 && !loading && !resetLoading;

  const handleLogin = async () => {
    if (!supabase || !canSubmit) {
      return;
    }

    setLoading(true);
    setError(null);
    setResetNotice(null);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      setError(authErrorMessage(signInError.message));
    }

    setLoading(false);
  };

  const handleResetPassword = async () => {
    if (!supabase || !canResetPassword) {
      return;
    }

    setResetLoading(true);
    setError(null);
    setResetNotice(null);

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: 'bba-baudoku://reset-password',
    });

    if (resetError) {
      setError('Reset-Mail konnte nicht angefordert werden. Bitte Verbindung prüfen und später erneut versuchen.');
    } else {
      setResetNotice('Wenn diese E-Mail bei BBA hinterlegt ist, schicken wir dir eine Nachricht zum Zurücksetzen.');
    }

    setResetLoading(false);
  };

  return (
    <Screen scroll keyboardAvoiding edges={['top', 'bottom']} padded contentStyle={{ flexGrow: 1, justifyContent: 'center' }}>
      <VStack gap="6">
        <View>
          <Text variant="caption" tone="primary" style={{ textTransform: 'uppercase', letterSpacing: 1 }}>
            BBA Baudoku
          </Text>
          <Text variant="display" style={{ marginTop: theme.spacing[2] }}>
            Willkommen zurück
          </Text>
          <Text variant="bodyLarge" tone="secondary" style={{ marginTop: theme.spacing[2] }}>
            Melde dich mit deinem BBA-Zugang an, um Projekte zu öffnen.
          </Text>
        </View>

        <Surface variant="card" padding="5" elevated bordered style={{ gap: theme.spacing[4] }}>
          <Input
            label="E-Mail"
            autoCapitalize="none"
            autoComplete="email"
            inputMode="email"
            editable={!loading}
            onChangeText={setEmail}
            placeholder="name@bba.de"
            leftAdornment={<Mail color={theme.colors.textMuted} size={20} />}
            value={email}
          />
          <Input
            label="Passwort"
            autoCapitalize="none"
            editable={!loading}
            onChangeText={setPassword}
            placeholder="Passwort"
            secureTextEntry
            leftAdornment={<Lock color={theme.colors.textMuted} size={20} />}
            value={password}
          />

          {error ? <Banner tone="error" message={error} title="Anmeldung fehlgeschlagen" /> : null}
          {resetNotice ? <Banner tone="success" message={resetNotice} title="E-Mail unterwegs" /> : null}

          <Button label="Einloggen" onPress={handleLogin} loading={loading} disabled={!canSubmit} variant="primary" size="lg" fullWidth />
          <Button
            label={resetLoading ? 'Wird gesendet…' : 'Passwort vergessen'}
            onPress={handleResetPassword}
            disabled={!canResetPassword}
            variant="ghost"
            size="md"
          />
          <Text variant="caption" tone="muted">
            Für den Reset reicht die E-Mail-Adresse. Wir verraten nicht, ob die Adresse existiert.
          </Text>
        </Surface>

        <Text variant="caption" tone="muted" align="center">
          Server: {config.apiUrl}
        </Text>
      </VStack>
    </Screen>
  );
}

export function PasswordRecoveryScreen({ onDone }: { onDone: () => void }) {
  const theme = useTheme();
  const [password, setPassword] = useState('');
  const [passwordRepeat, setPasswordRepeat] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tooShort = password.length > 0 && password.length < 8;
  const mismatch = passwordRepeat.length > 0 && password !== passwordRepeat;
  const canSubmit = password.length >= 8 && password === passwordRepeat && !loading;

  const submit = async () => {
    if (!supabase || !canSubmit) {
      return;
    }

    setLoading(true);
    setError(null);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      setError('Passwort konnte nicht gespeichert werden. Bitte fordere den Link erneut an.');
      return;
    }

    onDone();
  };

  return (
    <Screen scroll keyboardAvoiding edges={['top', 'bottom']} padded contentStyle={{ flexGrow: 1, justifyContent: 'center' }}>
      <VStack gap="6">
        <View>
          <Text variant="caption" tone="primary" style={{ textTransform: 'uppercase', letterSpacing: 1 }}>
            BBA Baudoku
          </Text>
          <Text variant="display" style={{ marginTop: theme.spacing[2] }}>
            Neues Passwort
          </Text>
          <Text variant="bodyLarge" tone="secondary" style={{ marginTop: theme.spacing[2] }}>
            Lege ein neues Passwort für deinen Zugang fest.
          </Text>
        </View>

        <Surface variant="card" padding="5" elevated bordered style={{ gap: theme.spacing[4] }}>
          <Input
            label="Neues Passwort"
            autoCapitalize="none"
            secureTextEntry
            onChangeText={setPassword}
            placeholder="Mindestens 8 Zeichen"
            leftAdornment={<KeyRound color={theme.colors.textMuted} size={20} />}
            errorText={tooShort ? 'Das Passwort braucht mindestens 8 Zeichen.' : undefined}
            value={password}
          />
          <Input
            label="Passwort wiederholen"
            autoCapitalize="none"
            secureTextEntry
            onChangeText={setPasswordRepeat}
            placeholder="Passwort erneut eingeben"
            leftAdornment={<KeyRound color={theme.colors.textMuted} size={20} />}
            errorText={mismatch ? 'Die Passwörter stimmen nicht überein.' : undefined}
            value={passwordRepeat}
          />
          {error ? <Banner tone="error" title="Speichern fehlgeschlagen" message={error} /> : null}
          <Button label="Passwort speichern" onPress={submit} loading={loading} disabled={!canSubmit} variant="primary" size="lg" fullWidth />
        </Surface>
      </VStack>
    </Screen>
  );
}

// Re-exports kept to satisfy any prior imports
export { LoginScreen as LoginScreenView, PasswordRecoveryScreen as PasswordRecoveryScreenView };
