import { DEFAULT_CATEGORIES } from '../defaults';
import { guessCategoryId, normalizeLine, parseReceipt } from '../receipt';

const TODAY = '2026-11-06';

describe('normalizeLine', () => {
  it('全角を半角に、日本語の文字間と金額内の空白を詰める（OCR は文字ごとに空白を入れる）', () => {
    expect(normalizeLine('合 計 ￥ １, ２３４')).toBe('合計 ¥1,234');
    expect(normalizeLine('お 買 上 計　\\5,980')).toBe('お買上計 ¥5,980');
  });
});

describe('parseReceipt', () => {
  it('コンビニのレシート（お預り・お釣りあり）', () => {
    const text = `
セブン-イレブン 渋谷駅前店
東京都渋谷区道玄坂1-2-3
TEL 03-1234-5678
2026年11月05日(木) 12:34
領 収 書
おにぎり            ¥150
緑茶               ¥128
合 計 2点          ¥278
(8%対象            ¥278)
(内消費税等          ¥20)
お預り              ¥1,000
お釣り               ¥722
`;
    expect(parseReceipt(text, TODAY)).toEqual({
      amount: 278,
      date: '2026-11-05',
      storeName: 'セブン-イレブン渋谷駅前店',
    });
  });

  it('スーパー（小計と合計、スラッシュ区切りの日付）', () => {
    const text = `
**イオン 品川店**
2026/11/03 18:05 No.1234
牛乳 198
食パン 158
小計 ¥356
外税 ¥28
合計 ¥384
現金 ¥500
釣銭 ¥116
`;
    expect(parseReceipt(text, TODAY)).toEqual({ amount: 384, date: '2026-11-03', storeName: 'イオン品川店' });
  });

  it('全角数字・令和の日付・金額が次の行に分かれた場合', () => {
    const text = `
ラーメン 一番
令和８年１０月３１日
ラーメン １，０００円
餃子 　　４５０円
お 会 計
１，４５０円
`;
    expect(parseReceipt(text, TODAY)).toEqual({ amount: 1450, date: '2026-10-31', storeName: 'ラーメン一番' });
  });

  it('2桁の年と時刻がつながった表記', () => {
    expect(parseReceipt('店舗A\n26/11/01 09:15\n合計 1,000', TODAY).date).toBe('2026-11-01');
  });

  it('合計の文字が読めないときは ¥ 付きの最大額', () => {
    const text = 'カフェ ABC\n11月2日\nコーヒー ¥450\nケーキ ¥520\nα言+ ¥970';
    expect(parseReceipt(text, TODAY)).toMatchObject({ amount: 970, date: '2026-11-02' });
  });

  it('月日だけの日付で今日より先なら前の年', () => {
    expect(parseReceipt('店\n12月30日\n合計 500', TODAY).date).toBe('2025-12-30');
  });

  it('未来や古すぎる日付・電話番号は日付にしない', () => {
    expect(parseReceipt('店\n2031/01/01\n03-12-3456\n合計 500', TODAY).date).toBeNull();
  });

  it('何も読めなければ null', () => {
    expect(parseReceipt('', TODAY)).toEqual({ amount: null, date: null, storeName: null });
  });
});

describe('guessCategoryId', () => {
  it('店名やキーワードからカテゴリを推測する', () => {
    expect(guessCategoryId('ローソン 新宿店', DEFAULT_CATEGORIES)).toBe('food');
    expect(guessCategoryId('マツモトキヨシ\nティッシュ', DEFAULT_CATEGORIES)).toBe('daily');
    expect(guessCategoryId('〇〇調剤薬局', DEFAULT_CATEGORIES)).toBe('medical');
    expect(guessCategoryId('ENEOS 給油所\nレギュラー', DEFAULT_CATEGORIES)).toBe('transport');
    expect(guessCategoryId('ユ ニ ク ロ', DEFAULT_CATEGORIES)).toBe('clothes');
  });

  it('駅前店というだけでは交通にしない', () => {
    expect(guessCategoryId('セブン-イレブン 渋谷駅前店', DEFAULT_CATEGORIES)).toBe('food');
  });

  it('英字の短いキーワードは単語として一致したときだけ', () => {
    expect(guessCategoryId('GUEST HOUSE', DEFAULT_CATEGORIES)).toBeNull();
    expect(guessCategoryId('GU 銀座店', DEFAULT_CATEGORIES)).toBe('clothes');
  });

  it('ユーザーのカテゴリにないものは返さない', () => {
    const withoutFood = DEFAULT_CATEGORIES.filter((c) => c.id !== 'food');
    expect(guessCategoryId('ローソン', withoutFood)).toBeNull();
  });
});
