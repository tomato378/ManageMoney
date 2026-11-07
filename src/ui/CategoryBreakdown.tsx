import { StyleSheet, Text, View } from 'react-native';
import { PieChart } from 'react-native-gifted-charts';

import { expenseByCategory } from '@/lib/calc';
import { formatYen } from '@/lib/money';
import type { Category, Transaction } from '@/types';
import { colors, spacing } from './theme';

/** 支出のカテゴリ別内訳（ドーナツグラフと上位6つの凡例）。支出がなければ何も出さない */
export function CategoryBreakdown({ txs, categories }: { txs: Transaction[]; categories: Category[] }) {
  const byCategory = expenseByCategory(txs);
  const total = byCategory.reduce((sum, t) => sum + t.amount, 0);
  if (total === 0) return null;
  const pieData = byCategory.map((t) => {
    const category = categories.find((c) => c.id === t.categoryId);
    return {
      key: t.categoryId ?? 'none',
      value: t.amount,
      color: category?.color ?? colors.subText,
      name: category?.name ?? '未分類',
    };
  });

  return (
    <View style={styles.chartRow}>
      <PieChart
        data={pieData}
        donut
        radius={70}
        innerRadius={45}
        centerLabelComponent={() => <Text style={styles.chartCenter}>{formatYen(total)}</Text>}
      />
      <View style={styles.legend}>
        {pieData.slice(0, 6).map((d) => (
          <View key={d.key} style={styles.legendRow}>
            <View style={[styles.legendDot, { backgroundColor: d.color }]} />
            <Text style={styles.legendName} numberOfLines={1}>
              {d.name}
            </Text>
            <Text style={styles.legendValue}>{formatYen(d.value)}</Text>
            <Text style={styles.legendPct}>{Math.round((d.value / total) * 100)}%</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chartRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, flexWrap: 'wrap' },
  chartCenter: { fontSize: 12, fontWeight: '700', color: colors.text },
  legend: { flex: 1, minWidth: 180, gap: 6 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendName: { flex: 1, fontSize: 13, color: colors.text },
  legendValue: { fontSize: 13, color: colors.text, fontVariant: ['tabular-nums'] },
  legendPct: { width: 36, textAlign: 'right', fontSize: 12, color: colors.subText },
});
