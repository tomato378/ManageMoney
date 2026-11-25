import type { StatementSource } from '@/types';

/**
 * 明細CSVをダウンロードしに行くページと手順。
 * URL は各社の公式サイトの入り口（ログインはそこから）。画面は変わることがあるので、設定で自分のリンクに変えられる。
 */
export interface StatementGuide {
  source: StatementSource;
  /** 開くページ（公式サイト） */
  url: string;
  /** ダウンロードまでの手順（短く） */
  steps: string;
}

export const STATEMENT_GUIDES: StatementGuide[] = [
  {
    source: 'saison',
    url: 'https://www.saisoncard.co.jp/netanswer/',
    steps: 'Netアンサーにログイン →「ご利用明細」→ 月を選んで CSV をダウンロード',
  },
  {
    source: 'olive-credit',
    url: 'https://www.smbc-card.com/mem/vps/index.jsp',
    steps: 'Vpass にログイン →「ご利用明細」→ 月を選んで CSV をダウンロード',
  },
  {
    source: 'smbc',
    url: 'https://www.smbc.co.jp/kojin/direct/',
    steps: '「Webでログイン」→「入出金明細」→ 期間を選んで照会 → CSV をダウンロード（パソコンからがおすすめ）',
  },
  {
    source: 'sbi',
    url: 'https://www.sbishinseibank.co.jp/',
    steps: '右上の「ログイン」→「入出金明細」→ 期間を選んで CSV をダウンロード',
  },
  {
    source: 'paypay',
    url: 'https://paypay.ne.jp/help/c0447/',
    steps:
      'PayPay アプリの「取引履歴」→ 右上のダウンロード → 期間を選んで申請 → 通知が来たら保存（24時間以内）。PayPayカードの支払いもここに入ります',
  },
];

/** 自分で入れたリンクが使えるか（https のページだけ） */
export function isValidLink(url: string): boolean {
  try {
    return new URL(url.trim()).protocol === 'https:';
  } catch {
    return false;
  }
}
