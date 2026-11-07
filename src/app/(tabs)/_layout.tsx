import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router/js-tabs';

import type { IconName } from '@/ui/components';
import { colors } from '@/ui/theme';

/** hidden はタブバーに出さない（設定画面から開く） */
const TABS: { name: string; title: string; icon: IconName; hidden?: boolean }[] = [
  { name: 'index', title: 'ホーム', icon: 'home' },
  { name: 'transactions', title: '収支', icon: 'receipt' },
  { name: 'accounts', title: '資産', icon: 'wallet' },
  { name: 'plan', title: '予算・目標', icon: 'flag', hidden: true },
  { name: 'settings', title: '設定', icon: 'settings' },
];

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        headerStyle: { backgroundColor: colors.card },
        headerTintColor: colors.text,
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            href: tab.hidden ? null : undefined,
            tabBarIcon: ({ color, size }) => <Ionicons name={tab.icon} color={color} size={size} />,
          }}
        />
      ))}
    </Tabs>
  );
}
