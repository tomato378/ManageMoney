import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PieChart } from 'react-native-gifted-charts';

import { useData, useMonthTransactions } from '@/data/DataProvider';
import { expenseByCategory, summarizeTransactions } from '@/lib/calc';
import { addMonths, formatDate, formatMonth } from '@/lib/date';
import { formatYen } from '@/lib/money';
import type { Account, Category, Transaction } from '@/types';
import { Amount, Card, Empty, Fab, Loading, Screen, SectionTitle } from '@/ui/components';
import { TransactionRow } from '@/ui/rows';
import { colors, spacing } from '@/ui/theme';

export default function TransactionsScreen() {
  const { uid, thisMonth, accounts, categories } = useData();
  const [month, setMonth] = useState(thisMonth);
  const txs = useMonthTransactions(uid, month);

  return (
    <View style={styles.flex}>
      <View style={styles.monthBar}>
        <Pressable onPress={() => setMonth(addMonths(month, -1))} hitSlop={12} accessibilityLabel="前の月">
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Pressable onPress={() => setMonth(thisMonth)}>
          <Text style={styles.monthText}>{formatMonth(month)}</Text>
        </Pressable>
        <Pressable onPress={() => setMonth(addMonths(month, 1))} hitSlop={12} accessibilityLabel="次の月">
          <Ionicons name="chevron-forward" size={24} color={colors.text} />
        </Pressable>
      </View>

      {txs === null ? <Loading /> : <MonthDetail txs={txs} categories={categories} accounts={accounts} />}

      <Fab onPress={() => router.push({ pathname: '/transaction/[id]', params: { id: 'new' } })} label="取引を追加" />
    </View>
  );
}

function MonthDetail({
  txs,
  categories,
  accounts,
}: {
  txs: Transaction[];
  categories: Category[];
  accounts: Account[];
}) {
  const summary = summarizeTransactions(txs);
  const byCategory = expenseByCategory(txs);
  const pieData = byCategory.map((t) => {
    const category = categories.find((c) => c.id === t.categoryId);
    return { value: t.amount, color: category?.color ?? colors.subText, name: category?.name ?? '未分類' };
  });
  const days = groupByDate(txs);

  return (
    <Screen>
      <Card>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.label}>収入</Text>
            <Amount value={summary.income} color={colors.income} />
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.label}>支出</Text>
            <Amount value={summary.expense} color={colors.expense} />
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.label}>差額</Text>
            <Amount value={summary.net} />
          </View>
        </View>
      </Card>

      {pieData.length > 0 ? (
        <Card>
          <SectionTitle title="支出の内訳" />
          <View style={styles.chartRow}>
            <PieChart
              data={pieData}
              donut
              radius={70}
              innerRadius={45}
              centerLabelComponent={() => <Text style={styles.chartCenter}>{formatYen(summary.expense)}</Text>}
            />
            <View style={styles.legend}>
              {pieData.slice(0, 6).map((d) => (
                <View key={d.name} style={styles.legendRow}>
                  <View style={[styles.legendDot, { backgroundColor: d.color }]} />
                  <Text style={styles.legendName} numberOfLines={1}>
                    {d.name}
                  </Text>
                  <Text style={styles.legendValue}>{Math.round((d.value / summary.expense) * 100)}%</Text>
                </View>
              ))}
            </View>
          </View>
        </Card>
      ) : null}

      {days.length === 0 ? <Empty message="この月の取引はありません" /> : null}
      {days.map(([date, items]) => (
        <Card key={date}>
          <Text style={styles.dateHeader}>{formatDate(date)}</Text>
          {items.map((tx) => (
            <TransactionRow key={tx.id} tx={tx} categories={categories} accounts={accounts} />
          ))}
        </Card>
      ))}
    </Screen>
  );
}

function groupByDate(txs: Transaction[]): [string, Transaction[]][] {
  const groups = new Map<string, Transaction[]>();
  for (const tx of txs) {
    const list = groups.get(tx.date) ?? [];
    list.push(tx);
    groups.set(tx.date, list);
  }
  return [...groups.entries()];
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  monthBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    backgroundColor: colors.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  monthText: { fontSize: 17, fontWeight: '700', color: colors.text },
  summaryRow: { flexDirection: 'row' },
  summaryItem: { flex: 1, gap: 2 },
  label: { fontSize: 12, color: colors.subText },
  chartRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  chartCenter: { fontSize: 12, fontWeight: '700', color: colors.text },
  legend: { flex: 1, gap: 6 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendName: { flex: 1, fontSize: 13, color: colors.text },
  legendValue: { fontSize: 13, color: colors.subText },
  dateHeader: { fontSize: 13, fontWeight: '600', color: colors.subText },
});
