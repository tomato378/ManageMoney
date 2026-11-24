import type { Statement } from '@/lib/statements';
import type { TransactionInput } from '@/types';
import { importStatement } from '../importStatement';
import { saveAccount, saveRecurring, postDueRecurring, saveTransaction, seedData, type AppData } from '../state';

function base(): AppData {
  let d = seedData();
  for (const [id, type, balance] of [
    ['cash', 'cash', 10000],
    ['bank', 'bank', 50000],
    ['card', 'credit', 0],
    ['pp', 'emoney', 3000],
    ['ppcard', 'credit', 0],
  ] as const) {
    d = saveAccount(d, { id, name: id, type, balance, sortOrder: 0, archived: false });
  }
  return d;
}
const map = { cash: 'cash', smbc: 'bank', 'olive-credit': 'card', paypay: 'pp', 'paypay-card': 'ppcard', sbi: 'bank' };
const balance = (d: AppData, id: string) => d.accounts.find((a) => a.id === id)!.balance;
const receipt = (amount: number, date: string): TransactionInput => ({
  kind: 'expense', amount, categoryId: 'food', accountId: 'cash', toAccountId: null, date, memo: 'ローソン', origin: 'receipt',
});

const card: Statement = {
  source: 'olive-credit',
  rows: [
    { date: '2026-10-01', amount: 324, kind: 'expense', name: 'ローソン', key: 'olive-credit:a' },
    { date: '2026-10-07', amount: 2980, kind: 'expense', name: 'ビックカメラ', key: 'olive-credit:b' },
  ],
};

describe('明細の取り込み', () => {
  it('新しい支出を記録し、口座の残高を動かす', () => {
    const { data, result } = importStatement(base(), card, map);
    expect(result).toEqual({ added: 2, matched: 0, skipped: 0, unresolved: 0 });
    expect(balance(data, 'card')).toBe(-3304);
    expect(data.transactions.map((t) => [t.memo, t.origin, t.accountId])).toEqual([
      ['ローソン', 'statement', 'card'],
      ['ビックカメラ', 'statement', 'card'],
    ]);
  });

  it('同じ明細を2回取り込んでも二重にならない', () => {
    const once = importStatement(base(), card, map).data;
    const twice = importStatement(once, card, map);
    expect(twice.result).toEqual({ added: 0, matched: 0, skipped: 2, unresolved: 0 });
    expect(twice.data.transactions).toHaveLength(2);
  });

  it('レシートで記録した支出は、払った口座を明細の口座に付け替える', () => {
    const d = saveTransaction(base(), null, receipt(324, '2026-10-02'));
    const { data, result } = importStatement(d, card, map);
    expect(result.matched).toBe(1);
    expect(data.transactions).toHaveLength(2);
    const lawson = data.transactions.find((t) => t.amount === 324)!;
    expect(lawson).toMatchObject({ accountId: 'card', categoryId: 'food', origin: 'receipt' });
    // 財布から引いていた分が戻り、カードの未払いになる
    expect(balance(data, 'cash')).toBe(10000);
    expect(balance(data, 'card')).toBe(-3304);
  });

  it('PayPay のカード払いと PayPayカードの明細は1件にまとめる', () => {
    const paypay: Statement = {
      source: 'paypay',
      rows: [{ date: '2026-11-17', amount: 1180, kind: 'expense', name: 'Delivery Shop', source: 'paypay-card', key: 'paypay:1:out' }],
    };
    const ppcard: Statement = {
      source: 'paypay-card',
      rows: [{ date: '2026-11-18', amount: 1180, kind: 'expense', name: 'DELIVERY SHOP', key: 'paypay-card:x' }],
    };
    const d = importStatement(importStatement(base(), paypay, map).data, ppcard, map);
    expect(d.result.matched).toBe(1);
    expect(d.data.transactions).toHaveLength(1);
    expect(d.data.transactions[0].memo).toBe('Delivery Shop');
    expect(balance(d.data, 'ppcard')).toBe(-1180);
  });

  it('2つの明細に出る口座間の移動（チャージ）は1件にまとめる', () => {
    const paypay: Statement = {
      source: 'paypay',
      rows: [{ date: '2026-09-23', amount: 10000, kind: 'transfer-in', name: 'チャージ', counterpart: 'sbi', key: 'paypay:7:in' }],
    };
    const sbi: Statement = {
      source: 'sbi',
      rows: [{ date: '2026-09-23', amount: 10000, kind: 'transfer-out', name: 'PayPay', counterpart: 'paypay', key: 'sbi:1' }],
    };
    const d = importStatement(importStatement(base(), paypay, map).data, sbi, map);
    expect(d.result.matched).toBe(1);
    expect(d.data.transactions).toHaveLength(1);
    expect(balance(d.data, 'pp')).toBe(13000);
    expect(balance(d.data, 'bank')).toBe(40000);
  });

  it('毎月の項目（給料）は、明細の実際の金額に直す', () => {
    let d = saveRecurring(base(), {
      id: 'salary', name: '給料', kind: 'income', amount: 200000, categoryId: 'salary', accountId: 'bank',
      dayOfMonth: 25, startMonth: '2026-10', lastPostedMonth: null,
    });
    d = postDueRecurring(d, '2026-10-26');
    const bank: Statement = {
      source: 'smbc',
      rows: [{ date: '2026-10-24', amount: 213456, kind: 'income', name: 'キュウヨ', key: 'smbc:s' }],
    };
    const { data, result } = importStatement(d, bank, map);
    expect(result.matched).toBe(1);
    expect(data.transactions).toEqual([expect.objectContaining({ amount: 213456, origin: 'recurring' })]);
  });

  it('割り勘で受け取ったお金は割り勘カテゴリの入金として記録する', () => {
    const paypay: Statement = {
      source: 'paypay',
      rows: [{ date: '2026-11-20', amount: 1557, kind: 'income', name: 'たろうさんから受け取り', categoryId: 'split', key: 'paypay:9:in' }],
    };
    const { data } = importStatement(base(), paypay, map);
    expect(data.transactions[0]).toMatchObject({ kind: 'income', categoryId: 'split', accountId: 'pp' });
  });

  it('銀行の明細は、口座の残高を明細の残高に合わせる', () => {
    const bank: Statement = {
      source: 'smbc',
      rows: [{ date: '2026-11-09', amount: 100, kind: 'expense', name: 'デビット払い', key: 'smbc:d' }],
      balance: 50000,
      lastDate: '2026-11-09',
    };
    const { data } = importStatement(base(), bank, map);
    expect(balance(data, 'bank')).toBe(50000);
    expect(data.settings.confirmedAt.bank).toBe('2026-11-09');
  });

  it('残高を確かめた日より前の動きは、残高を動かさない', () => {
    let d = base();
    d = { ...d, settings: { ...d.settings, confirmedAt: { card: '2026-10-05' } } };
    const { data } = importStatement(d, card, map);
    // 10/1 の 324円は確かめた残高に含まれている。10/7 の 2,980円だけ増える
    expect(balance(data, 'card')).toBe(-2980);
    expect(data.transactions).toHaveLength(2);
  });

  it('口座が決まっていない行は取り込まない', () => {
    const { result } = importStatement(base(), card, {});
    expect(result.unresolved).toBe(2);
  });
});
