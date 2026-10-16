import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router/js-tabs';

import { useData } from '@/data/DataProvider';
import { Loading, type IconName } from '@/ui/components';
import { colors } from '@/ui/theme';

const TABS: { name: string; title: string; icon: IconName }[] = [
  { name: 'index', title: 'ホーム', icon: 'home' },
  { name: 'transactions', title: '収支', icon: 'receipt' },
  { name: 'accounts', title: '資産', icon: 'wallet' },
  { name: 'plan', title: '予算・目標', icon: 'flag' },
  { name: 'settings', title: '設定', icon: 'settings' },
];

export default function TabsLayout() {
  const { loading } = useData();
  if (loading) return <Loading />;

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
            tabBarIcon: ({ color, size }) => <Ionicons name={tab.icon} color={color} size={size} />,
          }}
        />
      ))}
    </Tabs>
  );
}
