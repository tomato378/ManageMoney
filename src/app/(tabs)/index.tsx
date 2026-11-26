import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useData, useMonthTransactions } from '@/data/DataProvider';
import {
  assetHistory,
  expenseOfCategory,
  investmentSummaries,
  isSplitRefund,
  smallSpending,
  spendingPace,
  staleAccounts,
  statementCoverage,
  summarizeTransactions,
  totalAssets,
  type PaceLevel,
} from '@/lib/calc';
import { addDays, addMonths, formatMonth, today } from '@/lib/date';
import { UNKNOWN_EXPENSE_ID } from '@/lib/defaults';
import { formatYen } from '@/lib/money';
import { AssetTrend } from '@/ui/AssetTrend';
import { CategoryBreakdown } from '@/ui/CategoryBreakdown';
import { Amount, Card, Empty, Fab, Screen, SectionTitle, TextLink, type IconName } from '@/ui/components';
import { TransactionRow } from '@/ui/rows';
import { colors, radius, spacing } from '@/ui/theme';

export default function HomeScreen() {
  const { accounts, categories, transactions, recurring, settings, thisMonth } = useData();
  const todayDate = today();
  const thisMonthTxs = useMonthTransactions(thisMonth);
  // カードの明細が1週間以上前までしかなければ、そろっている日までで判定する
  const coverage = useMemo(() => statementCoverage(accounts, transactions), [accounts, transactions]);
  const judgeDate = coverage && coverage < addDays(todayDate, -7) ? coverage : todayDate;
  const pace = useMemo(() => spendingPace(transactions, judgeDate), [transactions, judgeDate]);
  const investments = useMemo(
    () => investmentSummaries(accounts, transactions, thisMonth),
    [accounts, transactions, thisMonth],
  );
  const small = useMemo(() => smallSpending(transactions, todayDate), [transactions, todayDate]);
  const stale = staleAccounts(accounts, settings.confirmedAt, todayDate);
  const thisMonthSummary = summarizeTransactions(thisMonthTxs);
  const unknownThisMonth = expenseOfCategory(thisMonthTxs, UNKNOWN_EXPENSE_ID);
  const refunds = thisMonthTxs.filter(isSplitRefund).reduce((sum, t) => sum + t.amount, 0);
  const [month, setMonth] = useState(thisMonth);
  const monthTxs = useMonthTransactions(month);
  const summary = summarizeTransactions(monthTxs);
  const unknown = expenseOfCategory(monthTxs, UNKNOWN_EXPENSE_ID);
  const history = useMemo(() => assetHistory(accounts, transactions, thisMonth), [accounts, transactions, thisMonth]);
  const recent = [...transactions]
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)
    .slice(0, 5);

  const isNew = transactions.length === 0;

  return (
    <View style={styles.flex}>
      <Screen>
        <Verdict pace={pace} total={totalAssets(accounts)} asOf={judgeDate === todayDate ? null : judgeDate} />

        {investments.length > 0 ? (
          <Pressable
            onPress={() => router.push('/investments')}
            style={styles.invest}
            accessibilityRole="button"
            accessibilityLabel="預金・運用を見る"
          >
            <Text style={styles.investText}>
              💹 預金・運用 {formatYen(investments.reduce((s, x) => s + x.account.balance, 0))}
              {(() => {
                const g = investments.reduce((s, x) => s + x.gain, 0);
                return g === 0 ? '' : `（今月 ${g > 0 ? '+' : '-'}${formatYen(Math.abs(g))}）`;
              })()}
            </Text>
            <Ionicons name="chevron-forward" size={14} color={colors.subText} />
          </Pressable>
        ) : null}

        {!isNew ? (
          <Card>
            <SectionTitle title="今月の気づき" />
            <Insight
              icon="cafe"
              text={`1,000円以下の出費：${small.count}回・合計 ${formatYen(small.total)}`}
              sub={
                small.usualTotal !== null
                  ? diffFromUsual(small.total, small.usualTotal)
                  : '小さい出費も、積み重なるとけっこうな額になります'
              }
            />
            <Insight
              icon="help-circle"
              text={`使途不明金：${formatYen(unknownThisMonth)}`}
              sub={
                unknownThisMonth > 0 && thisMonthSummary.expense > 0
                  ? `支出の ${Math.round((unknownThisMonth / thisMonthSummary.expense) * 100)}%。レシートも明細もないお金です`
                  : '残高チェックで、記録とのずれがここに出ます'
              }
            />
            {refunds > 0 ? (
              <Insight
                icon="people"
                text={`割り勘で戻ってきたお金：${formatYen(refunds)}`}
                sub="支出から差し引いています。立て替えた分のカード明細がまだなら、一時的に支出が少なく見えます"
              />
            ) : null}
          </Card>
        ) : null}

        <Card>
          <SectionTitle title="やること" />
          {stale.length > 0 ? (
            stale.slice(0, 4).map((s) => (
              <Todo
                key={s.account.id}
                icon="wallet"
                text={`「${s.account.name}」の残高を${s.days === null ? 'まだ確かめていません' : `${s.days}日間確かめていません`}`}
                onPress={() => router.push('/balance-check')}
              />
            ))
          ) : (
            <Text style={styles.allGood}>✅ 口座の残高はすべて1か月以内に確かめています</Text>
          )}
          <View style={styles.actions}>
            <ActionButton icon="camera" title="レシートを撮る" color={colors.primary} onPress={() => router.push('/scan')} />
            <ActionButton icon="document-text" title="明細を取り込む" color={colors.transfer} onPress={() => router.push('/import')} />
            <ActionButton icon="wallet" title="残高チェック" color={colors.income} onPress={() => router.push('/balance-check')} />
          </View>
        </Card>

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

        <SectionTitle title="くわしく" />
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
  color,
  onPress,
}: {
  icon: IconName;
  title: string;
  color: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.action, { backgroundColor: color, opacity: pressed ? 0.8 : 1 }]}
      accessibilityRole="button"
    >
      <Ionicons name={icon} size={24} color="#FFFFFF" />
      <Text style={styles.actionTitle}>{title}</Text>
    </Pressable>
  );
}

const PACE_TEXT: Record<PaceLevel, { emoji: string; title: string; color: string }> = {
  good: { emoji: '🟢', title: 'いつもより控えめ', color: colors.income },
  normal: { emoji: '🟢', title: 'いつもどおり', color: colors.income },
  caution: { emoji: '🟡', title: '少し使いすぎ', color: colors.warning },
  over: { emoji: '🔴', title: '使いすぎ注意', color: colors.danger },
};

function diffFromUsual(current: number, usual: number): string {
  const diff = current - usual;
  if (diff === 0) return 'いつもの同じ時期と同じくらい';
  return `いつもの同じ時期より ${formatYen(Math.abs(diff))} ${diff > 0 ? '多い' : '少ない'}`;
}

/** 今月の使い方の結論（いつもの月と比べて） */
function Verdict({
  pace,
  total,
  asOf,
}: {
  pace: ReturnType<typeof spendingPace>;
  total: number;
  /** カードの明細がそろっている日までで判定したとき、その日 */
  asOf: string | null;
}) {
  const look = pace.level ? PACE_TEXT[pace.level] : null;
  const [, m, d] = (asOf ?? '').split('-').map(Number);
  return (
    <Card style={[styles.verdict, { borderColor: look?.color ?? colors.border }]}>
      <Text style={styles.verdictLabel}>{asOf ? `${m}月${d}日までのお金` : '今月のお金'}</Text>
      <Text style={[styles.verdictTitle, { color: look?.color ?? colors.text }]}>
        {look ? `${look.emoji} ${look.title}` : 'まだ比べられません'}
      </Text>
      <Text style={styles.verdictText}>
        {pace.usual !== null
          ? `${asOf ? 'この月' : '今月'}の支出 ${formatYen(pace.current)} は、${diffFromUsual(pace.current, pace.usual)}`
          : `今月の支出は ${formatYen(pace.current)}。記録が1か月分たまると、いつもの月と比べられます`}
      </Text>
      {asOf ? (
        <Text style={styles.verdictSub}>
          カードの明細がそろっている日までで比べています。新しい明細を取り込むと先まで見られます
        </Text>
      ) : null}
      <Text style={styles.verdictSub}>総資産 {formatYen(total)}</Text>
    </Card>
  );
}

function Insight({ icon, text, sub }: { icon: IconName; text: string; sub: string }) {
  return (
    <View style={styles.insight}>
      <Ionicons name={icon} size={20} color={colors.subText} />
      <View style={styles.flex}>
        <Text style={styles.insightText}>{text}</Text>
        <Text style={styles.insightSub}>{sub}</Text>
      </View>
    </View>
  );
}

function Todo({ icon, text, onPress }: { icon: IconName; text: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.hint} accessibilityRole="button">
      <Ionicons name={icon} size={20} color={colors.warning} />
      <Text style={styles.hintText}>{text}</Text>
      <Ionicons name="chevron-forward" size={16} color={colors.subText} />
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
  verdict: { borderWidth: 2, gap: spacing.xs },
  verdictLabel: { fontSize: 13, color: colors.subText },
  verdictTitle: { fontSize: 26, fontWeight: '800' },
  verdictText: { fontSize: 15, color: colors.text, lineHeight: 22 },
  verdictSub: { fontSize: 13, color: colors.subText },
  invest: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingHorizontal: spacing.xs },
  investText: { fontSize: 13, color: colors.subText },
  insight: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start', paddingVertical: spacing.xs },
  insightText: { fontSize: 15, fontWeight: '600', color: colors.text },
  insightSub: { fontSize: 12, color: colors.subText, lineHeight: 18 },
  allGood: { fontSize: 14, color: colors.income },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  action: { flex: 1, borderRadius: radius.md, padding: spacing.md, gap: spacing.xs, alignItems: 'center' },
  actionTitle: { color: '#FFFFFF', fontSize: 13, fontWeight: '700', textAlign: 'center' },
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
