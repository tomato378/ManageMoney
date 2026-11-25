import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useData } from '@/data/DataProvider';
import { updateSettings } from '@/data/repo';
import { daysBetween, formatDate, today } from '@/lib/date';
import { isValidLink, STATEMENT_GUIDES, type StatementGuide } from '@/lib/statementGuides';
import { STATEMENT_LABELS } from '@/lib/statements';
import { Button, Card, Input, SectionTitle } from './components';
import { notify } from './dialog';
import { colors, spacing } from './theme';

/** 明細CSVをダウンロードしに行くページの一覧。各社のページを新しいタブで開く */
export function StatementLinks() {
  return (
    <Card>
      <SectionTitle title="明細をダウンロードする" />
      <Text style={styles.note}>
        各社のページを開いてCSVをダウンロードし、下の「CSVファイルを選ぶ」から取り込みます。画面や手順は各社の都合で変わることがあります。
      </Text>
      {STATEMENT_GUIDES.map((g) => (
        <GuideRow key={g.source} guide={g} />
      ))}
    </Card>
  );
}

function GuideRow({ guide }: { guide: StatementGuide }) {
  const { settings } = useData();
  const custom = settings.statementLinks[guide.source];
  const url = custom ?? guide.url;
  const last = settings.lastImportedAt[guide.source];
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(url);

  function open() {
    window.open(url, '_blank', 'noopener');
  }

  function save() {
    if (!isValidLink(text)) {
      notify('https:// で始まるページのアドレスを入れてください');
      return;
    }
    const value = text.trim();
    const { [guide.source]: _old, ...rest } = settings.statementLinks;
    updateSettings({ statementLinks: value === guide.url ? rest : { ...rest, [guide.source]: value } });
    setEditing(false);
  }

  function reset() {
    const { [guide.source]: _old, ...rest } = settings.statementLinks;
    updateSettings({ statementLinks: rest });
    setText(guide.url);
    setEditing(false);
  }

  const lastText = last
    ? `前回の取り込み：${formatDate(last)}（${daysBetween(last, today()) === 0 ? '今日' : `${daysBetween(last, today())}日前`}）`
    : 'まだ取り込んでいません';

  return (
    <View style={styles.row}>
      <View style={styles.head}>
        <View style={styles.flex}>
          <Text style={styles.name}>{STATEMENT_LABELS[guide.source]}</Text>
          <Text style={[styles.last, !last && { color: colors.warning }]}>{lastText}</Text>
        </View>
        <Pressable onPress={open} style={styles.open} accessibilityRole="link" accessibilityLabel={`${STATEMENT_LABELS[guide.source]}を開く`}>
          <Text style={styles.openText}>開く ↗</Text>
        </Pressable>
      </View>
      <Text style={styles.steps}>{guide.steps}</Text>
      {editing ? (
        <View style={styles.edit}>
          <Input value={text} onChangeText={setText} autoCapitalize="none" autoCorrect={false} placeholder="https://" />
          <View style={styles.editButtons}>
            <View style={styles.flex}>
              <Button title="保存" onPress={save} />
            </View>
            <View style={styles.flex}>
              <Button title="最初のリンクに戻す" variant="secondary" onPress={reset} />
            </View>
          </View>
        </View>
      ) : (
        <Pressable onPress={() => setEditing(true)} accessibilityRole="button">
          <Text style={styles.change}>{custom ? 'リンクを変更（自分で設定したリンク）' : 'リンクを変更'}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  note: { fontSize: 12, color: colors.subText, lineHeight: 18 },
  row: {
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  name: { fontSize: 15, fontWeight: '700', color: colors.text },
  last: { fontSize: 12, color: colors.subText },
  open: { backgroundColor: colors.primary, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  openText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  steps: { fontSize: 13, color: colors.text, lineHeight: 19 },
  change: { fontSize: 12, color: colors.primary },
  edit: { gap: spacing.sm },
  editButtons: { flexDirection: 'row', gap: spacing.sm },
});
