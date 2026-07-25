import assert from 'node:assert/strict';
import { test } from 'node:test';
import { stateToShareQuery, searchParamsToState, SHARE_URL_SCHEMA_VERSION } from './shareUrl.js';

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
});

test('label はURLに含まれない（意図的な仕様）', () => {
  const state = { version: 1, note: 'C4', trillNote: null, keys: {}, label: '秘密のメモ' };
  const query = stateToShareQuery(state);
  assert.doesNotMatch(query, /秘密/);
  assert.doesNotMatch(decodeURIComponent(query), /秘密/);
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
