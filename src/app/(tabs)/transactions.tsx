import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useData, useMonthTransactions } from '@/data/DataProvider';
import { summarizeTransactions } from '@/lib/calc';
import { addMonths, formatDate, formatMonth } from '@/lib/date';
import type { Account, Category, Transaction } from '@/types';
import { Amount, Card, CONTENT_MAX_WIDTH, Empty, Fab, Loading, Screen, SectionTitle } from '@/ui/components';
import { CategoryBreakdown } from '@/ui/CategoryBreakdown';
import { TransactionRow } from '@/ui/rows';
import { colors, spacing } from '@/ui/theme';

export default function TransactionsScreen() {
  const { thisMonth, accounts, categories } = useData();
  const [month, setMonth] = useState(thisMonth);
  const txs = useMonthTransactions(month);

  return (
    <View style={styles.flex}>
      <View style={styles.monthBarOuter}>
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

      {summary.expense > 0 ? (
        <Card>
          <SectionTitle title="支出の内訳" />
          <CategoryBreakdown txs={txs} categories={categories} />
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
  monthBarOuter: {
    backgroundColor: colors.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  monthBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
  },
  monthText: { fontSize: 17, fontWeight: '700', color: colors.text },
  summaryRow: { flexDirection: 'row' },
  summaryItem: { flex: 1, gap: 2 },
  label: { fontSize: 12, color: colors.subText },
  dateHeader: { fontSize: 13, fontWeight: '600', color: colors.subText },
});
