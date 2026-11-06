// レシート読み取り（Tesseract.js）に必要なファイルを public/ocr/ にコピーする。
// CDN を使わず自分のサイトから配信するため。Expo は public/ の中身をそのまま dist/ に出力する。
import { copyFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const pkgDir = (name) => dirname(require.resolve(`${name}/package.json`));
const out = join(import.meta.dirname, '..', 'public', 'ocr');

const files = [
  [join(pkgDir('tesseract.js'), 'dist', 'worker.min.js'), join(out, 'worker.min.js')],
  // 端末の対応状況に合わせてどれか1つだけ読み込まれる（LSTM 専用版）
  ...['tesseract-core-lstm', 'tesseract-core-simd-lstm', 'tesseract-core-relaxedsimd-lstm'].map((name) => [
    join(pkgDir('tesseract.js-core'), `${name}.wasm.js`),
    join(out, 'core', `${name}.wasm.js`),
  ]),
  [
    join(pkgDir('@tesseract.js-data/jpn'), '4.0.0_best_int', 'jpn.traineddata.gz'),
    join(out, 'lang', 'jpn.traineddata.gz'),
  ],
];

for (const [from, to] of files) {
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(from, to);
}
console.log(`copied ${files.length} OCR files to public/ocr`);
