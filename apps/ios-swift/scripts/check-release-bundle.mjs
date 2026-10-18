// Release ビルドの資格が空でないことと、プライバシーマニフェストがアプリに入っていることを確かめる。
// XcodeGen は entitlements.properties が空だと、資格ファイルを空の辞書で上書きする。
// 使い方：
//   node apps/ios-swift/scripts/check-release-bundle.mjs --self-test
//   node apps/ios-swift/scripts/check-release-bundle.mjs --app path/to/Release-iphonesimulator/Minopal.app --derived path/to/DerivedData
import { existsSync, mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readPlist } from './check-no-recording.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const appAttestKey = 'com.apple.developer.devicecheck.appattest-environment';

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

function walk(dir, files = []) {
  if (!existsSync(dir)) return files;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path, files);
    else files.push(path);
  }
  return files;
}

// 署名しない Release ビルドは、中間生成物の .xcent に資格を書く（アプリ束には埋め込まない）
function releaseEntitlementFiles(appPath, derived) {
  const files = [];
  const archived = join(appPath, 'archived-expanded-entitlements.xcent');
  if (existsSync(archived)) files.push(archived);
  const rootDir = derived || dirname(dirname(dirname(dirname(appPath))));
  const intermediates = join(rootDir, 'Build', 'Intermediates.noindex');
  for (const file of walk(intermediates)) {
    if (!file.endsWith('.xcent')) continue;
    if (!file.includes('Release-') || !file.includes('Minopal')) continue;
    files.push(file);
  }
  return [...new Set(files)];
}

function problemsInPrivacy(appPath) {
  const file = join(appPath, 'PrivacyInfo.xcprivacy');
  if (!existsSync(file)) return [`${appPath} に PrivacyInfo.xcprivacy が無い`];
  const raw = readFileSync(file);
  if (raw.length === 0 || !raw.toString('utf8').trim()) return [`${file} の中身が空`];
  let data;
  try {
    data = readPlist(file);
  } catch (error) {
    return [`${file} を読めない: ${error.message}`];
  }
  if (!data || typeof data !== 'object' || Array.isArray(data) || Object.keys(data).length === 0) {
    return [`${file} の中身が空`];
  }
  return [];
}

function problemsInReleaseBuild(appPath, derived) {
  const problems = [];
  if (!appPath.includes('Release-')) {
    problems.push(`渡されたアプリが Release ビルドではない（パスに Release- が無い）: ${appPath}`);
  }
  problems.push(...problemsInPrivacy(appPath));
  const entitlements = releaseEntitlementFiles(appPath, derived);
  if (entitlements.length === 0) {
    problems.push(`Release ビルドの資格（.xcent）が見つからない: ${appPath}`);
    return problems;
  }
  for (const file of entitlements) {
    try {
      problems.push(...problemsInEntitlements(readPlist(file), file));
    } catch (error) {
      problems.push(`${file} を読めない: ${error.message}`);
    }
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

function writeFixture(dir, { entitlementsBody, privacyBody, debugEntitlementsBody }) {
  const app = join(dir, 'Build', 'Products', 'Release-iphonesimulator', 'Minopal.app');
  const xcentDir = join(dir, 'Build', 'Intermediates.noindex', 'Minopal.build', 'Release-iphonesimulator', 'Minopal.build');
  const debugDir = join(dir, 'Build', 'Intermediates.noindex', 'Minopal.build', 'Debug-iphonesimulator', 'Minopal.build');
  mkdirSync(app, { recursive: true });
  mkdirSync(xcentDir, { recursive: true });
  mkdirSync(debugDir, { recursive: true });
  if (privacyBody !== undefined) writeFileSync(join(app, 'PrivacyInfo.xcprivacy'), privacyBody);
  writeFileSync(join(xcentDir, 'Minopal.app.xcent'), plist(entitlementsBody));
  if (debugEntitlementsBody !== undefined) {
    writeFileSync(join(debugDir, 'Minopal.app.xcent'), plist(debugEntitlementsBody));
  }
  return app;
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

  const goodDir = mkdtempSync(join(tmpdir(), 'minopal-release-'));
  const badDir = mkdtempSync(join(tmpdir(), 'minopal-release-bad-'));
  const emptyDir = mkdtempSync(join(tmpdir(), 'minopal-release-empty-'));
  try {
    const privacy = plist('<key>NSPrivacyTracking</key><false/>');
    const goodApp = writeFixture(goodDir, {
      entitlementsBody: `<key>${appAttestKey}</key><string>production</string>`,
      privacyBody: privacy,
      debugEntitlementsBody: '',
    });
    assertEqual(problemsInReleaseBuild(goodApp, goodDir), [], '揃った Release ビルドを誤検知する');

    const badApp = writeFixture(badDir, {
      entitlementsBody: '<key>other</key><string>x</string>',
      privacyBody: privacy,
    });
    const bad = problemsInReleaseBuild(badApp, badDir);
    if (!bad.some((line) => line.includes(appAttestKey))) throw new Error('資格の欠落を見過ごす');

    const emptyApp = writeFixture(emptyDir, { entitlementsBody: '', privacyBody: '' });
    const empty = problemsInReleaseBuild(emptyApp, emptyDir);
    if (!empty.some((line) => line.includes('資格が空'))) throw new Error('空の資格を見過ごす');
    if (!empty.some((line) => line.includes('中身が空'))) throw new Error('空のプライバシーマニフェストを見過ごす');

    const noPrivacy = join(emptyDir, 'Build', 'Products', 'Release-iphonesimulator', 'Minopal.app', 'PrivacyInfo.xcprivacy');
    rmSync(noPrivacy);
    if (!problemsInReleaseBuild(emptyApp, emptyDir).some((line) => line.includes('PrivacyInfo.xcprivacy が無い'))) {
      throw new Error('プライバシーマニフェストの欠落を見過ごす');
    }
  } finally {
    rmSync(goodDir, { recursive: true, force: true });
    rmSync(badDir, { recursive: true, force: true });
    rmSync(emptyDir, { recursive: true, force: true });
  }

  const spec = problemsInSpec(readFileSync(join(root, 'project.yml'), 'utf8'));
  if (spec.length > 0) throw new Error(spec.join('\n'));
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
  const problems = [...problemsInSpec(readFileSync(join(root, 'project.yml'), 'utf8'))];
  const appFlag = args.indexOf('--app');
  if (appFlag >= 0) {
    const appPath = args[appFlag + 1];
    if (!appPath) {
      console.error('--app のあとに Minopal.app のパスが要る');
      process.exit(1);
    }
    const derivedFlag = args.indexOf('--derived');
    const derived = derivedFlag >= 0 ? args[derivedFlag + 1] : '';
    problems.push(...problemsInReleaseBuild(appPath, derived || undefined));
  }
  if (problems.length > 0) {
    console.error(problems.join('\n'));
    process.exit(1);
  }
  console.log(appFlag >= 0
    ? 'Release ビルドの資格とプライバシーマニフェストを確かめました'
    : 'project.yml の App Attest の資格は production です');
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) main();
