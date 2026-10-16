import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { AuthProvider, useAuth } from '@/data/AuthProvider';
import { DataProvider } from '@/data/DataProvider';
import { Loading } from '@/ui/components';
import { colors } from '@/ui/theme';

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

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <RootNavigator />
    </AuthProvider>
  );
}
