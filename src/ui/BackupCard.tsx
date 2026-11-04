import { useRef, useSyncExternalStore } from 'react';
import { StyleSheet, Text } from 'react-native';

import { getLastBackupAt, getSnapshot, replaceAll, setLastBackupAt, subscribe } from '@/data/store';
import { backupFileName, parseBackup, serializeBackup } from '@/lib/backup';
import { formatDate, toDateString, today } from '@/lib/date';
import { Button, Card, SectionTitle } from './components';
import { confirmAsync, notify } from './dialog';
import { colors } from './theme';

function downloadText(fileName: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

/** データはこのブラウザにしかないので、JSON ファイルへの書き出しと復元を用意する */
export function BackupCard() {
  const lastBackupAt = useSyncExternalStore(subscribe, getLastBackupAt);
  const fileInput = useRef<HTMLInputElement>(null);

  function exportBackup() {
    const now = new Date();
    downloadText(backupFileName(today()), serializeBackup(getSnapshot(), now));
    setLastBackupAt(now.toISOString());
  }

  async function importBackup(file: File) {
    const result = parseBackup(await file.text());
    if (!result.ok) {
      notify('復元できませんでした', result.error);
      return;
    }
    const from = result.exportedAt ? `${formatDate(toDateString(new Date(result.exportedAt)))}に書き出した` : '';
    const ok = await confirmAsync(
      `${from}バックアップで、今のデータを置き換えますか？`,
      `取引 ${result.data.transactions.length} 件・口座 ${result.data.accounts.length} 件。今このブラウザにあるデータは消えます。`,
    );
    if (!ok) return;
    replaceAll(result.data);
    notify('復元しました');
  }

  return (
    <Card>
      <SectionTitle title="データのバックアップ" />
      <Text style={styles.caption}>
        データはこのブラウザの中だけに保存されています。PC
        とスマホでは共有されず、ブラウザのデータを消すと消えてしまいます。
        ときどき書き出しておき、別の端末へ移すときはそのファイルを「復元」で読み込んでください。
      </Text>
      <Text style={styles.last}>
        最後の書き出し：{lastBackupAt ? formatDate(toDateString(new Date(lastBackupAt))) : 'まだありません'}
      </Text>
      <Button title="バックアップを書き出す" onPress={exportBackup} />
      <Button title="バックアップから復元" variant="secondary" onPress={() => fileInput.current?.click()} />
      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        aria-label="バックアップファイル"
        style={{ display: 'none' }}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) importBackup(file);
        }}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  caption: { fontSize: 13, color: colors.subText, lineHeight: 19 },
  last: { fontSize: 13, color: colors.text },
});
