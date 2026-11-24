import { decodeCsv, guessAccount, neededAccounts, parseCsv, parseStatement, totalMatches } from '../statements';

// テスト環境の TextDecoder は Shift_JIS を読めないので、Node のものを使う（ブラウザは読める）
const { TextDecoder: NodeTextDecoder } = jest.requireActual<{ TextDecoder: typeof TextDecoder }>('util');


// 実際の明細と同じ形の、作り物のデータ
const SAISON = [
  'カード名称,セゾンパール・アメリカン・エキスプレス・カード　デジタル',
  'お支払日,2026/11/04',
  '今回ご請求額,0000001576',
  '',
  '利用日,ご利用店名及び商品名,本人・家族区分,支払区分名称,締前入金区分,利用金額,備考',
  '2026/09/16,QP/ﾄﾞﾄ-ﾙｺ-ﾋ-,,1回,,570,',
  '2026/09/18,QP/ローソン,,1回,,406,',
  '2026/10/08,ANTHROPIC,,1回,,600,現地通貨額:3.65 USD',
  ',(SAN FRANCISCO),,,,,円換算レート:10/09 164.3637',
].join('\r\n');

const OLIVE = [
  '山田　太郎　様,4980-00**-****-****,Ｏｌｉｖｅ／クレジット',
  '2026/10/01,ローソン,324,１,１,324,',
  '2026/10/03,フアミリ―マ―トツクバ,3308,１,１,3308,',
  ',,,,,3632,',
].join('\r\n');

const SMBC = [
  '年月日,お引出し,お預入れ,お取り扱い内容,残高,メモ,ラベル',
  '2026/11/9,100,,"V100001",50000,"",',
  '2026/11/6,100,,"V100002",50100,"",',
  '2026/11/6,,20000,"CT ﾔﾏﾀﾞ ﾀﾛｳ",50200,"",',
  '2026/11/4,360,,"V100003　さくら大学　食堂／ｉＤ",30200,"",',
  '2026/10/26,31000,,"ﾐﾂｲｽﾐﾄﾓｶ-ﾄﾞ (ｶ",30560,"",',
  '2026/10/2,330,,"カード手数料",61890,"",',
  '2026/10/2,20000,,"カード　ｾﾌﾞﾝXX0000",62220,"",',
].join('\r\n');

const PAYPAY = [
  '取引日,出金金額（円）,入金金額（円）,海外出金金額,通貨,変換レート（円）,利用国,取引内容,取引先,取引方法,支払い区分,利用者,取引番号',
  '2026/11/20 21:23:39,-,"1,557",-,-,-,JP,受け取った金額,たろう,PayPay残高,-,-,001',
  '2026/11/17 19:43:37,"1,180",-,-,-,-,-,支払い,Delivery Shop,クレジット VISA 0000,ー回払い,-,002',
  '2026/11/15 04:49:48,1,-,-,-,-,-,投資,PayPayポイント運用,PayPayポイント,-,-,003',
  '2026/11/08 08:07:03,300,-,-,-,-,-,送った金額,はなこ,PayPay残高,-,-,004',
  '2026/10/27 16:11:20,"2,999",-,-,-,-,-,支払い,H&M - H＆M駅前店,PayPay残高,-,-,005',
  '2026/10/06 07:06:02,520,-,-,-,-,-,支払い,PayPayカード請求,PayPay残高,-,-,006',
  '2026/09/23 07:36:20,-,"10,000",-,-,-,-,チャージ,PayPay,ＳＢＩ新生銀行 *****59,-,-,007',
].join('\n');

describe('CSV', () => {
  it('引用符の中のカンマを分けない', () => {
    expect(parseCsv('a,"1,130",b\n')).toEqual([['a', '1,130', 'b']]);
  });
  it('Shift_JIS のファイルも読める', () => {
    const sjis = Uint8Array.from([0x83, 0x8d, 0x81, 0x5b, 0x83, 0x5c, 0x83, 0x93]); // ローソン
    expect(decodeCsv(sjis, NodeTextDecoder)).toBe('ローソン');
  });
});

describe('セゾン', () => {
  const s = parseStatement(SAISON)!;
  it('明細の行と請求額を読み、補足行は捨てる', () => {
    expect(s.source).toBe('saison');
    expect(s.rows.map((r) => [r.date, r.amount, r.name])).toEqual([
      ['2026-09-16', 570, 'QP/ドトールコーヒー'],
      ['2026-09-18', 406, 'QP/ローソン'],
      ['2026-10-08', 600, 'ANTHROPIC'],
    ]);
    expect(totalMatches(s)).toBe(true);
  });
});

describe('Olive クレジット', () => {
  it('最後の行の合計と照らし合わせる', () => {
    const s = parseStatement(OLIVE)!;
    expect(s.source).toBe('olive-credit');
    expect(s.rows.map((r) => r.name)).toEqual(['ローソン', 'フアミリーマートツクバ']);
    expect(totalMatches(s)).toBe(true);
  });
});

describe('三井住友銀行', () => {
  const s = parseStatement(SMBC)!;
  it('いちばん新しい残高を読む', () => {
    expect(s.balance).toBe(50000);
    expect(s.lastDate).toBe('2026-11-09');
  });
  it('デビット・ATM・カードの引き落とし・手数料を分ける', () => {
    expect(s.rows.map((r) => [r.kind, r.name, r.counterpart ?? null, r.categoryId ?? null])).toEqual([
      ['expense', 'デビット払い', null, null],
      ['expense', 'デビット払い', null, null],
      ['transfer-in', 'ATMで入金', 'cash', null],
      ['expense', 'さくら大学 食堂', null, null],
      ['transfer-out', 'Olive クレジットの引き落とし', 'olive-credit', null],
      ['expense', 'ATM手数料', null, 'fee'],
      ['transfer-out', 'ATMで引き出し', 'cash', null],
    ]);
  });
});

describe('PayPay', () => {
  const s = parseStatement(PAYPAY)!;
  it('ポイントを捨て、送金・受け取りは割り勘、カード払いは PayPayカードの支出にする', () => {
    expect(s.rows.map((r) => [r.kind, r.amount, r.name, r.categoryId ?? null, r.source ?? null, r.counterpart ?? null])).toEqual([
      ['income', 1557, 'たろうさんから受け取り', 'split', null, null],
      ['expense', 1180, 'Delivery Shop', null, 'paypay-card', null],
      ['expense', 300, 'はなこさんに送金', 'split', 'paypay', null],
      ['expense', 2999, 'H&M - H&M駅前店', null, 'paypay', null],
      ['transfer-out', 520, 'PayPayカードの支払い', null, null, 'paypay-card'],
      ['transfer-in', 10000, 'SBI新生銀行 *****59からチャージ', null, null, 'sbi'],
    ]);
  });
  it('取り込みに必要な口座', () => {
    expect(neededAccounts(s).sort()).toEqual(['paypay', 'paypay-card', 'sbi']);
  });
});

describe('口座の推測', () => {
  const accounts = [
    { id: 'w', name: '財布', type: 'cash' as const, archived: false },
    { id: 'olive', name: 'Olive', type: 'credit' as const, archived: false },
    { id: 'smbc', name: '三井住友銀行', type: 'bank' as const, archived: false },
    { id: 'pp', name: 'PayPay', type: 'emoney' as const, archived: false },
  ];
  const settings = { statementAccountIds: {}, paymentAccountIds: { cash: null, credit: null, emoney: null } };
  it('名前と種類から選ぶ', () => {
    expect(guessAccount('olive-credit', accounts, settings)).toBe('olive');
    expect(guessAccount('smbc', accounts, settings)).toBe('smbc');
    expect(guessAccount('paypay', accounts, settings)).toBe('pp');
    expect(guessAccount('paypay-card', accounts, settings)).toBeNull();
    expect(guessAccount('cash', accounts, settings)).toBe('w');
  });
  it('前に選んだ口座を優先', () => {
    expect(guessAccount('paypay-card', accounts, { ...settings, statementAccountIds: { 'paypay-card': 'pp' } })).toBe('pp');
  });
});
