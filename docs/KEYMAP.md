# KEYMAP(picture/bassoon_key.svg キーID対応表)

作成日: 2026-07-11。作者(ファゴット奏者)への確認を経て確定。
`picture/bassoon_key.svg` の各図形に `id` 属性として反映済み。

## 全29キー

| キーID(SVGのid) | 名称 | 手/指の区分 | 備考 |
|---|---|---|---|
| `bb-alternate` | Bb Alternate | 右手指 | |
| `eb-trill` | Eb Trill | 左手指 | 2026-07-11 に追加されたキー(旧SVGには無かった) |
| `low-g` | Low G | 右手指 | |
| `a-hole` | A Hole | 右手指 | トーンホール |
| `b-hole` | B Hole | 右手指 | トーンホール |
| `low-cs` | Low C# | 左手指 | |
| `low-ds-resonance` | Low D#(Resonance Key) | 左手指 | 共鳴キー |
| `e-hole` | E Hole | 左手指 | トーンホール |
| `d-hole` | D Hole | 左手指 | トーンホール |
| `c-hole` | C Hole | 左手指 | トーンホール |
| `high-eb` | High Eb | 左手指 | |
| `high-e` | High E | 左手指 | |
| `cs-trill` | C# Trill | 右手指 | |
| `low-e` | Low E | 右手親指 | |
| `whisper` | Whisper Key | 左手親指 | |
| `high-a` | High A | 左手親指 | |
| `high-d` | High D | 左手親指 | |
| `bb` | Bb | 右手親指 | |
| `high-c` | High C | 左手親指 | |
| `cs-key` | C# Key | 左手親指 | |
| `low-fs` | Low F# | 右手親指 | |
| `ab-thumb` | Ab | 右手親指 | 「Ab(右手指)」と別キー |
| `low-d` | Low D | 左手親指 | |
| `low-c` | Low C | 左手親指 | |
| `low-b` | Low B | 左手親指 | |
| `low-bb` | Low Bb | 左手親指 | |
| `ab-finger` | Ab | 右手指 | 「Ab(右手親指)」と別キー |
| `fs` | F# | 右手指 | |
| `low-f` | Low F | 右手指 | |

## 確定の経緯

1. `picture/bassoon_key.svg` の28図形(初版)を4象限(横線y=250・縦線x=229で分割、左手親指/左手指/右手親指/右手指に対応)に分け、円=トーンホール・対称曲線=トリル/共鳴キー対、という形状特徴と作者の参考図(英語名の運指図)から座標ベースで初期案を作成。
2. 作者がEb Trillキーを追加した新SVGに差し替え、番号入りの参考写真を提供。写真の手書き番号とSVG図形を、形状の種類・象限内の順序で突き合わせ。
3. 番号の重複・ずれ(18番の重複、26番の重複)が2回発生し、都度チャットで確認して解消。
4. 左手親指クラスタ(9キー)は座標だけでは名前を特定できなかったため、番号確定後に作者へ「番号→名前」を確認して確定。

## 今後スキーマ変更する場合の注意

- キーIDを変更する場合は `app.js` 側の対応（Phase 0で実装予定の状態管理）も同時に更新すること。
- `ab-thumb` と `ab-finger`、`low-fs` と `fs` のように、同名の運指が2箇所にある(替え指)。UI上で表示名が重複しても実装上は別キーとして扱う。
