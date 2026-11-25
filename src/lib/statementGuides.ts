import type { StatementSource } from '@/types';

/**
 * 明細CSVをダウンロードしに行くページと、くわしい手順。
 * 手順は各社の公式ヘルプ・FAQ に書かれているボタン名に合わせている（2026年11月時点）。
 * 画面は変わることがあるので、リンクは設定で自分のものに変えられる。
 */

export type Device = 'phone' | 'pc';

export interface DeviceSteps {
  /** そのやり方の名前（「セゾンPortal アプリ」など） */
  label: string;
  /** この端末ではできない理由。あれば steps は空 */
  unavailable?: string;
  /** できるけれど、公式にはほかの端末がすすめられている */
  limited?: boolean;
  /** 押すボタン・選ぶものを順番に */
  steps: string[];
}

export interface StatementGuide {
  source: StatementSource;
  /** 開くページ（公式サイトの入り口） */
  url: string;
  /** 一覧に出す短い手順 */
  summary: string;
  /** 端末ごとのくわしい手順 */
  devices: Record<Device, DeviceSteps>;
  /** 知っておくとよいこと（期間の制限など） */
  notes: string[];
  /** 手順の出どころ（公式の説明） */
  helpUrl: string;
}

export const STATEMENT_GUIDES: StatementGuide[] = [
  {
    source: 'saison',
    url: 'https://www.saisoncard.co.jp/netanswer/',
    summary: 'Netアンサーにログイン → 月を選ぶ →「ご利用明細書をダウンロードする」',
    devices: {
      phone: {
        label: 'セゾンPortal アプリ',
        steps: [
          'セゾンPortal アプリを開いてログインする',
          '画面下の「明細」ボタンを押す',
          'ダウンロードしたい月を選ぶ',
          '「Netアンサーで確認」を押す（Netアンサーの画面に移ります）',
          'ご利用内容のいちばん下にある「ご利用明細書をダウンロードする」を押す',
          'CSV を選んで保存する',
        ],
      },
      pc: {
        label: 'Netアンサー（ブラウザ）',
        steps: [
          '「開く」で Netアンサーのページを開き、ログインする',
          'カレンダーのマークを押して、ダウンロードしたい月を選ぶ',
          'ご利用内容のいちばん下にある「ご利用明細書をダウンロードする」を押す',
          'CSV を選んで保存する',
        ],
      },
    },
    notes: [
      'ダウンロードできるのは、請求が確定した明細（最大15か月分）です。次の請求分は、請求月の前月18日ごろから出せます',
      '最近使った分は、明細に出るまで2日〜2週間ほどかかります',
      'アプリのバージョンによって、ボタンの場所や名前が少し違うことがあります',
      'セゾンPortal アプリは iPhone なら iOS 18 以上が必要です。アプリが使えないときは、スマホのブラウザで Netアンサーを開いても同じようにダウンロードできます',
    ],
    helpUrl: 'https://faq.saisoncard.co.jp/saison/detail?site=OA5LHO14&id=1970',
  },
  {
    source: 'olive-credit',
    url: 'https://www.smbc-card.com/mem/vps/index.jsp',
    summary: 'パソコンで Vpass にログイン → ご利用代金明細 →「CSV形式で保存する」',
    devices: {
      phone: {
        label: 'スマホ',
        unavailable:
          '三井住友カードの案内では、明細のCSVはスマホではダウンロードできず、パソコンのブラウザから、となっています（Vpass アプリ・Olive アプリでも同じ）。パソコンの手順を見てください。どうしてもスマホでやるなら、Vpass アプリのメニューの「PCサイトを表示する」から試せますが、保存できるかは公式には書かれていません。',
        steps: [],
      },
      pc: {
        label: 'Vpass（パソコンのブラウザ）',
        steps: [
          '「開く」で Vpass のページを開き、Vpass ID とパスワードでログインする（Olive アプリの SMBC ID とは別です）',
          '「ご利用代金明細照会」（WEB明細書）を開く',
          'ダウンロードしたい月を選ぶ',
          '明細の画面の上にある「CSV形式で保存する」を押して保存する',
        ],
      },
    },
    notes: [
      'CSV で保存できるのは主に当月分で、過去の月は PDF だけのことがあります。毎月こまめに取っておくと安心です',
      '見られるのは過去15か月分までです',
    ],
    helpUrl:
      'https://faq-memfs.smbc-card.com/%E3%80%8CVpass%E3%80%8D%E3%81%A7%E3%82%AB%E3%83%BC%E3%83%89%E3%81%94%E5%88%A9%E7%94%A8%E4%BB%A3%E9%87%91%E6%98%8E%E7%B4%B0%E6%9B%B8%E3%81%AE%E3%83%80%E3%82%A6%E3%83%B3%E3%83%AD%E3%83%BC%E3%83%89%E3%81%AF%E3%81%A7%E3%81%8D%E3%81%BE%E3%81%99%E3%81%8B%EF%BC%9F-69858c76adb77080228bffe4',
  },
  {
    source: 'smbc',
    url: 'https://www.smbc.co.jp/kojin/direct/',
    summary: '「Webでログイン」→「過去の明細を照会」→ 期間を選んで照会 → CSV でダウンロード',
    devices: {
      phone: {
        label: 'スマホのブラウザ（三井住友銀行アプリではCSVは出せません）',
        limited: true,
        steps: [
          '「開く」で SMBCダイレクトのページを開き、「Webでログイン」を押す（「アプリでログイン」と出たら「Webでログイン」を選ぶ）',
          '店番号・口座番号（または契約者番号）とログイン暗証でログインする',
          '残高の下にある「過去の明細を照会」を押す',
          '「今月」「先月」「直近１年」などのボタンか、期間を指定して照会する',
          '照会結果をダウンロードする（CSV形式）。うまくいかないときはパソコンで試す',
        ],
      },
      pc: {
        label: 'SMBCダイレクト（パソコンのブラウザ）',
        steps: [
          '「開く」で SMBCダイレクトのページを開き、「Webでログイン」を押す',
          '店番号・口座番号（または契約者番号）とログイン暗証でログインする',
          '残高の下にある「過去の明細を照会」を押す',
          '「今月」「先月」「直近１年」などのボタンか、期間を指定して照会する',
          '照会結果の画面からダウンロードする（CSV形式）',
        ],
      },
    },
    notes: [
      '三井住友銀行の案内では、CSV でダウンロードするならパソコンからがおすすめ、となっています',
      'Olive のデビット（iD）の支払いも、この明細に入っています',
      '並び順（新しい順・古い順）はどちらでも取り込めます',
    ],
    helpUrl: 'https://www.smbc.co.jp/direct/sousa/help_kouza/10.html',
  },
  {
    source: 'sbi',
    url: 'https://www.sbishinseibank.co.jp/',
    summary: 'パソコンでログイン →「入出金明細」→ 照会 →「明細をCSVでダウンロードする」',
    devices: {
      phone: {
        label: 'スマホ',
        unavailable:
          'SBI新生銀行の案内では、明細の CSV ダウンロードはパソコンだけ、となっています（SBI新生銀行アプリでは明細を見ることだけできます）。パソコンの手順を見てください。',
        steps: [],
      },
      pc: {
        label: 'パワーダイレクト（パソコンのブラウザ）',
        steps: [
          '「開く」で SBI新生銀行のページを開き、右上の「ログイン」を押す',
          '店番号・口座番号とパワーダイレクトのパスワードでログインする（スマホでの認証を求められたら、SBI新生銀行アプリで承認する）',
          '「入出金明細」を開く',
          '期間などの絞り込み条件を選んで「照会」を押す',
          '一覧の下にある「明細をCSVでダウンロードする」を押して保存する',
        ],
      },
    },
    notes: ['「入出金明細」で見られるのは、だいたい2年前の同じ月までです'],
    helpUrl: 'https://www.sbishinseibank.co.jp/service/newpd/guide/nyuusyutsukin_meisai.html',
  },
  {
    source: 'paypay',
    url: 'https://paypay.ne.jp/help/c0447/',
    summary: 'PayPay アプリの取引履歴 →「取引履歴のダウンロード」→ 申請 → 通知から保存',
    devices: {
      phone: {
        label: 'PayPay アプリ',
        steps: [
          'PayPay アプリのホーム上部にある「取引履歴」を開く（見つからないときは「ウォレット」→「もっと見る」）',
          '右上の「取引履歴のダウンロード」ボタンを押す',
          '期間を選ぶ（「その他の期間」なら過去2年の中から、1回につき1年まで選べる）',
          '「ダウンロード申請をする」を押す',
          'しばらくすると、ホーム右上のベルのマークに通知が届く。「システム」の通知を開く',
          'ダウンロードして保存する（通知から24時間以内。過ぎたらもう一度申請する）',
        ],
      },
      pc: {
        label: 'パソコン',
        unavailable: 'PayPay の取引履歴の CSV は、スマホの PayPay アプリでしか作れません。スマホの手順を見てください。',
        steps: [],
      },
    },
    notes: [
      'PayPayカードでの支払いも、この明細に入っています',
      '処理中・取り消しなどの取引は、CSV に入りません',
    ],
    helpUrl: 'https://paypay.ne.jp/help/c0447/',
  },
];

/** その端末でできるか：できる・できるがおすすめしない・できない */
export function deviceSupport(d: DeviceSteps): 'yes' | 'limited' | 'no' {
  if (d.unavailable) return 'no';
  return d.limited ? 'limited' : 'yes';
}

/** ダウンロードしたあとの共通の手順 */
export const AFTER_DOWNLOAD: string[] = [
  'ダウンロードしたファイルは、iPhone なら「ファイル」アプリの「ダウンロード」、Android なら「ダウンロード」フォルダ、パソコンならブラウザのダウンロードフォルダに入ります',
  'この画面の「CSVファイルを選ぶ」を押して、そのファイルを選ぶ（何個でもまとめて選べます）',
  '期間は前回取り込んだ日と重なっても大丈夫です。同じ行は二重に記録されません',
];

/** 自分で入れたリンクが使えるか（https のページだけ） */
export function isValidLink(url: string): boolean {
  try {
    return new URL(url.trim()).protocol === 'https:';
  } catch {
    return false;
  }
}
