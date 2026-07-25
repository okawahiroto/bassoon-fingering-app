# Bassoon Fingering App(静的Web版)

ファゴット(バスーン)の運指を記録・シェアする静的Webアプリ(Vanilla JS、ビルド無し)。
作者はファゴット奏者で、エンジニア経験は独学レベル。説明は丁寧に、専門用語は補足しながら進めること。やり取りは日本語・敬語で、結論から。

## 構成

- `index.html` 画面全体(音名・トリルのセレクト、Memo/Download/Share ボタン、メモモーダル)
- `app.js` 全ロジック(SVG読込とタップでの色循環、五線譜オーバーレイ描画、PNG書き出し、Web Share)
- `app.css` レイアウト(`pointer-events: fill` でSVG図形の内側をタップ可能にしている)
- `picture/bassoon_key.svg` 運指図(キー形状28個+区切り線2本。現状 id 無し)
- `manifest.webmanifest` PWA設定(Service Worker は無し)

## 最初に読むもの

**開発計画・設計判断・既知の問題点はすべて `docs/ROADMAP.md` にある。機能追加・改善の依頼を受けたら必ず先に読むこと。**

要点だけ書くと:

- 運指データスキーマ v1(`{version, note, trillNote, keys: {キーID: 0|1|2|3}, label}`)が全機能の土台。0=開放, 1=押す(黒), 2=半開・特殊(青), 3=トリル(赤)。現状は状態がSVGのDOM属性にしか無く、Phase 0 でデータ化する。Phase 0 が未完のうちはシェアURL・クラウド系の機能を実装しないこと。
- キーID一覧(KEYMAP)とSVG形状の対応付けは、必ず作者(奏者)に確認する。AIの楽器知識で確定させない。確定後は `docs/KEYMAP.md` に記録。
- スキーマ変更時は `version` を上げ、旧形式の読み込み互換を残す。
- 姉妹リポジトリ `~/dev/bassoon-fingering`(Expo版)とスキーマ・シェアURL仕様を共通にしている。片方だけ変えないこと。**どちらのコードベースに一本化するかは未決(ROADMAP冒頭の「戦略判断」参照)。二重開発はしない。**
- ビルド無し・Vanilla JS 構成を維持する(バンドラ・フレームワークを安易に導入しない)。
