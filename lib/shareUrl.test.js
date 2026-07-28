import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  stateToShareQuery,
  searchParamsToState,
  SHARE_URL_SCHEMA_VERSION,
  SHARE_URL_LABEL_MAX_LENGTH,
} from './shareUrl.js';

test('音名のみ（キー・トリル無し）を往復できる', () => {
  const state = { version: 1, note: 'C4', trillNote: null, keys: {}, label: '' };
  const query = stateToShareQuery(state);
  assert.equal(query, '?v=1&n=C4');
  const restored = searchParamsToState(query);
  assert.equal(restored.note, 'C4');
  assert.equal(restored.trillNote, null);
  assert.deepEqual(restored.keys, {});
});

test('シャープの音名は s に置き換わり、往復で # に戻る', () => {
  const state = { version: 1, note: 'C#4', trillNote: null, keys: {}, label: '' };
  const query = stateToShareQuery(state);
  assert.match(query, /n=Cs4/);
  assert.doesNotMatch(query, /#/);
  const restored = searchParamsToState(query);
  assert.equal(restored.note, 'C#4');
});

test('複数キー(押す/半開/トリル)とトリル音を往復できる', () => {
  const state = {
    version: 1,
    note: 'C#4',
    trillNote: 'D#4',
    keys: { whisper: 1, 'low-cs': 2, 'eb-trill': 3 },
    label: 'テスト用メモ',
  };
  const query = stateToShareQuery(state);
  const restored = searchParamsToState(query);
  assert.equal(restored.note, 'C#4');
  assert.equal(restored.trillNote, 'D#4');
  assert.deepEqual(restored.keys, { whisper: 1, 'low-cs': 2, 'eb-trill': 3 });
  assert.equal(restored.label, 'テスト用メモ');
});

test('メモ(label)を往復できる。日本語はURLエンコードされる', () => {
  const state = { version: 1, note: 'C4', trillNote: null, keys: {}, label: 'ピアニッシモ用の替え指' };
  const query = stateToShareQuery(state);
  // 生のクエリ文字列には日本語がそのまま現れない（percent-encodingされる）
  assert.doesNotMatch(query, /ピアニッシモ/);
  assert.match(decodeURIComponent(query), /ピアニッシモ用の替え指/);
  const restored = searchParamsToState(query);
  assert.equal(restored.label, 'ピアニッシモ用の替え指');
});

test('メモが空のときは l パラメータを出力しない', () => {
  const state = { version: 1, note: 'C4', trillNote: null, keys: {}, label: '' };
  const query = stateToShareQuery(state);
  assert.doesNotMatch(query, /(^|[?&])l=/);
});

test('上限を超えるメモは切り詰められ、末尾に「…」が付く', () => {
  const longLabel = 'あ'.repeat(SHARE_URL_LABEL_MAX_LENGTH + 50);
  const state = { version: 1, note: 'C4', trillNote: null, keys: {}, label: longLabel };
  const restored = searchParamsToState(stateToShareQuery(state));
  assert.equal(restored.label.length, SHARE_URL_LABEL_MAX_LENGTH + 1); // 本文 + 「…」
  assert.ok(restored.label.endsWith('…'));
  assert.equal(restored.label.slice(0, SHARE_URL_LABEL_MAX_LENGTH), 'あ'.repeat(SHARE_URL_LABEL_MAX_LENGTH));
});

test('上限ちょうどのメモは切り詰めず「…」も付けない', () => {
  const label = 'あ'.repeat(SHARE_URL_LABEL_MAX_LENGTH);
  const state = { version: 1, note: 'C4', trillNote: null, keys: {}, label };
  const restored = searchParamsToState(stateToShareQuery(state));
  assert.equal(restored.label, label);
});

test('l が無い旧形式のURLは label が空文字になる（後方互換）', () => {
  const restored = searchParamsToState('v=1&n=Cs4&k=whisper.1');
  assert.equal(restored.label, '');
  assert.equal(restored.note, 'C#4');
  assert.deepEqual(restored.keys, { whisper: 1 });
});

test('値が0のキーはURLに出力されない（スパース表現）', () => {
  const state = { version: 1, note: 'C4', trillNote: null, keys: { whisper: 0, 'low-cs': 1 }, label: '' };
  const query = stateToShareQuery(state);
  const restored = searchParamsToState(query);
  assert.deepEqual(restored.keys, { 'low-cs': 1 });
});

test('vが無いクエリはデフォルトのスキーマバージョンとして解釈する', () => {
  const restored = searchParamsToState('n=C4');
  assert.equal(restored.version, SHARE_URL_SCHEMA_VERSION);
});

test('壊れたkパラメータは無視する（例外を投げない）', () => {
  const restored = searchParamsToState('v=1&n=C4&k=broken_whisper.abc_.5_low-cs.1');
  assert.deepEqual(restored.keys, { 'low-cs': 1 });
});
