import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useData, useMonthTransactions } from '@/data/DataProvider';
import { assetHistory, expenseOfCategory, summarizeTransactions, totalAssets } from '@/lib/calc';
import { addMonths, daysBetween, formatMonth, today } from '@/lib/date';
import { UNKNOWN_EXPENSE_ID } from '@/lib/defaults';
import { formatYen } from '@/lib/money';
import { AssetTrend } from '@/ui/AssetTrend';
import { CategoryBreakdown } from '@/ui/CategoryBreakdown';
import { Amount, Card, Empty, Fab, Screen, SectionTitle, TextLink, type IconName } from '@/ui/components';
import { TransactionRow } from '@/ui/rows';
import { colors, radius, spacing } from '@/ui/theme';

export default function HomeScreen() {
  const { accounts, categories, transactions, recurring, balanceChecks, thisMonth } = useData();
  const [month, setMonth] = useState(thisMonth);
  const monthTxs = useMonthTransactions(month);
  const summary = summarizeTransactions(monthTxs);
  const unknown = expenseOfCategory(monthTxs, UNKNOWN_EXPENSE_ID);
  const history = useMemo(() => assetHistory(accounts, transactions, thisMonth), [accounts, transactions, thisMonth]);
  const recent = [...transactions]
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)
    .slice(0, 5);

  const lastCheck = balanceChecks[balanceChecks.length - 1];
  const checkCaption = lastCheck
    ? `前回：${daysBetween(lastCheck.date, today()) === 0 ? '今日' : `${daysBetween(lastCheck.date, today())}日前`}`
    : 'ずれを使途不明金として記録';
  const isNew = transactions.length === 0;

  return (
    <View style={styles.flex}>
      <Screen>
        <Card style={styles.hero}>
          <Text style={styles.heroLabel}>総資産</Text>
          <Amount value={totalAssets(accounts)} size={32} color="#FFFFFF" />
          <Text style={styles.heroCaption}>{accounts.length}口座</Text>
        </Card>

        <View style={styles.actions}>
          <ActionButton
            icon="camera"
            title="レシートをまとめて撮る"
            caption="撮ったら捨ててOK"
            color={colors.primary}
            onPress={() => router.push('/scan')}
          />
          <ActionButton
            icon="wallet"
            title="残高チェック"
            caption={checkCaption}
            color={colors.income}
            onPress={() => router.push('/balance-check')}
          />
        </View>

        {isNew ? (
          <Card>
            <SectionTitle title="はじめに" />
            <Hint
              done={accounts.length > 1 || accounts.some((a) => a.balance !== 0)}
              text="財布・銀行・電子マネー・クレカを登録して、今の残高を入れる"
              onPress={() => router.navigate('/accounts')}
            />
            <Hint
              done={recurring.length > 0}
              text="給料・家賃・サブスクなど毎月のお金を登録する"
              onPress={() => router.push({ pathname: '/recurring/[id]', params: { id: 'new' } })}
            />
            <Hint done={false} text="たまったレシートをまとめて撮る" onPress={() => router.push('/scan')} />
          </Card>
        ) : null}

        <Card>
          <View style={styles.monthBar}>
            <Pressable onPress={() => setMonth(addMonths(month, -1))} hitSlop={12} accessibilityLabel="前の月">
              <Ionicons name="chevron-back" size={22} color={colors.text} />
            </Pressable>
            <Pressable onPress={() => setMonth(thisMonth)}>
              <Text style={styles.monthText}>{formatMonth(month)}の収支</Text>
            </Pressable>
            <Pressable
              onPress={() => setMonth(addMonths(month, 1))}
              hitSlop={12}
              accessibilityLabel="次の月"
              disabled={month >= thisMonth}
              style={{ opacity: month >= thisMonth ? 0.3 : 1 }}
            >
              <Ionicons name="chevron-forward" size={22} color={colors.text} />
            </Pressable>
          </View>
          <View style={styles.summaryRow}>
            <SummaryItem label="収入" value={summary.income} color={colors.income} />
            <SummaryItem label="支出" value={summary.expense} color={colors.expense} />
            <SummaryItem label="差額" value={summary.net} color={summary.net < 0 ? colors.expense : colors.text} />
          </View>
          {unknown > 0 ? (
            <Text style={styles.unknown}>うち使途不明金 {formatYen(unknown)}（レシートのない支出）</Text>
          ) : null}
          <CategoryBreakdown txs={monthTxs} categories={categories} />
        </Card>

        <Card>
          <SectionTitle title="総資産の推移" />
          <AssetTrend points={history} />
        </Card>

        <Card>
          <SectionTitle
            title="最近の記録"
            action={<TextLink title="すべて" onPress={() => router.navigate('/transactions')} />}
          />
          {recent.length === 0 ? <Empty message="まだ記録はありません" /> : null}
          {recent.map((tx) => (
            <TransactionRow key={tx.id} tx={tx} categories={categories} accounts={accounts} showDate />
          ))}
        </Card>
      </Screen>
      <Fab onPress={() => router.push({ pathname: '/transaction/[id]', params: { id: 'new' } })} label="手で入力" />
    </View>
  );
}

function ActionButton({
  icon,
  title,
  caption,
  color,
  onPress,
}: {
  icon: IconName;
  title: string;
  caption: string;
  color: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.action, { backgroundColor: color, opacity: pressed ? 0.8 : 1 }]}
      accessibilityRole="button"
    >
      <Ionicons name={icon} size={28} color="#FFFFFF" />
      <Text style={styles.actionTitle}>{title}</Text>
      <Text style={styles.actionCaption} numberOfLines={1}>
        {caption}
      </Text>
    </Pressable>
  );
}

function Hint({ done, text, onPress }: { done: boolean; text: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.hint} accessibilityRole="button">
      <Ionicons
        name={done ? 'checkmark-circle' : 'ellipse-outline'}
        size={20}
        color={done ? colors.income : colors.subText}
      />
      <Text style={[styles.hintText, done && styles.hintDone]}>{text}</Text>
      <Ionicons name="chevron-forward" size={16} color={colors.subText} />
    </Pressable>
  );
}

function SummaryItem({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.summaryItem}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Amount value={value} color={color} size={17} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hero: { backgroundColor: colors.primary, gap: spacing.xs },
  heroLabel: { color: '#DBEAFE', fontSize: 14 },
  heroCaption: { color: '#DBEAFE', fontSize: 12 },
  actions: { flexDirection: 'row', gap: spacing.md },
  action: { flex: 1, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.xs, minHeight: 112 },
  actionTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  actionCaption: { color: '#FFFFFFCC', fontSize: 12 },
  hint: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  hintText: { flex: 1, fontSize: 14, color: colors.text },
  hintDone: { color: colors.subText, textDecorationLine: 'line-through' },
  monthBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  monthText: { fontSize: 16, fontWeight: '700', color: colors.text },
  summaryRow: { flexDirection: 'row' },
  summaryItem: { flex: 1, gap: 2 },
  summaryLabel: { fontSize: 12, color: colors.subText },
  unknown: { fontSize: 13, color: colors.warning, fontWeight: '600' },
});
