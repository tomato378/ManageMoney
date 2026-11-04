import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { DataProvider } from '@/data/DataProvider';
import { colors } from '@/ui/theme';

export default function RootLayout() {
  return (
    <DataProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.card },
          headerTintColor: colors.text,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="transaction/[id]" options={{ title: '取引' }} />
        <Stack.Screen name="quick-add" options={{ title: 'クイック入力' }} />
        <Stack.Screen name="account/[id]" options={{ title: '口座' }} />
        <Stack.Screen name="category/[id]" options={{ title: 'カテゴリ' }} />
        <Stack.Screen name="budget/[id]" options={{ title: '予算' }} />
        <Stack.Screen name="goal/[id]" options={{ title: '目標' }} />
      </Stack>
    </DataProvider>
  );
}
