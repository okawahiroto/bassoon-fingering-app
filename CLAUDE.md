# Bassoon Fingering App(静的Web版)

ファゴット(バスーン)の運指を記録・シェアする静的Webアプリ(Vanilla JS、ビルド無し)。
作者はファゴット奏者で、エンジニア経験は独学レベル。説明は丁寧に、専門用語は補足しながら進めること。やり取りは日本語・敬語で、結論から。

## リポジトリ

- リモート(origin): `https://github.com/okawahiroto/bassoon-fingering-app.git`(2026-07-25に `bassoonkeyapp` から改名)
- 開発ブランチ: `main`(直接開発。feature/score-overlayは2026-07-25にmainへマージ・削除済み)
- 進捗管理: GitHub Issues(#1〜#8)。`docs/ROADMAP.md` は設計判断・データスキーマの詳細リファレンス

## 構成

- `index.html` 画面全体(音名・トリルのセレクト、Memo/Download/Share ボタン、メモモーダル)
- `app.js` 全ロジック(SVG読込とタップでのstate更新・描画、五線譜オーバーレイ描画、PNG書き出し、Web Share)。`state = {version, note, trillNote, keys, label}` を唯一の正として管理する
- `app.css` レイアウト(`pointer-events: fill` でSVG図形の内側をタップ可能にしている)
- `picture/bassoon_key.svg` 運指図(キー形状29個+区切り線2本。全キーに `id` 付与済み。対応は `docs/KEYMAP.md` 参照)
- `lib/shareUrl.js` 運指state ↔ URLクエリ文字列の変換(純関数)。`lib/shareUrl.test.js` で `npm test` 可能。まだapp.js側からは未結線
- `manifest.webmanifest` PWA設定(Service Worker は無し)

## 最初に読むもの

**開発計画・設計判断・既知の問題点はすべて `docs/ROADMAP.md` にある。機能追加・改善の依頼を受けたら必ず先に読むこと。**

要点だけ書くと:

- 運指データスキーマ v1(`{version, note, trillNote, keys: {キーID: 0|1|2|3}, label}`)が全機能の土台。0=開放, 1=押す(黒), 2=半開・特殊(青), 3=トリル(赤)。Phase 0(データ化・KEYMAP確定・状態管理の一元化)は完了済み。次はPhase 1(マイライブラリ)・Phase 2(URLシェアUI)。
- キーID一覧(KEYMAP)は `docs/KEYMAP.md` に確定済み(作者確認済み)。今後キーを追加・変更する場合も、必ず作者(奏者)に確認してから `docs/KEYMAP.md` を更新すること。AIの楽器知識だけで確定させない。
- スキーマ変更時は `version` を上げ、旧形式の読み込み互換を残す。
- 姉妹リポジトリ `~/dev/bassoon-fingering`(Expo版)とスキーマ・シェアURL仕様を共通にしている。片方だけ変えないこと。**どちらのコードベースに一本化するかは未決(ROADMAP冒頭の「戦略判断」参照)。二重開発はしない。**「値3=トリル」「trillNote」の拡張はWeb版で実装済みだが、Expo版ROADMAPへの反映はまだ。
- ビルド無し・Vanilla JS 構成を維持する(バンドラ・フレームワークを安易に導入しない)。`package.json` はNodeでの単体テスト実行用のみで、依存パッケージは無い。
