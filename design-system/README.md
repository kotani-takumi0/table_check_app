# design-system

アプリの見た目の決めごとを1か所に置いた場所です。`src/App.css` と React コンポーネントから起こしたもので、アプリのビルドには入りません。読み物と定義だけです。

中身の本体は [project/README.md](project/README.md)。色の使い分け、コントラストの実測値、面の重ね方はそこに書いてあります。まずそれを読んでください。

## どこから来たか

claude.ai のデザインシステム・アーティファクトの `project/` をそのまま落としたものです。

- オリジナル: https://claude.ai/artifact/25aqGSkYuGwCeco2z2zcEn
- 複製: https://claude.ai/artifact/CWGwU4C94567EpxTBhPboa （2026-09-30 時点で全ファイル一致）

アーティファクト側の `index.html` と `artifact-type/`（閲覧アプリ本体、2MB超）は落としていません。タイプ側の所有物で、こちらから書き換えても反映されないためです。`api/` `tokens.css` `manifest.json` も同じくアーティファクトの自動生成物なので、ここにはありません。

## ファイル

| パス | 役割 |
| --- | --- |
| `project/design-system.json` | 索引。`title` が系の名前。**更新は必ず最後** |
| `project/tokens.json` | トークン本体。色11・書体3群・余白7・角丸7・寸法8・枠4・不透明度3・z-index 2 |
| `project/README.md` | ブランドブック。守っていること、コントラスト実測 |
| `project/density.md` | 卓カードの密度4段（標準 / compact / narrow / mini） |
| `project/components/bundle.css` | `src/App.css` を持ち込んだスタイルシート |
| `project/components/<部品>/` | 部品ごとの README とプレビューHTML（12部品） |
| `SKILL.md` | アーティファクトタイプの仕様書。書き換える前に読む |

## アプリとの関係

`project/components/bundle.css` は `src/App.css` の写しです。両方を手で直すと必ずずれます。**アプリの見た目を変えるときは `src/App.css` を直し、そのあとこちらへ写す**順で進めてください。逆はやらない。

`project/tokens.json` の `meta.paths` と `meta.components` に、どのトークンがどのファイルから来たかを書いてあります。

## アーティファクトへ戻すとき

`SKILL.md` の規則どおりに送ります。要点は3つ。

1. 変更したファイルだけを送る。送らなかったファイルはそのまま残る。
2. `project/design-system.json` は**作業の最後の呼び出しに含める**。
3. その索引は**送る直前に読み直す**。古い写しを送ると、アーティファクト側で加わった変更（アセットの追加など）を消してしまう。

## ローカルで見るとき

プレビューHTMLは `var(--seated)` などを参照していますが、それを `:root` に出す `tokens.css` はアーティファクト側の生成物なので、ここにはありません。ブラウザで直接開くと色が出ません。確認したいときは `project/tokens.json` からローカル用の `tokens.css` を作ってください。
