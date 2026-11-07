import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useData } from '@/data/DataProvider';
import { reconcileBalances } from '@/data/repo';
import { formatDate, today } from '@/lib/date';
import { accountTypeLabel } from '@/lib/defaults';
import { formatYen, parseAmount } from '@/lib/money';
import type { Account } from '@/types';
import { Button, Card, Input, Screen, SectionTitle } from '@/ui/components';
import { confirmAsync } from '@/ui/dialog';
import { colors, spacing } from '@/ui/theme';

/** クレカは未払い額を正の数で入れてもらい、内部ではマイナスにする */
function toBalance(account: Account, value: number): number {
  return account.type === 'credit' ? -Math.abs(value) : value;
}

function diffText(diff: number, credit = false): string {
  if (diff === 0) return 'ぴったり';
  // クレカは残高がマイナス（未払い）なので、増える＝未払いが減る
  if (credit) return diff > 0 ? `未払いが記録より ${formatYen(diff)} 少ない` : `未払いが記録より ${formatYen(-diff)} 多い`;
  return diff < 0 ? `記録より ${formatYen(-diff)} 少ない` : `記録より ${formatYen(diff)} 多い`;
}

/**
 * 財布・口座・電子マネー・クレカの実際の残高を入れて、記録とのずれを出す。
 * 確定すると、ずれを「使途不明金」などとして記録し、残高を実際の額に合わせる。
 */
export default function BalanceCheckScreen() {
  const { accounts, balanceChecks } = useData();
  const [texts, setTexts] = useState<Record<string, string>>({});
  const last = balanceChecks[balanceChecks.length - 1];

  const actuals: Record<string, number> = {};
  for (const a of accounts) {
    const value = parseAmount(texts[a.id] ?? '', { allowNegative: a.type !== 'credit' });
    if (value !== null) actuals[a.id] = toBalance(a, value);
  }
  const entered = accounts.filter((a) => actuals[a.id] !== undefined);
  const totalDiff = entered.reduce((sum, a) => sum + (actuals[a.id] - a.balance), 0);

  async function confirm() {
    const message =
      totalDiff === 0
        ? '合計のずれはありません。口座ごとのずれは振替として記録します。'
        : `合計 ${formatYen(Math.abs(totalDiff))} を「${totalDiff < 0 ? '使途不明金' : '使途不明の収入'}」として記録し、残高を実際の額に合わせます。`;
    if (!(await confirmAsync('残高を合わせますか？', message))) return;
    reconcileBalances(actuals, today());
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }

  return (
    <Screen>
      <Card>
        <Text style={styles.caption}>
          今の実際の残高を入れてください。わからない口座は空欄のままで大丈夫です。クレジットカードは「まだ引き落とされていない利用額」を入れます。
        </Text>
        {last ? <Text style={styles.note}>前回のチェック：{formatDate(last.date)}</Text> : null}
      </Card>

      <Card>
        {accounts.map((a) => {
          const actual = actuals[a.id];
          const diff = actual === undefined ? null : actual - a.balance;
          return (
            <View key={a.id} style={styles.accountRow}>
              <View style={styles.accountHead}>
                <Text style={styles.accountName}>{a.name}</Text>
                <Text style={styles.accountType}>{accountTypeLabel(a.type)}</Text>
              </View>
              <Text style={styles.recorded}>
                記録上：{a.type === 'credit' ? `未払い ${formatYen(-a.balance)}` : formatYen(a.balance)}
              </Text>
              <Input
                value={texts[a.id] ?? ''}
                onChangeText={(text) => setTexts({ ...texts, [a.id]: text })}
                keyboardType="number-pad"
                placeholder={a.type === 'credit' ? '実際の未払い額' : '実際の残高'}
                accessibilityLabel={`${a.name}の実際の残高`}
              />
              {diff !== null ? (
                <Text style={[styles.diff, { color: diff === 0 ? colors.income : colors.warning }]}>
                  {diffText(diff, a.type === 'credit')}
                </Text>
              ) : null}
            </View>
          );
        })}
      </Card>

      {entered.length > 0 ? (
        <Card>
          <SectionTitle title="合計のずれ" />
          <Text style={[styles.total, { color: totalDiff < 0 ? colors.expense : totalDiff > 0 ? colors.income : colors.text }]}>
            {diffText(totalDiff)}
          </Text>
          <Text style={styles.note}>
            {totalDiff < 0
              ? 'レシートや記録のない支出があったようです。'
              : totalDiff > 0
                ? '記録していない収入があったようです。'
                : '記録どおりです。'}
            口座の間のずれ（カードの引き落とし・チャージなど）は振替として扱い、収支には入れません。
          </Text>
          <Button title="この残高に合わせる" onPress={confirm} />
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  caption: { fontSize: 14, color: colors.text, lineHeight: 20 },
  note: { fontSize: 12, color: colors.subText, lineHeight: 18 },
  accountRow: {
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  accountHead: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  accountName: { fontSize: 16, fontWeight: '700', color: colors.text },
  accountType: { fontSize: 12, color: colors.subText },
  recorded: { fontSize: 13, color: colors.subText },
  diff: { fontSize: 14, fontWeight: '600' },
  total: { fontSize: 20, fontWeight: '700' },
});
