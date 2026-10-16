// 更新のお知らせ（releaseNotes.ts）と今後の予定（roadmap.ts）を、Swift 版 iOS アプリが読む JSON に書き出す。
// 文章は TS のファイルだけで持ち、Swift 版はこの JSON を読む（2か所で書くとずれるため）。
// 書き出す：npm run ios-swift:content ／ 書き出し忘れを確かめる：node scripts/export-ios-content.mjs --check（npm test でも流す）
import { readFileSync, writeFileSync } from 'node:fs';
import { RELEASE_NOTES } from '../packages/core/src/releaseNotes.ts';
import { ROADMAP } from '../packages/core/src/roadmap.ts';

const target = new URL('../apps/ios-swift/MinopalCore/Sources/MinopalCore/Resources/content.json', import.meta.url);
const json = `${JSON.stringify({ releaseNotes: RELEASE_NOTES, roadmap: ROADMAP }, null, 2)}\n`;

if (process.argv.includes('--check')) {
  let current = '';
  try { current = readFileSync(target, 'utf8'); } catch { /* 無ければ違うとして知らせる */ }
  if (current !== json) {
    console.error('Swift 版のお知らせ・予定が TS と違います。npm run ios-swift:content で書き出してください');
    process.exit(1);
  }
} else {
  writeFileSync(target, json);
  console.log(`書き出しました：${target.pathname}`);
}
