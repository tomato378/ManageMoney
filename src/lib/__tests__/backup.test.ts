import { saveTransaction, seedData } from '@/data/state';
import { backupFileName, normalizeData, parseBackup, serializeBackup } from '../backup';

describe('バックアップ', () => {
  const data = saveTransaction(seedData(), null, {
    kind: 'expense',
    amount: 500,
    categoryId: 'food',
    accountId: 'cash',
    toAccountId: null,
    date: '2026-11-04',
    memo: 'コーヒー',
  });

  it('書き出したものを読み込むと元に戻る', () => {
    const result = parseBackup(serializeBackup(data, new Date('2026-11-04T09:00:00Z')));
    expect(result).toEqual({ ok: true, data, exportedAt: '2026-11-04T09:00:00.000Z' });
  });

  it('JSON でないファイルは拒否', () => {
    expect(parseBackup('not json')).toEqual({ ok: false, error: 'JSON ファイルとして読み込めませんでした' });
  });

  it('別アプリの JSON は拒否', () => {
    expect(parseBackup(JSON.stringify({ app: 'other', version: 1, data }))).toMatchObject({ ok: false });
  });

  it('新しいバージョンのファイルは拒否', () => {
    expect(parseBackup(JSON.stringify({ app: 'managemoney', version: 99, data }))).toMatchObject({ ok: false });
  });

  it('中身が壊れていれば拒否', () => {
    const broken = { app: 'managemoney', version: 1, data: { ...data, transactions: 'x' } };
    expect(parseBackup(JSON.stringify(broken))).toEqual({ ok: false, error: 'バックアップの中身が壊れています' });
  });

  it('足りない設定は既定値で補う', () => {
    const { settings: _settings, ...rest } = data;
    expect(normalizeData(rest)?.settings.quickCategoryIds).toEqual(['food', 'daily', 'transport', 'hobby']);
  });

  it('ファイル名に日付が入る', () => {
    expect(backupFileName('2026-11-04')).toBe('managemoney-2026-11-04.json');
  });
});
