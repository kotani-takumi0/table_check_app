// 申請ビルドに、マイク許可・バックグラウンドの audio・録音の API が入っていないことを確かめる。
// ソース（Info.plist・project.yml・Swift）と、--app で渡した Release ビルドの Info.plist を見る。
// システムの通知音（AudioToolbox）は録音ではないので、ここでは見ない。
// 使い方：node apps/ios-swift/scripts/check-no-recording.mjs [--self-test] [--app path/to/Minopal.app]
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

// Swift のソースに、これがあれば録音（またはその入口）とみなす
const recordingPatterns = [
  { re: /\bAVAudioRecorder\b/, name: 'AVAudioRecorder' },
  { re: /\bAVAudioEngine\b/, name: 'AVAudioEngine' },
  { re: /\.inputNode\b/, name: 'AVAudioEngine の inputNode' },
  { re: /\brequestRecordPermission\b/, name: 'requestRecordPermission' },
  { re: /\bAVAudioSession\b/, name: 'AVAudioSession' },
  { re: /\bAVAudioApplication\b/, name: 'AVAudioApplication' },
  { re: /\binstallTap\b/, name: 'installTap' },
  { re: /\bisMeteringEnabled\b/, name: 'isMeteringEnabled' },
  { re: /\bbuiltInMicrophone\b/, name: 'builtInMicrophone' },
  { re: /\bimport\s+AVFoundation\b/, name: 'import AVFoundation' },
  { re: /\bimport\s+AVFAudio\b/, name: 'import AVFAudio' },
  { re: /\bSFSpeechRecognizer\b/, name: 'SFSpeechRecognizer' },
  { re: /\bAVCaptureDevice\b/, name: 'AVCaptureDevice' },
];

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

// コメントと文字列の中は、コンパイルされる録音コードではない
function stripSwiftCommentsAndStrings(source) {
  let out = '';
  let i = 0;
  while (i < source.length) {
    const c = source[i];
    const next = source[i + 1];
    if (c === '/' && next === '/') {
      i += 2;
      while (i < source.length && source[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && next === '*') {
      i += 2;
      while (i < source.length && !(source[i] === '*' && source[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    if (c === '"') {
      out += ' ';
      i++;
      while (i < source.length) {
        if (source[i] === '\\') { i += 2; continue; }
        if (source[i] === '"') { i++; break; }
        i++;
      }
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

function problemsInPlistObject(data, label) {
  const problems = [];
  if (!data || typeof data !== 'object' || Array.isArray(data)) return problems;
  if (Object.hasOwn(data, 'NSMicrophoneUsageDescription')) {
    problems.push(`${label} に NSMicrophoneUsageDescription がある`);
  }
  const modes = data.UIBackgroundModes;
  if (Array.isArray(modes) && modes.some((mode) => mode === 'audio')) {
    problems.push(`${label} の UIBackgroundModes に audio がある`);
  }
  return problems;
}

function parsePlistXml(xml) {
  const noComments = xml.replace(/<!--[\s\S]*?-->/g, '');
  const matched = noComments.match(/<plist\b[^>]*>([\s\S]*)<\/plist>/);
  if (!matched) throw new Error('plist の中身が読めない');
  const s = matched[1];
  let i = 0;
  function skip() {
    while (i < s.length && /\s/.test(s[i])) i++;
  }
  function starts(tag) {
    return s.startsWith(`<${tag}`, i) && /[\s>/]/.test(s[i + tag.length + 1] ?? '');
  }
  function parse() {
    skip();
    if (starts('dict')) return parseCollection('dict', true);
    if (starts('array')) return parseCollection('array', false);
    if (starts('string')) return parseText('string');
    if (starts('key')) return parseText('key');
    if (starts('integer')) return Number(parseText('integer'));
    if (starts('real')) return Number(parseText('real'));
    if (starts('date')) return parseText('date');
    if (starts('data')) return parseText('data');
    if (starts('true')) { consumeTag('true'); return true; }
    if (starts('false')) { consumeTag('false'); return false; }
    throw new Error(`読めない plist の要素: ${s.slice(i, i + 40)}`);
  }
  function consumeTag(tag) {
    skip();
    const close = s.indexOf('>', i);
    if (close < 0 || !s.startsWith(`<${tag}`, i)) throw new Error(`${tag} が読めない`);
    i = close + 1;
  }
  function parseText(tag) {
    skip();
    if (s.startsWith(`<${tag}/>`, i) || s.startsWith(`<${tag} />`, i)) {
      i = s.indexOf('>', i) + 1;
      return '';
    }
    const openEnd = s.indexOf('>', i);
    if (openEnd < 0) throw new Error(`${tag} の始まりが読めない`);
    i = openEnd + 1;
    const close = s.indexOf(`</${tag}>`, i);
    if (close < 0) throw new Error(`${tag} の終わりが読めない`);
    const text = s.slice(i, close)
      .replaceAll('&lt;', '<')
      .replaceAll('&gt;', '>')
      .replaceAll('&quot;', '"')
      .replaceAll('&apos;', "'")
      .replaceAll('&amp;', '&');
    i = close + tag.length + 3;
    return text;
  }
  function parseCollection(tag, isDict) {
    skip();
    if (s.startsWith(`<${tag}/>`, i) || s.startsWith(`<${tag} />`, i)) {
      i = s.indexOf('>', i) + 1;
      return isDict ? {} : [];
    }
    const openEnd = s.indexOf('>', i);
    i = openEnd + 1;
    const value = isDict ? {} : [];
    while (true) {
      skip();
      if (s.startsWith(`</${tag}>`, i)) {
        i += tag.length + 3;
        break;
      }
      if (isDict) {
        const key = parseText('key');
        value[key] = parse();
      } else {
        value.push(parse());
      }
    }
    return value;
  }
  return parse();
}

function readPlist(file) {
  const bytes = readFileSync(file);
  const header = bytes.subarray(0, 6).toString('ascii');
  const xml = header === 'bplist'
    ? execFileSync('plutil', ['-convert', 'xml1', '-o', '-', file], { encoding: 'utf8' })
    : bytes.toString('utf8');
  return parsePlistXml(xml);
}

function problemsInProjectYml(text, label) {
  const problems = [];
  const stripped = stripHashComments(text);
  if (stripped.includes('NSMicrophoneUsageDescription')) {
    problems.push(`${label} に NSMicrophoneUsageDescription がある`);
  }
  const lines = stripped.split('\n');
  for (let index = 0; index < lines.length; index++) {
    if (!lines[index].includes('UIBackgroundModes')) continue;
    const indent = lines[index].match(/^\s*/)[0].length;
    const chunk = [lines[index]];
    for (let next = index + 1; next < lines.length; next++) {
      if (lines[next].trim() === '') continue;
      const nextIndent = lines[next].match(/^\s*/)[0].length;
      if (nextIndent <= indent) break;
      chunk.push(lines[next]);
    }
    const tokens = chunk.join('\n').split(/[^A-Za-z0-9_]+/);
    if (tokens.includes('audio')) problems.push(`${label} の UIBackgroundModes に audio がある`);
  }
  return problems;
}

function problemsInSwift(source, label) {
  const code = stripSwiftCommentsAndStrings(source);
  return recordingPatterns
    .filter((pattern) => pattern.re.test(code))
    .map((pattern) => `${label} が ${pattern.name} を使っている`);
}

function walk(dir, files = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.build' || entry.name === '.swiftpm' || entry.name === 'Minopal.xcodeproj' || entry.name === 'DerivedData') continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path, files);
    else files.push(path);
  }
  return files;
}

function problemsInTree(tree = root) {
  const problems = [];
  for (const file of walk(tree)) {
    const label = relative(tree, file);
    if (file.endsWith('.swift')) problems.push(...problemsInSwift(readFileSync(file, 'utf8'), label));
    else if (file.endsWith('.plist') || file.endsWith('.entitlements')) {
      problems.push(...problemsInPlistObject(readPlist(file), label));
    } else if (file.endsWith('project.yml')) problems.push(...problemsInProjectYml(readFileSync(file, 'utf8'), label));
  }
  return problems;
}

function problemsInApp(appPath) {
  const problems = [];
  if (!appPath.includes('Release-')) {
    problems.push(`渡されたアプリが Release ビルドではない（パスに Release- が無い）: ${appPath}`);
  }
  const plist = join(appPath, 'Info.plist');
  try {
    problems.push(...problemsInPlistObject(readPlist(plist), `${appPath}/Info.plist`));
  } catch (error) {
    problems.push(`Release ビルドの Info.plist を読めない: ${error.message}`);
  }
  return problems;
}

function assertEqual(actual, expected, message) {
  const left = JSON.stringify(actual);
  const right = JSON.stringify(expected);
  if (left !== right) throw new Error(`${message}\n実際: ${left}\n期待: ${right}`);
}

function selfTest() {
  const mic = `<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0"><dict>
  <!-- マイク（NSMicrophoneUsageDescription）はコメントだけ -->
  <key>NSMicrophoneUsageDescription</key><string>録音します</string>
</dict></plist>`;
  assertEqual(
    problemsInPlistObject(parsePlistXml(mic), 'mic.plist').length,
    1,
    'マイク許可のキーを見落とす',
  );

  const commentOnly = `<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0"><dict>
  <!-- マイク（NSMicrophoneUsageDescription）と UIBackgroundModes の audio は入れない -->
  <key>NSAllowsLocalNetworking</key><true/>
</dict></plist>`;
  assertEqual(problemsInPlistObject(parsePlistXml(commentOnly), 'comment.plist'), [], 'コメントのマイク許可を誤検知する');

  const background = `<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0"><dict>
  <key>UIBackgroundModes</key>
  <array><string>remote-notification</string><string>audio</string></array>
</dict></plist>`;
  assertEqual(problemsInPlistObject(parsePlistXml(background), 'bg.plist').length, 1, 'audio のバックグラウンドを見落とす');

  const fetchOnly = `<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0"><dict>
  <key>UIBackgroundModes</key><array><string>fetch</string></array>
</dict></plist>`;
  assertEqual(problemsInPlistObject(parsePlistXml(fetchOnly), 'fetch.plist'), [], 'fetch を audio と誤検知する');

  assertEqual(
    problemsInProjectYml('INFOPLIST_KEY_NSMicrophoneUsageDescription: 録音\n', 'project.yml').length,
    1,
    'project.yml のマイク許可を見落とす',
  );
  assertEqual(
    problemsInProjectYml('# NSMicrophoneUsageDescription は入れない\nname: Minopal\n', 'project.yml'),
    [],
    'project.yml のコメントを誤検知する',
  );
  assertEqual(
    problemsInProjectYml('INFOPLIST_KEY_UIBackgroundModes:\n  - remote-notification\n  - audio\n', 'project.yml').length,
    1,
    'project.yml の audio を見落とす',
  );
  assertEqual(
    problemsInProjectYml('INFOPLIST_KEY_UIBackgroundModes: fetch\n', 'project.yml'),
    [],
    'project.yml の fetch を audio と誤検知する',
  );

  const recorder = 'import AVFoundation\nlet recorder = AVAudioRecorder()\nlet engine = AVAudioEngine()\n_ = engine.inputNode\n';
  const found = problemsInSwift(recorder, 'Record.swift').map((line) => line.replace('Record.swift が ', '').replace(' を使っている', ''));
  for (const name of ['import AVFoundation', 'AVAudioRecorder', 'AVAudioEngine', 'AVAudioEngine の inputNode']) {
    if (!found.includes(name)) throw new Error(`録音 API を見落とす: ${name}`);
  }
  assertEqual(
    problemsInSwift('// AVAudioRecorder は使わない\nAudioServicesPlaySystemSound(1007)\n', 'Sound.swift'),
    [],
    'コメントや通知音を録音と誤検知する',
  );
  assertEqual(problemsInSwift('requestRecordPermission()\n', 'Mic.swift').length, 1, '録音の許可を見落とす');

  const real = problemsInTree(root);
  if (real.length > 0) throw new Error(`今のソースが録音なしではない:\n${real.join('\n')}`);
  console.log('検出の自己テストに通りました');
}

function main() {
  const args = process.argv.slice(2);
  const problems = [];
  if (args.includes('--self-test')) {
    try { selfTest(); } catch (error) {
      console.error(error.message);
      process.exit(1);
    }
  }
  problems.push(...problemsInTree(root));
  const appFlag = args.indexOf('--app');
  if (appFlag >= 0) {
    const appPath = args[appFlag + 1];
    if (!appPath) {
      console.error('--app のあとに Minopal.app のパスが要る');
      process.exit(1);
    }
    problems.push(...problemsInApp(appPath));
  }
  if (problems.length > 0) {
    console.error(problems.join('\n'));
    process.exit(1);
  }
  console.log('録音関連は入っていません（マイク許可・UIBackgroundModes の audio・録音 API）');
}

main();
