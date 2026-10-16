import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from '@react-native-firebase/auth';
import { useState } from 'react';
import { KeyboardAvoidingView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { auth, authErrorMessage } from '@/lib/firebase';
import { Button, Field, Input, TextLink } from '@/ui/components';
import { colors, spacing } from '@/ui/theme';

export default function LoginScreen() {
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setError(null);
    setSubmitting(true);
    try {
      if (mode === 'signIn') await signInWithEmailAndPassword(auth, email.trim(), password);
      else await createUserWithEmailAndPassword(auth, email.trim(), password);
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior="height" style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>ManageMoney</Text>
          <Text style={styles.subtitle}>資産と収支をまとめて管理</Text>
        </View>

        <Field label="メールアドレス">
          <Input
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            placeholder="you@example.com"
          />
        </Field>
        <Field label="パスワード">
          <Input
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete={mode === 'signIn' ? 'password' : 'new-password'}
            placeholder="6文字以上"
          />
        </Field>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Button
          title={mode === 'signIn' ? 'ログイン' : '新規登録'}
          onPress={submit}
          loading={submitting}
          disabled={!email || !password}
        />
        <View style={styles.switch}>
          <TextLink
            title={mode === 'signIn' ? 'はじめての方は新規登録' : 'アカウントをお持ちの方はログイン'}
            onPress={() => {
              setMode(mode === 'signIn' ? 'signUp' : 'signIn');
              setError(null);
            }}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, padding: spacing.xl, justifyContent: 'center', gap: spacing.lg },
  header: { alignItems: 'center', marginBottom: spacing.xl },
  title: { fontSize: 32, fontWeight: '800', color: colors.primary },
  subtitle: { fontSize: 14, color: colors.subText, marginTop: spacing.xs },
  error: { color: colors.danger, fontSize: 14 },
  switch: { alignItems: 'center' },
});
