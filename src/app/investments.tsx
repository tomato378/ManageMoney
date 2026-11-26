import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { useData } from '@/data/DataProvider';
import { investmentSummaries } from '@/lib/calc';
import { formatDate, formatMonth } from '@/lib/date';
import { accountTypeLabel, INVEST_GAIN_ID, INVEST_LOSS_ID } from '@/lib/defaults';
import { formatYen } from '@/lib/money';
import { Amount, Button, Card, Empty, Screen, SectionTitle } from '@/ui/components';
import { colors, spacing } from '@/ui/theme';

function signed(value: number): string {
  return `${value > 0 ? '+' : value < 0 ? '-' : '±'}${formatYen(Math.abs(value))}`;
}

/**
 * 定期預金・証券などの「預金・運用」の口座。
 * 残高と、利息・値動きで増えた・減った分を、ふだんの収支とは別に見る。
 */
export default function InvestmentsScreen() {
  const { accounts, transactions, thisMonth } = useData();
  const summaries = investmentSummaries(accounts, transactions, thisMonth);
  const total = summaries.reduce((s, x) => s + x.account.balance, 0);
  const monthGain = summaries.reduce((s, x) => s + x.gain, 0);
  const totalGain = summaries.reduce((s, x) => s + x.totalGain, 0);
  const ids = new Set(summaries.map((s) => s.account.id));
  const history = transactions
    .filter((t) => t.accountId && ids.has(t.accountId) && (t.categoryId === INVEST_GAIN_ID || t.categoryId === INVEST_LOSS_ID))
    .sort((a, b) => b.date.localeCompare(a.date));

  return (
    <Screen>
      <Card>
        <Text style={styles.label}>預金・運用の残高</Text>
        <Amount value={total} size={32} />
        <View style={styles.gainRow}>
          <View style={styles.flex}>
            <Text style={styles.label}>{formatMonth(thisMonth)}の増減</Text>
            <Text style={[styles.gain, { color: monthGain < 0 ? colors.expense : colors.income }]}>{signed(monthGain)}</Text>
          </View>
          <View style={styles.flex}>
            <Text style={styles.label}>記録を始めてからの増減</Text>
            <Text style={[styles.gain, { color: totalGain < 0 ? colors.expense : colors.income }]}>{signed(totalGain)}</Text>
          </View>
        </View>
        <Text style={styles.note}>
          定期預金・証券などは、ふだんの収入・支出には入れません。普通預金との出し入れは口座間の移動、利息や値動きで増えた・減った分は「運用の増減」として、ここにだけ出ます。増減は残高チェックで残高を入れたときに記録されます。
        </Text>
      </Card>

      <SectionTitle title="口座ごと" />
      {summaries.length === 0 ? (
        <Card>
          <Empty message="預金・運用の口座はまだありません" />
          <Text style={styles.note}>口座の種類を「定期預金」「証券」「暗号資産」にすると、ここに出ます。</Text>
          <Button title="口座を見る" variant="secondary" onPress={() => router.navigate('/accounts')} />
        </Card>
      ) : (
        summaries.map((s) => (
          <Card key={s.account.id}>
            <View style={styles.accountHead}>
              <Text style={styles.accountName}>{s.account.name}</Text>
              <Text style={styles.label}>{accountTypeLabel(s.account.type)}</Text>
            </View>
            <Amount value={s.account.balance} size={22} />
            <Text style={styles.text}>
              今月 {signed(s.gain)}・これまで {signed(s.totalGain)}
            </Text>
          </Card>
        ))
      )}

      {history.length > 0 ? (
        <Card>
          <SectionTitle title="増減の記録" />
          {history.map((t) => (
            <View key={t.id} style={styles.historyRow}>
              <Text style={styles.text}>{formatDate(t.date)}</Text>
              <Text style={styles.flexText} numberOfLines={1}>
                {accounts.find((a) => a.id === t.accountId)?.name}
              </Text>
              <Text style={{ color: t.kind === 'income' ? colors.income : colors.expense, fontWeight: '700' }}>
                {signed(t.kind === 'income' ? t.amount : -t.amount)}
              </Text>
            </View>
          ))}
        </Card>
      ) : null}

      <Button title="残高チェックで残高を入れる" onPress={() => router.push('/balance-check')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  label: { fontSize: 12, color: colors.subText },
  gainRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  gain: { fontSize: 20, fontWeight: '700', fontVariant: ['tabular-nums'] },
  note: { fontSize: 12, color: colors.subText, lineHeight: 18 },
  text: { fontSize: 14, color: colors.text },
  flexText: { flex: 1, fontSize: 14, color: colors.text },
  accountHead: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  accountName: { fontSize: 16, fontWeight: '700', color: colors.text },
  historyRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', paddingVertical: 4 },
});
