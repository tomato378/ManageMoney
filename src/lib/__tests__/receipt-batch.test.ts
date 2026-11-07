import { DEFAULT_CATEGORIES, DEFAULT_SETTINGS } from '../defaults';
import { accountForPayment, findPaymentMethod, readingFromText, reviewReasons } from '../receipt';

describe('支払い方法の判定', () => {
  it.each([
    ['クレジット ￥1,280', 'credit'],
    ['VISA ************1234', 'credit'],
    ['PayPay支払 ¥500', 'emoney'],
    ['交通系IC 残高 1,200', 'emoney'],
    ['iD ¥800', 'emoney'],
    ['お預り ¥1,000\nお釣り ¥220', 'cash'],
    ['合計 ¥780', null],
    ['会員ID 12345\n合計 ¥780', null],
  ])('%s → %s', (text, method) => {
    expect(findPaymentMethod(text)).toBe(method);
  });
});

describe('確認に回すかどうか', () => {
  it('金額・日付が読めないものは確認', () => {
    expect(reviewReasons({ amount: null, date: null, storeName: null }, [])).toEqual(['amount', 'date']);
  });
  it('同じ日・同じ金額の支出があれば二重登録の疑い', () => {
    const existing = [{ kind: 'expense' as const, date: '2026-11-03', amount: 780 }];
    expect(reviewReasons({ amount: 780, date: '2026-11-03', storeName: 'ローソン' }, existing)).toEqual(['duplicate']);
    expect(reviewReasons({ amount: 780, date: '2026-11-04', storeName: 'ローソン' }, existing)).toEqual([]);
  });
});

describe('払った口座', () => {
  const accounts = [
    { id: 'cash', type: 'cash' as const, archived: false },
    { id: 'card', type: 'credit' as const, archived: false },
    { id: 'old-pay', type: 'emoney' as const, archived: true },
  ];
  it('設定がなければその種類の口座', () => {
    expect(accountForPayment('credit', accounts, DEFAULT_SETTINGS)).toBe('card');
  });
  it('その種類の口座がなければ既定の口座、不明なら現金', () => {
    expect(accountForPayment('emoney', accounts, DEFAULT_SETTINGS)).toBe('cash');
    expect(accountForPayment(null, accounts, DEFAULT_SETTINGS)).toBe('cash');
  });
  it('設定で選んだ口座を優先', () => {
    const settings = { ...DEFAULT_SETTINGS, paymentAccountIds: { cash: null, credit: null, emoney: 'card' } };
    expect(accountForPayment('emoney', accounts, settings)).toBe('card');
  });
});

it('読み取った文字から支出を作る', () => {
  const text = 'ローソン 新宿店\n2026年11月3日 12:34\nおにぎり 150\n合計 ¥780\nクレジット ¥780';
  const reading = readingFromText(text, '2026-11-07', {
    categories: DEFAULT_CATEGORIES,
    accounts: [
      { id: 'cash', type: 'cash', archived: false },
      { id: 'card', type: 'credit', archived: false },
    ],
    settings: DEFAULT_SETTINGS,
    transactions: [],
  });
  expect(reading).toEqual({
    method: 'credit',
    reasons: [],
    input: {
      kind: 'expense',
      amount: 780,
      categoryId: 'food',
      accountId: 'card',
      toAccountId: null,
      date: '2026-11-03',
      memo: 'ローソン新宿店',
    },
  });
});
