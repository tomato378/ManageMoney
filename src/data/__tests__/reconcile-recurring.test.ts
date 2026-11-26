import type { RecurringItem } from '@/types';
import { ADJUSTMENT_MEMO, postDueRecurring, reconcileBalances, saveAccount, saveRecurring, seedData, type AppData } from '../state';

function withAccounts(): AppData {
  let data = seedData();
  data = saveAccount(data, { id: 'cash', name: '財布', type: 'cash', balance: 10000, sortOrder: 0, archived: false });
  data = saveAccount(data, { id: 'bank', name: '銀行', type: 'bank', balance: 200000, sortOrder: 1, archived: false });
  data = saveAccount(data, { id: 'card', name: 'カード', type: 'credit', balance: -30000, sortOrder: 2, archived: false });
  // 前に一度残高を確かめた口座として始める
  return { ...data, settings: { ...data.settings, confirmedAt: { cash: '2026-10-01', bank: '2026-10-01', card: '2026-10-01' } } };
}

const balanceOf = (data: AppData, id: string) => data.accounts.find((a) => a.id === id)!.balance;

describe('残高チェック', () => {
  it('減った分は使途不明金として記録し、残高を合わせる', () => {
    const data = reconcileBalances(withAccounts(), { cash: 6800 }, '2026-11-07', 1);
    expect(balanceOf(data, 'cash')).toBe(6800);
    expect(data.transactions).toEqual([
      expect.objectContaining({ kind: 'expense', amount: 3200, categoryId: 'unknown', accountId: 'cash', memo: ADJUSTMENT_MEMO }),
    ]);
    expect(data.balanceChecks).toEqual([
      expect.objectContaining({ date: '2026-11-07', entries: [{ accountId: 'cash', recorded: 10000, actual: 6800 }] }),
    ]);
  });

  it('増えた分は使途不明の収入', () => {
    const data = reconcileBalances(withAccounts(), { bank: 205000 }, '2026-11-07');
    expect(data.transactions).toEqual([expect.objectContaining({ kind: 'income', amount: 5000, categoryId: 'unknown-income' })]);
  });

  it('口座の間のずれは振替で相殺し、残りだけ使途不明金にする', () => {
    // カードの引き落とし 30000 を記録し忘れ、さらに財布から 2000 消えた
    const data = reconcileBalances(withAccounts(), { cash: 8000, bank: 170000, card: 0 }, '2026-11-07');
    expect(balanceOf(data, 'cash')).toBe(8000);
    expect(balanceOf(data, 'bank')).toBe(170000);
    expect(balanceOf(data, 'card')).toBe(0);
    const kinds = data.transactions.map((t) => [t.kind, t.amount, t.accountId, t.toAccountId]);
    expect(kinds).toEqual([
      ['transfer', 30000, 'bank', 'card'],
      ['expense', 2000, 'cash', null],
    ]);
  });

  it('ぴったりなら取引は作らず、チェックの履歴だけ残す', () => {
    const data = reconcileBalances(withAccounts(), { cash: 10000 }, '2026-11-07');
    expect(data.transactions).toEqual([]);
    expect(data.balanceChecks).toHaveLength(1);
  });

  it('一度も確かめていない口座は、差を記録せずに残高をそろえる', () => {
    const fresh = saveAccount(seedData(), { id: 'pp', name: 'PayPay', type: 'emoney', balance: -5000, sortOrder: 0, archived: false });
    const data = reconcileBalances(fresh, { pp: 1200 }, '2026-11-07');
    expect(balanceOf(data, 'pp')).toBe(1200);
    expect(data.transactions).toEqual([]);
    expect(data.settings.confirmedAt.pp).toBe('2026-11-07');
    // 2回目からは差を記録する
    const second = reconcileBalances(data, { pp: 900 }, '2026-11-20');
    expect(second.transactions).toEqual([expect.objectContaining({ kind: 'expense', amount: 300, categoryId: 'unknown' })]);
  });

  it('定期預金の増減は、使途不明金ではなく運用の増減にする（ほかの口座とも相殺しない）', () => {
    let d = saveAccount(withAccounts(), { id: 'sav', name: '定期', type: 'deposit', balance: 300000, sortOrder: 3, archived: false });
    d = { ...d, settings: { ...d.settings, confirmedAt: { ...d.settings.confirmedAt, sav: '2026-10-01' } } };
    const data = reconcileBalances(d, { sav: 300604, cash: 9396 }, '2026-11-07');
    expect(balanceOf(data, 'sav')).toBe(300604);
    expect(data.transactions.map((t) => [t.kind, t.amount, t.accountId, t.categoryId])).toEqual([
      ['expense', 604, 'cash', 'unknown'],
      ['income', 604, 'sav', 'invest-gain'],
    ]);
  });

  it('何も入力しなければ何も変えない', () => {
    const before = withAccounts();
    expect(reconcileBalances(before, {}, '2026-11-07')).toBe(before);
  });
});

describe('毎月の収入・固定費', () => {
  const salary: Omit<RecurringItem, 'id'> & { id: string } = {
    id: 'salary',
    name: '給料',
    kind: 'income',
    amount: 200000,
    categoryId: 'salary',
    accountId: 'cash',
    dayOfMonth: 25,
    startMonth: '2026-09',
    lastPostedMonth: null,
  };

  it('指定日を過ぎた月の分をまとめて記録する', () => {
    const data = postDueRecurring(saveRecurring(seedData(), salary), '2026-11-07');
    expect(data.transactions.map((t) => t.date)).toEqual(['2026-09-25', '2026-10-25']);
    expect(data.transactions[0]).toMatchObject({ kind: 'income', amount: 200000, memo: '給料' });
    expect(data.recurring[0].lastPostedMonth).toBe('2026-10');
    expect(balanceOf(data, 'cash')).toBe(400000);
  });

  it('同じ月は二度記録しない', () => {
    const once = postDueRecurring(saveRecurring(seedData(), salary), '2026-11-07');
    expect(postDueRecurring(once, '2026-11-20')).toBe(once);
    expect(postDueRecurring(once, '2026-11-25').transactions).toHaveLength(3);
  });

  it('31日指定は月末に記録する', () => {
    const rent = { ...salary, id: 'rent', kind: 'expense' as const, dayOfMonth: 31, startMonth: '2026-02' };
    const data = postDueRecurring(saveRecurring(seedData(), rent), '2026-03-01');
    expect(data.transactions.map((t) => t.date)).toEqual(['2026-02-28']);
  });

  it('長く開かなくても追いつくのは24か月分まで', () => {
    const data = postDueRecurring(saveRecurring(seedData(), { ...salary, startMonth: '2020-01' }), '2026-11-30');
    expect(data.transactions).toHaveLength(24);
  });
});
