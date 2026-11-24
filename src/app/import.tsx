import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useData } from '@/data/DataProvider';
import type { ImportResult } from '@/data/importStatement';
import { importStatement, type AccountChoice } from '@/data/repo';
import { formatDate } from '@/lib/date';
import { formatYen } from '@/lib/money';
import {
  decodeCsv,
  guessAccount,
  NEW_ACCOUNT_FOR,
  neededAccounts,
  parseStatement,
  STATEMENT_LABELS,
  totalMatches,
  type Counterpart,
  type Statement,
} from '@/lib/statements';
import { Button, Card, Chip, ChipRow, Screen, SectionTitle } from '@/ui/components';
import { colors, spacing } from '@/ui/theme';

interface LoadedFile {
  id: string;
  fileName: string;
  statement: Statement | null;
  result?: ImportResult;
}

const COUNTERPART_LABELS: Record<Counterpart, string> = { ...STATEMENT_LABELS, cash: '財布（ATMの出し入れ）' };

/**
 * カード会社・銀行・PayPay の明細CSVを取り込む画面。
 * ファイルはこの端末の中で読むだけで、どこにも送らない。
 */
export default function ImportScreen() {
  const fileInput = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<LoadedFile[]>([]);

  async function load(list: File[]) {
    const loaded = await Promise.all(
      list.map(async (file) => ({
        id: crypto.randomUUID(),
        fileName: file.name,
        statement: parseStatement(decodeCsv(await file.arrayBuffer())),
      })),
    );
    setFiles((current) => [...loaded, ...current]);
  }

  return (
    <Screen>
      <Card>
        <Text style={styles.caption}>
          カード会社・銀行・PayPay のアプリやサイトからダウンロードした明細のCSVファイルを選んでください。何枚でもまとめて選べます。同じファイルを2回取り込んでも、二重には記録されません。
        </Text>
        <Text style={styles.note}>
          対応している明細：{Object.values(STATEMENT_LABELS).filter((l) => !/PayPayカード|SBI/.test(l)).join('・')}
          （PayPayカードでの支払いは PayPay の明細に入っています）
        </Text>
        <Text style={styles.note}>ファイルはこの端末の中で読むだけで、外部には送信されません。</Text>
        <Button title="CSVファイルを選ぶ" onPress={() => fileInput.current?.click()} />
        <input
          ref={fileInput}
          type="file"
          accept=".csv,text/csv"
          multiple
          aria-label="明細のCSVファイル"
          style={{ display: 'none' }}
          onChange={(event) => {
            const list = [...(event.target.files ?? [])];
            event.target.value = '';
            load(list);
          }}
        />
      </Card>

      {files.map((f) =>
        f.statement ? (
          <StatementCard
            key={f.id}
            file={f}
            statement={f.statement}
            onImported={(result) => setFiles((list) => list.map((x) => (x.id === f.id ? { ...x, result } : x)))}
          />
        ) : (
          <Card key={f.id}>
            <Text style={styles.fileName}>{f.fileName}</Text>
            <Text style={styles.warning}>この形式の明細はまだ読めません。</Text>
          </Card>
        ),
      )}
    </Screen>
  );
}

function StatementCard({
  file,
  statement,
  onImported,
}: {
  file: LoadedFile;
  statement: Statement;
  onImported: (result: ImportResult) => void;
}) {
  const { accounts, settings } = useData();
  const needed = neededAccounts(statement);
  const [choices, setChoices] = useState<Partial<Record<Counterpart, AccountChoice>>>(() =>
    Object.fromEntries(
      needed.map((target) => {
        const id = guessAccount(target, accounts, settings);
        return [target, id ? { accountId: id } : { create: NEW_ACCOUNT_FOR[target] }];
      }),
    ),
  );

  const dates = statement.rows.map((r) => r.date).sort();
  const counts = {
    expense: statement.rows.filter((r) => r.kind === 'expense').length,
    income: statement.rows.filter((r) => r.kind === 'income').length,
    transfer: statement.rows.filter((r) => r.kind === 'transfer-out' || r.kind === 'transfer-in').length,
  };
  const matches = totalMatches(statement);
  const done = file.result;

  return (
    <Card>
      <SectionTitle title={STATEMENT_LABELS[statement.source]} />
      <Text style={styles.fileName}>{file.fileName}</Text>
      {dates.length > 0 ? (
        <Text style={styles.text}>
          {formatDate(dates[0])} 〜 {formatDate(dates[dates.length - 1])}：支出 {counts.expense}件・入金 {counts.income}件
          {counts.transfer > 0 ? `・口座間の移動 ${counts.transfer}件` : ''}
        </Text>
      ) : (
        <Text style={styles.warning}>明細の行が見つかりませんでした。</Text>
      )}
      {matches === true ? (
        <Text style={styles.ok}>✅ 合計 {formatYen(statement.total!)} が請求額と一致（読み漏れなし）</Text>
      ) : matches === false ? (
        <Text style={styles.warning}>⚠ 行の合計が請求額 {formatYen(statement.total!)} と合いません</Text>
      ) : null}
      {statement.balance !== undefined && statement.lastDate ? (
        <Text style={styles.text}>
          {formatDate(statement.lastDate)} 時点の残高 {formatYen(statement.balance)} に口座を合わせます
        </Text>
      ) : null}

      {!done ? (
        <>
          {needed.map((target) => {
            const choice = choices[target];
            return (
              <View key={target} style={styles.accountRow}>
                <Text style={styles.accountLabel}>{COUNTERPART_LABELS[target]}の口座</Text>
                <ChipRow>
                  {accounts.map((a) => (
                    <Chip
                      key={a.id}
                      label={a.name}
                      selected={!!choice && 'accountId' in choice && choice.accountId === a.id}
                      onPress={() => setChoices({ ...choices, [target]: { accountId: a.id } })}
                    />
                  ))}
                  <Chip
                    label={`＋ 新しく作る（${NEW_ACCOUNT_FOR[target].name}）`}
                    selected={!!choice && 'create' in choice}
                    onPress={() => setChoices({ ...choices, [target]: { create: NEW_ACCOUNT_FOR[target] } })}
                  />
                </ChipRow>
              </View>
            );
          })}
          <Button title="取り込む" onPress={() => onImported(importStatement(statement, choices))} />
        </>
      ) : (
        <Text style={styles.ok}>
          取り込みました：新しく {done.added}件・レシートなどと照合 {done.matched}件
          {done.skipped > 0 ? `・取り込み済み ${done.skipped}件` : ''}
          {done.unresolved > 0 ? `・口座が決まらず ${done.unresolved}件` : ''}
        </Text>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  caption: { fontSize: 14, color: colors.text, lineHeight: 20 },
  note: { fontSize: 12, color: colors.subText, lineHeight: 18 },
  fileName: { fontSize: 12, color: colors.subText },
  text: { fontSize: 14, color: colors.text, lineHeight: 20 },
  ok: { fontSize: 14, color: colors.income, fontWeight: '600', lineHeight: 20 },
  warning: { fontSize: 14, color: colors.warning, fontWeight: '600' },
  accountRow: { gap: 6, paddingTop: spacing.xs },
  accountLabel: { fontSize: 13, fontWeight: '600', color: colors.text },
});
