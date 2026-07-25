// 運指データ(スキーマv1)とシェアURLのクエリ文字列を相互変換する。
// 副作用のない純関数のみで構成し、ブラウザ(<script type="module">)からもNodeからも実行できる。
// フォーマットは姉妹リポジトリ(~/dev/bassoon-fingering, Expo版)の docs/ROADMAP.md と共通仕様。
//
// 例: state {note:'C#4', trillNote:'D#4', keys:{whisper:1,'low-cs':2}}
//  -> "v=1&n=Cs4&k=whisper.1_low-cs.2&tn=Ds4"
//
// note/trillNoteの "#" はcrawler等でURLと衝突するため "s" に置き換える（"b" はそのまま）。
// labelは長文になりうるため、意図的にURLへは含めない（メモはローカル保存/JSONエクスポート側の役割）。

export const SHARE_URL_SCHEMA_VERSION = 1;

function noteToToken(note) {
  return note ? String(note).replace('#', 's') : '';
}

function tokenToNote(token) {
  return token ? String(token).replace('s', '#') : '';
}

function keysToToken(keys) {
  return Object.keys(keys || {})
    .filter((id) => keys[id])
    .map((id) => `${id}.${keys[id]}`)
    .join('_');
}

function tokenToKeys(token) {
  const keys = {};
  if (!token) return keys;
  token.split('_').forEach((pair) => {
    if (!pair) return;
    const sep = pair.lastIndexOf('.');
    if (sep === -1) return;
    const id = pair.slice(0, sep);
    const value = parseInt(pair.slice(sep + 1), 10);
    if (id && Number.isFinite(value) && value > 0) {
      keys[id] = value;
    }
  });
  return keys;
}

// state -> URLSearchParams（v/n/k/tn の4パラメータのみ。labelは含めない）
export function stateToSearchParams(state) {
  const params = new URLSearchParams();
  params.set('v', String((state && state.version) || SHARE_URL_SCHEMA_VERSION));
  if (state && state.note) params.set('n', noteToToken(state.note));
  const keysToken = keysToToken(state && state.keys);
  if (keysToken) params.set('k', keysToken);
  if (state && state.trillNote) params.set('tn', noteToToken(state.trillNote));
  return params;
}

// state -> クエリ文字列（先頭 "?" 付き）
export function stateToShareQuery(state) {
  return `?${stateToSearchParams(state).toString()}`;
}

// URLSearchParams | クエリ文字列 | location.search -> state（labelは常に空文字）
export function searchParamsToState(input) {
  const params = input instanceof URLSearchParams ? input : new URLSearchParams(input || '');
  const version = parseInt(params.get('v'), 10) || SHARE_URL_SCHEMA_VERSION;
  const note = tokenToNote(params.get('n') || '');
  const trillNoteRaw = params.get('tn');
  const trillNote = trillNoteRaw ? tokenToNote(trillNoteRaw) : null;
  const keys = tokenToKeys(params.get('k') || '');
  return { version, note, trillNote, keys, label: '' };
}
