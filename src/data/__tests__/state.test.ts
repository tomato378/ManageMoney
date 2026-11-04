import type { TransactionInput } from '@/types';
import {
  archiveAccount,
  deleteCategory,
  deleteTransaction,
  saveAccount,
  saveBudget,
  saveTransaction,
  seedData,
  type AppData,
} from '../state';

function withBank(): AppData {
  return saveAccount(seedData(), {
    id: 'bank',
    name: '銀行',
    type: 'bank',
    balance: 100000,
    sortOrder: 1,
    archived: false,
  });
}

const expense: TransactionInput = {
  kind: 'expense',
  amount: 1200,
  categoryId: 'food',
  accountId: 'cash',
  toAccountId: null,
  date: '2026-11-04',
  memo: '',
};

function balance(data: AppData, id: string) {
  return data.accounts.find((a) => a.id === id)?.balance;
}

describe('seedData', () => {
  it('初期カテゴリ・財布・設定がある', () => {
    const data = seedData();
    expect(data.accounts.map((a) => a.id)).toEqual(['cash']);
    expect(data.categories.length).toBeGreaterThan(5);
    expect(data.settings.quickCategoryIds).toEqual(['food', 'daily', 'transport', 'hobby']);
  });

  it('呼ぶたびに別のオブジェクト（既定値を書き換えない）', () => {
    const a = seedData();
    a.settings.quickCategoryIds.push('x');
    expect(seedData().settings.quickCategoryIds).not.toContain('x');
  });
});

describe('取引と口座残高', () => {
  it('保存すると取引が増え、口座残高が減る', () => {
    const data = saveTransaction(withBank(), null, expense, 123);
    expect(data.transactions).toHaveLength(1);
    expect(data.transactions[0]).toMatchObject({ ...expense, createdAt: 123 });
    expect(balance(data, 'cash')).toBe(-1200);
    expect(balance(data, 'bank')).toBe(100000);
  });

  it('編集は差額だけ反映し、ID と作成日時を保つ', () => {
    const created = saveTransaction(withBank(), null, expense, 123);
    const before = created.transactions[0];
    const edited = saveTransaction(created, before, { ...expense, amount: 1500, accountId: 'bank' }, 999);
    expect(edited.transactions).toHaveLength(1);
    expect(edited.transactions[0]).toMatchObject({ id: before.id, createdAt: 123, amount: 1500 });
    expect(balance(edited, 'cash')).toBe(0);
    expect(balance(edited, 'bank')).toBe(98500);
  });

  it('削除すると残高が元に戻る', () => {
    const created = saveTransaction(withBank(), null, expense);
    const deleted = deleteTransaction(created, created.transactions[0]);
    expect(deleted.transactions).toHaveLength(0);
    expect(balance(deleted, 'cash')).toBe(0);
  });

  it('振替は移動元から移動先へ', () => {
    const data = saveTransaction(withBank(), null, {
      ...expense,
      kind: 'transfer',
      amount: 20000,
      categoryId: null,
      accountId: 'bank',
      toAccountId: 'cash',
    });
    expect(balance(data, 'bank')).toBe(80000);
    expect(balance(data, 'cash')).toBe(20000);
  });

  it('アーカイブした口座の残高も正しく戻る', () => {
    const created = saveTransaction(withBank(), null, { ...expense, accountId: 'bank' });
    const archived = archiveAccount(created, 'bank');
    const deleted = deleteTransaction(archived, archived.transactions[0]);
    expect(deleted.accounts.find((a) => a.id === 'bank')).toMatchObject({ archived: true, balance: 100000 });
  });

  it('存在しない口座への増減は無視する', () => {
    const data = saveTransaction(seedData(), null, { ...expense, accountId: 'gone' });
    expect(data.transactions).toHaveLength(1);
    expect(balance(data, 'cash')).toBe(0);
  });

  it('元のデータは書き換えない', () => {
    const original = withBank();
    saveTransaction(original, null, expense);
    expect(original.transactions).toHaveLength(0);
    expect(balance(original, 'cash')).toBe(0);
  });
});

describe('カテゴリと予算', () => {
  it('カテゴリを消すとクイック入力からも外れる', () => {
    const data = deleteCategory(seedData(), 'food');
    expect(data.categories.some((c) => c.id === 'food')).toBe(false);
    expect(data.settings.quickCategoryIds).toEqual(['daily', 'transport', 'hobby']);
  });

  it('予算は対象ごとに1件（上書き）', () => {
    let data = saveBudget(seedData(), null, 50000);
    data = saveBudget(data, null, 60000);
    data = saveBudget(data, 'food', 30000);
    expect(data.budgets).toEqual([
      { id: 'total', categoryId: null, monthlyAmount: 60000 },
      { id: 'food', categoryId: 'food', monthlyAmount: 30000 },
    ]);
  });
});
