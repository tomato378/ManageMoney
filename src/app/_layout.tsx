import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

import { AuthProvider, useAuth } from '@/data/AuthProvider';
import { DataProvider } from '@/data/DataProvider';
import { isFirebaseConfigured } from '@/lib/firebase';
import { Loading } from '@/ui/components';
import { colors, spacing } from '@/ui/theme';

function RootNavigator() {
  const { user, initializing } = useAuth();
  if (initializing) return <Loading />;

  const stack = (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.card },
        headerTintColor: colors.text,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Protected guard={!!user}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="transaction/[id]" options={{ title: '取引', presentation: 'modal' }} />
        <Stack.Screen name="quick-add" options={{ title: 'クイック入力', presentation: 'modal' }} />
        <Stack.Screen name="account/[id]" options={{ title: '口座', presentation: 'modal' }} />
        <Stack.Screen name="category/[id]" options={{ title: 'カテゴリ', presentation: 'modal' }} />
        <Stack.Screen name="budget/[id]" options={{ title: '予算', presentation: 'modal' }} />
        <Stack.Screen name="goal/[id]" options={{ title: '目標', presentation: 'modal' }} />
      </Stack.Protected>
      <Stack.Protected guard={!user}>
        <Stack.Screen name="login" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  );

  return user ? (
    <DataProvider key={user.uid} uid={user.uid}>
      {stack}
    </DataProvider>
  ) : (
    stack
  );
}

/** デプロイ先に Firebase の設定値（環境変数）が入っていないとき */
function SetupRequired() {
  return (
    <View style={styles.setup}>
      <Text style={styles.setupTitle}>Firebase の設定が必要です</Text>
      <Text style={styles.setupText}>
        環境変数 EXPO_PUBLIC_FIREBASE_API_KEY などを設定してからビルドしてください。手順は README.md にあります。
      </Text>
    </View>
  );
}

export default function RootLayout() {
  if (!isFirebaseConfigured) return <SetupRequired />;
  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <RootNavigator />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  setup: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  setupTitle: { fontSize: 20, fontWeight: '700', color: colors.text },
  setupText: { fontSize: 14, color: colors.subText, textAlign: 'center', maxWidth: 420, lineHeight: 21 },
});
