import type { Account, Transaction } from '@/types';
import {
  investmentSummaries,
  smallSpending,
  spendingPace,
  staleAccounts,
  statementCoverage,
  summarizeTransactions,
} from '../calc';

let n = 0;
const tx = (date: string, amount: number, kind: Transaction['kind'] = 'expense', categoryId: string | null = 'food'): Transaction => ({
  id: String(n++), kind, amount, categoryId, accountId: 'cash', toAccountId: null, date, memo: '', createdAt: 0,
});

describe('割り勘', () => {
  it('受け取ったお金は収入ではなく支出から差し引く', () => {
    expect(summarizeTransactions([tx('2026-11-01', 10000), tx('2026-11-02', 8000, 'income', 'split')])).toEqual({
      income: 0, expense: 2000, net: -2000,
    });
  });
});

it('振込手数料の返金も支出から差し引く', () => {
  expect(summarizeTransactions([tx('2026-11-01', 75, 'expense', 'fee'), tx('2026-11-01', 75, 'income', 'fee')]).expense).toBe(0);
});

it('親のお金・運用の増減は収支に入れない', () => {
  const txs = [
    tx('2026-10-15', 702000, 'expense', 'parent-expense'),
    tx('2026-10-01', 300000, 'income', 'parent-income'),
    tx('2026-10-10', 604, 'income', 'invest-gain'),
    tx('2026-10-11', 1000),
  ];
  expect(summarizeTransactions(txs)).toEqual({ income: 0, expense: 1000, net: -1000 });
});

it('預金・運用の口座ごとの増減', () => {
  const sav: Account = { id: 'sav', name: '定期', type: 'deposit', balance: 300604, sortOrder: 0, archived: false };
  const bank: Account = { id: 'b', name: '銀行', type: 'bank', balance: 1000, sortOrder: 1, archived: false };
  const gain = (date: string, amount: number, kind: 'income' | 'expense') => ({
    ...tx(date, amount, kind, kind === 'income' ? 'invest-gain' : 'invest-loss'),
    accountId: 'sav',
  });
  const txs = [gain('2026-10-31', 500, 'income'), gain('2026-11-30', 604, 'income'), gain('2026-11-30', 100, 'expense')];
  expect(investmentSummaries([sav, bank], txs, '2026-11')).toEqual([{ account: sav, gain: 504, totalGain: 1004 }]);
});

describe('いつもの月との比較', () => {
  const past = [tx('2026-09-05', 20000), tx('2026-09-20', 50000), tx('2026-10-08', 30000), tx('2026-10-25', 9000)];
  it('過去の月も月初から同じ日までで比べる', () => {
    const pace = spendingPace([...past, tx('2026-11-03', 26000)], '2026-11-10');
    // 9月は10日までに 20,000円、10月は 30,000円 → いつもは 25,000円
    expect(pace).toEqual({ current: 26000, usual: 25000, months: 2, level: 'normal' });
  });
  it('2割5分以上多ければ使いすぎ', () => {
    expect(spendingPace([...past, tx('2026-11-03', 32000)], '2026-11-10').level).toBe('over');
  });
  it('1割以上少なければ控えめ', () => {
    expect(spendingPace([...past, tx('2026-11-03', 20000)], '2026-11-10').level).toBe('good');
  });
  it('特別な出費（学費など）は比べない', () => {
    const pace = spendingPace([...past, tx('2026-11-03', 26000), tx('2026-11-04', 700000, 'expense', 'special')], '2026-11-10');
    expect(pace.current).toBe(26000);
  });
  it('過去の記録がなければ比べない', () => {
    expect(spendingPace([tx('2026-11-03', 1000)], '2026-11-10')).toMatchObject({ usual: null, level: null });
  });
});

it('小さい出費の積み重ね（割り勘・使途不明金はのぞく）', () => {
  const txs = [
    tx('2026-11-02', 300), tx('2026-11-03', 980), tx('2026-11-04', 1500),
    tx('2026-11-05', 500, 'expense', 'split'), tx('2026-11-06', 200, 'expense', 'unknown'),
    tx('2026-10-02', 400),
  ];
  expect(smallSpending(txs, '2026-11-10')).toEqual({ count: 2, total: 1280, usualTotal: 400 });
});

it('1か月以上残高を確かめていない口座', () => {
  const acc = (id: string): Account => ({ id, name: id, type: 'bank', balance: 0, sortOrder: 0, archived: false });
  const stale = staleAccounts([acc('a'), acc('b'), acc('c')], { a: '2026-11-01', b: '2026-09-01' }, '2026-11-10');
  expect(stale.map((s) => [s.account.id, s.days])).toEqual([['c', null], ['b', 70]]);
});

it('カードの明細がそろっている最後の日', () => {
  const acc = (id: string, type: Account['type']): Account => ({ id, name: id, type, balance: 0, sortOrder: 0, archived: false });
  const imported = (date: string, accountId: string): Transaction => ({ ...tx(date, 100), accountId, importKeys: ['x'] });
  const txs = [imported('2026-10-08', 'saison'), imported('2026-10-25', 'olive'), imported('2026-11-09', 'bank'), tx('2026-11-20', 500)];
  expect(statementCoverage([acc('saison', 'credit'), acc('olive', 'credit'), acc('bank', 'bank')], txs)).toBe('2026-10-08');
  expect(statementCoverage([acc('bank', 'bank')], txs)).toBeNull();
});
