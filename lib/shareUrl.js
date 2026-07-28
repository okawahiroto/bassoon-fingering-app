// 運指データ(スキーマv1)とシェアURLのクエリ文字列を相互変換する。
// 副作用のない純関数のみで構成し、ブラウザ(<script type="module">)からもNodeからも実行できる。
//
// 例: state {note:'C#4', trillNote:'D#4', keys:{whisper:1,'low-cs':2}, label:'替え指'}
//  -> "v=1&n=Cs4&k=whisper.1_low-cs.2&tn=Ds4&l=%E6%9B%BF%E3%81%88%E6%8C%87"
//
// note/trillNoteの "#" はcrawler等でURLと衝突するため "s" に置き換える（"b" はそのまま）。
// label(メモ)は l に入れる。URLSearchParamsがpercent-encodingを行うので手動エンコードは不要。
// 日本語は1文字がURL上9バイトに膨らむため、URL化する時だけ長さを制限する(state自体は変更しない)。

export const SHARE_URL_SCHEMA_VERSION = 1;

// メモをURLに載せる際の上限文字数。超えた分は切り詰めて末尾に「…」を付ける。
export const SHARE_URL_LABEL_MAX_LENGTH = 200;

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

// メモをURL用に切り詰める（上限超過時は末尾に「…」）。stateは変更しない。
function truncateLabel(label) {
  const text = String(label || '');
  if (text.length <= SHARE_URL_LABEL_MAX_LENGTH) return text;
  return `${text.slice(0, SHARE_URL_LABEL_MAX_LENGTH)}…`;
}

// state -> URLSearchParams（v/n/k/tn/l）
export function stateToSearchParams(state) {
  const params = new URLSearchParams();
  params.set('v', String((state && state.version) || SHARE_URL_SCHEMA_VERSION));
  if (state && state.note) params.set('n', noteToToken(state.note));
  const keysToken = keysToToken(state && state.keys);
  if (keysToken) params.set('k', keysToken);
  if (state && state.trillNote) params.set('tn', noteToToken(state.trillNote));
  if (state && state.label) params.set('l', truncateLabel(state.label));
  return params;
}

// state -> クエリ文字列（先頭 "?" 付き）
export function stateToShareQuery(state) {
  return `?${stateToSearchParams(state).toString()}`;
}

// URLSearchParams | クエリ文字列 | location.search -> state
// l が無い旧形式のURLでも label: '' として読める（後方互換）
export function searchParamsToState(input) {
  const params = input instanceof URLSearchParams ? input : new URLSearchParams(input || '');
  const version = parseInt(params.get('v'), 10) || SHARE_URL_SCHEMA_VERSION;
  const note = tokenToNote(params.get('n') || '');
  const trillNoteRaw = params.get('tn');
  const trillNote = trillNoteRaw ? tokenToNote(trillNoteRaw) : null;
  const keys = tokenToKeys(params.get('k') || '');
  const label = params.get('l') || '';
  return { version, note, trillNote, keys, label };
}
