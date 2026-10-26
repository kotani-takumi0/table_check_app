// 資格とプライバシーマニフェストを確かめる。
// 署名しない CI は .xcent を出さないので、資格は project.yml と、xcodegen が書いた Minopal.entitlements を見る。
// プライバシーマニフェストは、ビルドしたアプリ束（--app）だけを見る。
// 使い方：
//   node apps/ios-swift/scripts/check-release-bundle.mjs --self-test
//   node apps/ios-swift/scripts/check-release-bundle.mjs
//   node apps/ios-swift/scripts/check-release-bundle.mjs --app path/to/Release-iphonesimulator/Minopal.app
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readPlist } from './check-no-recording.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const appAttestKey = 'com.apple.developer.devicecheck.appattest-environment';
const entitlementsPath = join(root, 'Minopal', 'Minopal.entitlements');

function stripHashComments(text) {
  return text.split('\n').map((line) => {
    let inSingle = false;
    let inDouble = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === "'" && !inDouble) inSingle = !inSingle;
      else if (c === '"' && !inSingle) inDouble = !inDouble;
      else if (c === '#' && !inSingle && !inDouble) return line.slice(0, i);
    }
    return line;
  }).join('\n');
}

function problemsInSpec(text, label = 'project.yml') {
  const stripped = stripHashComments(text);
  const lines = stripped.split('\n');
  const index = lines.findIndex((line) => line.includes(appAttestKey));
  if (index < 0) return [`${label} の entitlements.properties に ${appAttestKey} が無い`];
  const window = lines.slice(index, index + 2).join('\n');
  if (!/(^|[\s:"'])production([\s"']|$)/.test(window)) {
    return [`${label} の ${appAttestKey} が production ではない`];
  }
  return [];
}

function problemsInEntitlements(data, label) {
  if (!data || typeof data !== 'object' || Array.isArray(data) || Object.keys(data).length === 0) {
    return [`${label} の資格が空`];
  }
  if (data[appAttestKey] !== 'production') {
    return [`${label} に ${appAttestKey} = production が無い`];
  }
  return [];
}

function problemsInEntitlementsFile(file) {
  if (!existsSync(file)) return [`${file} が無い`];
  try {
    return problemsInEntitlements(readPlist(file), file);
  } catch (error) {
    return [`${file} を読めない: ${error.message}`];
  }
}

function problemsInPrivacy(appPath) {
  const problems = [];
  if (!appPath.includes('Release-')) {
    problems.push(`渡されたアプリが Release ビルドではない（パスに Release- が無い）: ${appPath}`);
  }
  const file = join(appPath, 'PrivacyInfo.xcprivacy');
  if (!existsSync(file)) return [...problems, `${appPath} に PrivacyInfo.xcprivacy が無い`];
  const raw = readFileSync(file);
  if (raw.length === 0 || !raw.toString('utf8').trim()) return [...problems, `${file} の中身が空`];
  let data;
  try {
    data = readPlist(file);
  } catch (error) {
    return [...problems, `${file} を読めない: ${error.message}`];
  }
  if (!data || typeof data !== 'object' || Array.isArray(data) || Object.keys(data).length === 0) {
    return [...problems, `${file} の中身が空`];
  }
  return problems;
}

function assertEqual(actual, expected, message) {
  const left = JSON.stringify(actual);
  const right = JSON.stringify(expected);
  if (left !== right) throw new Error(`${message}\n実際: ${left}\n期待: ${right}`);
}

function plist(body) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<plist version="1.0"><dict>${body}</dict></plist>\n`;
}

function selfTest() {
  const commented = `# ${appAttestKey} はコメント\nname: Minopal\n`;
  assertEqual(problemsInSpec(commented).length, 1, 'コメントだけの資格を見過ごす');
  assertEqual(
    problemsInSpec(`entitlements:\n  properties:\n    ${appAttestKey}: development\n`).length,
    1,
    'production 以外を見過ごす',
  );
  assertEqual(
    problemsInSpec(`entitlements:\n  properties:\n    ${appAttestKey}: production\n`),
    [],
    'properties の production を誤検知する',
  );
  assertEqual(problemsInEntitlements({}, 'empty'), ['empty の資格が空'], '空の資格を見過ごす');
  assertEqual(problemsInEntitlements({ other: 'x' }, 'other').length, 1, 'キーの欠落を見過ごす');
  assertEqual(problemsInEntitlements({ [appAttestKey]: 'production' }, 'ok'), [], 'production を誤検知する');

  const dir = mkdtempSync(join(tmpdir(), 'minopal-release-'));
  try {
    const entitlements = join(dir, 'Minopal.entitlements');
    const app = join(dir, 'Release-iphonesimulator', 'Minopal.app');
    writeFileSync(entitlements, plist(''));
    assertEqual(problemsInEntitlementsFile(entitlements), [`${entitlements} の資格が空`], '空の資格ファイルを見過ごす');
    writeFileSync(entitlements, plist('<key>other</key><string>x</string>'));
    if (!problemsInEntitlementsFile(entitlements).some((line) => line.includes(appAttestKey))) {
      throw new Error('資格ファイルのキー欠落を見過ごす');
    }
    writeFileSync(entitlements, plist(`<key>${appAttestKey}</key><string>production</string>`));
    assertEqual(problemsInEntitlementsFile(entitlements), [], 'production の資格ファイルを誤検知する');

    mkdirSync(app, { recursive: true });
    if (!problemsInPrivacy(app).some((line) => line.includes('PrivacyInfo.xcprivacy が無い'))) {
      throw new Error('プライバシーマニフェストの欠落を見過ごす');
    }
    writeFileSync(join(app, 'PrivacyInfo.xcprivacy'), '');
    if (!problemsInPrivacy(app).some((line) => line.includes('中身が空'))) {
      throw new Error('空のプライバシーマニフェストを見過ごす');
    }
    writeFileSync(join(app, 'PrivacyInfo.xcprivacy'), plist('<key>NSPrivacyTracking</key><false/>'));
    assertEqual(problemsInPrivacy(app), [], 'プライバシーマニフェストがあるアプリを誤検知する');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }

  const spec = problemsInSpec(readFileSync(join(root, 'project.yml'), 'utf8'));
  if (spec.length > 0) throw new Error(spec.join('\n'));
  const generated = problemsInEntitlementsFile(entitlementsPath);
  if (generated.length > 0) throw new Error(generated.join('\n'));
  console.log('資格とプライバシーマニフェストの自己テストに通りました');
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes('--self-test')) {
    try { selfTest(); } catch (error) {
      console.error(error.message);
      process.exit(1);
    }
  }
  const problems = [
    ...problemsInSpec(readFileSync(join(root, 'project.yml'), 'utf8')),
    ...problemsInEntitlementsFile(entitlementsPath),
  ];
  const appFlag = args.indexOf('--app');
  if (appFlag >= 0) {
    const appPath = args[appFlag + 1];
    if (!appPath) {
      console.error('--app のあとに Minopal.app のパスが要る');
      process.exit(1);
    }
    problems.push(...problemsInPrivacy(appPath));
  }
  if (problems.length > 0) {
    console.error(problems.join('\n'));
    process.exit(1);
  }
  console.log(appFlag >= 0
    ? '資格とプライバシーマニフェストを確かめました'
    : 'project.yml と Minopal.entitlements の App Attest の資格は production です');
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) main();
