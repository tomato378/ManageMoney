import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { useData } from '@/data/DataProvider';
import { updateSettings } from '@/data/repo';
import type { CategoryKind, PaymentMethod } from '@/types';
import { BackupCard } from '@/ui/BackupCard';
import { Amount, Card, Chip, ChipRow, IconBadge, Row, Screen, SectionTitle, TextLink } from '@/ui/components';
import { colors } from '@/ui/theme';

const PAYMENT_METHODS: { method: PaymentMethod; label: string }[] = [
  { method: 'cash', label: '現金' },
  { method: 'credit', label: 'クレジットカード' },
  { method: 'emoney', label: '電子マネー・QR決済' },
];

export default function SettingsScreen() {
  const { categories, accounts, settings, recurring } = useData();

  function setPaymentAccount(method: PaymentMethod, accountId: string | null) {
    updateSettings({ paymentAccountIds: { ...settings.paymentAccountIds, [method]: accountId } });
  }

  return (
    <Screen>
      <BackupCard />

      <Card>
        <SectionTitle
          title="毎月の収入・固定費"
          action={
            <TextLink
              title="＋ 追加"
              onPress={() => router.push({ pathname: '/recurring/[id]', params: { id: 'new' } })}
            />
          }
        />
        <Text style={styles.caption}>給料・家賃・サブスクなど。毎月その日に自動で記録します。</Text>
        {recurring.map((r) => (
          <Row
            key={r.id}
            left={
              <IconBadge
                icon={categories.find((c) => c.id === r.categoryId)?.icon ?? 'repeat'}
                color={r.kind === 'income' ? colors.income : colors.expense}
                size={30}
              />
            }
            title={r.name}
            subtitle={`毎月${r.dayOfMonth >= 31 ? '月末' : `${r.dayOfMonth}日`}・${accounts.find((a) => a.id === r.accountId)?.name ?? '口座なし'}`}
            right={<Amount value={r.kind === 'expense' ? -r.amount : r.amount} signed={r.kind === 'income'} />}
            onPress={() => router.push({ pathname: '/recurring/[id]', params: { id: r.id } })}
          />
        ))}
      </Card>

      <Card>
        <SectionTitle title="レシートの支払い方法と口座" />
        <Text style={styles.caption}>
          レシートに書かれた支払い方法から、どの口座で払ったかを決めます。「自動」はその種類の最初の口座です。
        </Text>
        {PAYMENT_METHODS.map((m) => (
          <View key={m.method} style={styles.paymentRow}>
            <Text style={styles.paymentLabel}>{m.label}</Text>
            <ChipRow>
              <Chip
                label="自動"
                selected={!settings.paymentAccountIds[m.method]}
                onPress={() => setPaymentAccount(m.method, null)}
              />
              {accounts.map((a) => (
                <Chip
                  key={a.id}
                  label={a.name}
                  selected={a.id === settings.paymentAccountIds[m.method]}
                  onPress={() => setPaymentAccount(m.method, a.id)}
                />
              ))}
            </ChipRow>
          </View>
        ))}
      </Card>

      <Card>
        <SectionTitle title="予算・目標" />
        <Text style={styles.caption}>月の予算や貯金の目標を立てたいときに使います。</Text>
        <Row
          left={<IconBadge icon="flag" color={colors.primary} size={30} />}
          title="予算・目標を開く"
          onPress={() => router.navigate('/plan')}
        />
      </Card>

      <Card>
        <SectionTitle title="手で入力するときの口座" />
        <ChipRow>
          <Chip
            label="指定しない"
            selected={settings.defaultAccountId === null}
            onPress={() => updateSettings({ defaultAccountId: null })}
          />
          {accounts.map((a) => (
            <Chip
              key={a.id}
              label={a.name}
              selected={a.id === settings.defaultAccountId}
              onPress={() => updateSettings({ defaultAccountId: a.id })}
            />
          ))}
        </ChipRow>
      </Card>

      {(['expense', 'income'] as CategoryKind[]).map((kind) => (
        <Card key={kind}>
          <SectionTitle
            title={kind === 'expense' ? '支出カテゴリ' : '収入カテゴリ'}
            action={
              <TextLink
                title="＋ 追加"
                onPress={() => router.push({ pathname: '/category/[id]', params: { id: 'new', kind } })}
              />
            }
          />
          {categories
            .filter((c) => c.kind === kind)
            .map((c) => (
              <Row
                key={c.id}
                left={<IconBadge icon={c.icon} color={c.color} size={30} />}
                title={c.name}
                onPress={() => router.push({ pathname: '/category/[id]', params: { id: c.id } })}
              />
            ))}
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  caption: { fontSize: 13, color: colors.subText, lineHeight: 19 },
  paymentRow: { gap: 6 },
  paymentLabel: { fontSize: 13, fontWeight: '600', color: colors.text },
});
