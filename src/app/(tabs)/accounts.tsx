import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { useData } from '@/data/DataProvider';
import { totalAssets, totalsByAccountType } from '@/lib/calc';
import { ACCOUNT_TYPES } from '@/lib/defaults';
import { Amount, Card, Empty, Fab, IconBadge, Row, Screen, SectionTitle } from '@/ui/components';
import { colors, spacing } from '@/ui/theme';

export default function AccountsScreen() {
  const { accounts } = useData();
  const totals = totalsByAccountType(accounts);

  return (
    <View style={styles.flex}>
      <Screen>
        <Card>
          <Text style={styles.label}>総資産</Text>
          <Amount value={totalAssets(accounts)} size={28} />
        </Card>

        {accounts.length === 0 ? <Empty message="右下の＋から口座を追加しましょう" /> : null}

        {ACCOUNT_TYPES.filter((t) => accounts.some((a) => a.type === t.type)).map((t) => (
          <Card key={t.type}>
            <SectionTitle title={t.label} action={<Amount value={totals[t.type] ?? 0} size={15} />} />
            {accounts
              .filter((a) => a.type === t.type)
              .map((a) => (
                <Row
                  key={a.id}
                  onPress={() => router.push({ pathname: '/account/[id]', params: { id: a.id } })}
                  left={<IconBadge icon={t.icon} color={colors.primary} />}
                  title={a.name}
                  right={<Amount value={a.balance} color={a.balance < 0 ? colors.expense : colors.text} />}
                />
              ))}
          </Card>
        ))}

        <Text style={styles.hint}>
          証券や暗号資産など値動きがあるものは、口座をタップして現在の評価額に書き換えてください。
        </Text>
      </Screen>
      <Fab onPress={() => router.push({ pathname: '/account/[id]', params: { id: 'new' } })} label="口座を追加" />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  label: { fontSize: 13, color: colors.subText },
  hint: { fontSize: 12, color: colors.subText, paddingHorizontal: spacing.xs },
});
