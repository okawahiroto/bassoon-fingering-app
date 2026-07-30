import { stateToShareQuery, searchParamsToState } from './lib/shareUrl.js';

(function () {
  const wrapper = document.getElementById('bassoon-wrapper');
  const downloadBtn = document.getElementById('download-btn');
  const shareBtn = document.getElementById('share-btn');
  const memoBtn = document.getElementById('memo-btn');
  const textModal = document.getElementById('text-modal');
  const textArea = document.getElementById('text-area');
  const textCloseBtn = document.getElementById('text-close-btn');
  const textDeleteBtn = document.getElementById('text-delete-btn');
  const octaveSelect = document.getElementById('octave-select');
  const noteSelect = document.getElementById('note-select');
  const trillEnabled = document.getElementById('trill-enabled');
  const trillOctaveSelect = document.getElementById('trill-octave-select');
  const trillNoteSelect = document.getElementById('trill-note-select');
  const saveBtn = document.getElementById('save-btn');
  const libraryBtn = document.getElementById('library-btn');
  const libraryModal = document.getElementById('library-modal');
  const libraryList = document.getElementById('library-list');
  const libraryEmptyMessage = document.getElementById('library-empty-message');
  const libraryFilterInput = document.getElementById('library-filter-input');
  const libraryCloseBtn = document.getElementById('library-close-btn');
  const libraryExportBtn = document.getElementById('library-export-btn');
  const libraryImportInput = document.getElementById('library-import-input');
  const sharedBanner = document.getElementById('shared-banner');
  const sharedBannerText = document.getElementById('shared-banner-text');
  const sharedSaveBtn = document.getElementById('shared-save-btn');
  const sharedDismissBtn = document.getElementById('shared-dismiss-btn');
  const moreBtn = document.getElementById('more-btn');
  const moreModal = document.getElementById('more-modal');
  const moreCloseBtn = document.getElementById('more-close-btn');
  if (!wrapper) return;
  const src = wrapper.getAttribute('data-src');
  if (!src) return;

  const CURRENT_KEY = 'fingering_current'; // 編集中のstate(スキーマv1)。リロード時の復元に使う
  const LIBRARY_KEY = 'fingering_library'; // 保存済み運指の配列（{id, createdAt} + スキーマv1）

  // 運指データ(スキーマv1)。SVGの色はここから描画し、DOMの色を正としない。
  // keys: キーID(SVGのid) -> 0=開放(省略可)/1=押す(黒)/2=半開・特殊(青)/3=トリル(赤)
  const state = { version: 1, note: '', trillNote: null, keys: {}, label: '' };

  // --- alert()の代わりのトースト通知 ---
  // iOS「ホーム画面に追加」(standalone)では alert()/confirm() が表示されない既知の問題があるため、
  // 完了・失敗の通知はすべてこれを使う(破壊的操作の確認はボタン自体の2段階確認方式を別途使う)。
  let toastTimer = null;
  function showToast(message, opts = {}) {
    const el = document.getElementById('toast');
    if (!el) return;
    clearTimeout(toastTimer);
    el.textContent = message;
    el.classList.toggle('is-error', !!opts.error);
    el.hidden = false;
    requestAnimationFrame(() => el.classList.add('is-visible'));
    toastTimer = setTimeout(() => {
      el.classList.remove('is-visible');
      setTimeout(() => { el.hidden = true; }, 200);
    }, opts.error ? 4000 : 2200);
  }

  // --- 編集中stateの永続化(リロード時の復元用) ---
  function saveCurrentDraft() {
    try { localStorage.setItem(CURRENT_KEY, JSON.stringify(state)); } catch {}
  }
  function loadCurrentDraft() {
    try {
      const raw = localStorage.getItem(CURRENT_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return (parsed && typeof parsed === 'object') ? parsed : null;
    } catch { return null; }
  }

  // --- マイライブラリ（保存済み運指の配列）---
  function randomId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
  function loadLibrary() {
    try {
      const raw = localStorage.getItem(LIBRARY_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  }
  function saveLibrary(list) {
    try { localStorage.setItem(LIBRARY_KEY, JSON.stringify(list)); } catch {}
  }
  // keysオブジェクトをキー順に整列した文字列にする（インポート時の重複判定に使う）
  function canonicalKeysString(keys) {
    return Object.keys(keys || {}).filter((k) => keys[k]).sort()
      .map((k) => `${k}=${keys[k]}`).join(',');
  }
  function addLibraryEntry(srcState) {
    const list = loadLibrary();
    const entry = {
      id: randomId(),
      version: srcState.version || 1,
      note: srcState.note || '',
      trillNote: srcState.trillNote || null,
      keys: { ...(srcState.keys || {}) },
      label: srcState.label || '',
      createdAt: new Date().toISOString(),
    };
    list.push(entry);
    saveLibrary(list);
    return entry;
  }
  function removeLibraryEntry(id) {
    saveLibrary(loadLibrary().filter((e) => e.id !== id));
  }
  function duplicateLibraryEntry(id) {
    const list = loadLibrary();
    const srcEntry = list.find((e) => e.id === id);
    if (!srcEntry) return null;
    const copy = { ...srcEntry, id: randomId(), createdAt: new Date().toISOString() };
    list.push(copy);
    saveLibrary(list);
    return copy;
  }

  // タップ時の見た目の巡回順(黒→赤→青)とスキーマ値(1→3→2)は並びが異なるため対応表で明示する
  const KEY_CYCLE = [0, 1, 3, 2];
  const KEY_FILL_BY_VALUE = { 1: 'black', 3: 'red', 2: 'blue' };

  function applyKeyVisual(el, value) {
    el.setAttribute('fill', KEY_FILL_BY_VALUE[value] || 'transparent');
  }

  function renderKeys(svg) {
    svg.querySelectorAll('path[id], circle[id], rect[id], ellipse[id], polygon[id], polyline[id]').forEach((el) => {
      applyKeyVisual(el, state.keys[el.id] || 0);
    });
  }

  function cycleKeyState(el) {
    const keyId = el.id;
    if (!keyId) return;
    const current = state.keys[keyId] || 0;
    const next = KEY_CYCLE[(KEY_CYCLE.indexOf(current) + 1) % KEY_CYCLE.length];
    if (next === 0) {
      delete state.keys[keyId];
    } else {
      state.keys[keyId] = next;
    }
    applyKeyVisual(el, next);
    saveCurrentDraft();
  }

  // --- テキストモーダルとLocalStorage ---
  function openTextModal() {
    if (!(textModal instanceof HTMLElement)) return;
    textModal.hidden = false;
    if (textArea instanceof HTMLTextAreaElement) {
      // メモはユーザーが書いた内容だけを保持する。音名は state.note が持っており、
      // 画面・五線譜・書き出し画像・シェアURLにも入るため、ここへ差し込むと二重になる。
      textArea.value = getSavedText();
      // モバイルでキーボードが出ない対策：即時フォーカス + 選択範囲設定
      try {
        textArea.focus({ preventScroll: true });
        const len = textArea.value.length;
        textArea.setSelectionRange(len, len);
      } catch {}
      // rAFで追いフォーカス（iOS対策）
      try { requestAnimationFrame(() => { try { textArea.focus({ preventScroll: true }); } catch {} }); } catch {}
      // キーボード重なり対策：少し後で中央付近にスクロール
      try { setTimeout(() => { try { textArea.scrollIntoView({ block: 'center' }); } catch {} }, 80); } catch {}
    }
  }
  function closeTextModal() {
    if (!(textModal instanceof HTMLElement)) return;
    textModal.hidden = true;
  }
  function saveTextValue(val) {
    state.label = val || '';
    saveCurrentDraft();
  }
  function syncAllTextAreas(val) {
    if (textArea instanceof HTMLTextAreaElement) {
      textArea.value = val;
    }
  }
  function getSavedText() {
    return state.label || '';
  }

  // state.note / state.trillNote を現在のセレクト値から同期する
  function syncNoteState() {
    if (!(octaveSelect instanceof HTMLSelectElement) || !(noteSelect instanceof HTMLSelectElement)) return;
    const oct = parseInt(octaveSelect.value, 10);
    const idx = parseInt(noteSelect.value, 10);
    state.note = indexAndOctaveToText(idx, oct);
  }
  function syncTrillNoteState() {
    const trillOn = (trillEnabled instanceof HTMLInputElement) && !!trillEnabled.checked;
    if (!trillOn || !(trillOctaveSelect instanceof HTMLSelectElement) || !(trillNoteSelect instanceof HTMLSelectElement)) {
      state.trillNote = null;
      return;
    }
    const toct = parseInt(trillOctaveSelect.value, 10);
    const tidx = parseInt(trillNoteSelect.value, 10);
    state.trillNote = indexAndOctaveToText(tidx, toct);
  }

  fetch(src)
    .then((res) => res.text())
    .then((svgText) => {
      wrapper.innerHTML = svgText;
      const svg = wrapper.querySelector('svg');
      if (!svg) return;
      svg.id = 'bassoonSvg';
      // 既定は "meet"（全体が収まる）。フルスクリーン時も切り取りは行わない。
      if (!svg.getAttribute('preserveAspectRatio')) {
        svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
      }

      // 純CSSレイアウトにより高さ調整（JSは不要）

      // URLにシェアクエリ(v/n/k/tn/l)があれば、ローカルの下書きより優先して復元する
      let isSharedLoad = false;
      const sharedParamsRaw = new URLSearchParams(location.search);
      if (sharedParamsRaw.has('n') || sharedParamsRaw.has('k')) {
        const shared = searchParamsToState(sharedParamsRaw);
        if (shared.note || Object.keys(shared.keys || {}).length) {
          isSharedLoad = true;
          state.version = shared.version || 1;
          state.note = shared.note || '';
          state.trillNote = shared.trillNote || null;
          state.keys = { ...(shared.keys || {}) };
          state.label = shared.label || '';
        }
        // URLからクエリを消す（リロード時に毎回同じ共有内容へ戻らないように）
        try { history.replaceState(null, '', location.pathname); } catch {}
      }

      // 前回編集していた運指(state.keys/note/trillNote/label)をLocalStorageから復元する
      // (共有URLを開いた場合はそちらを優先し、ローカル下書きでは上書きしない)
      const draft = isSharedLoad ? null : loadCurrentDraft();
      if (draft) {
        state.version = draft.version || 1;
        state.note = draft.note || '';
        state.trillNote = draft.trillNote || null;
        state.keys = { ...(draft.keys || {}) };
        state.label = draft.label || '';
      }
      syncAllTextAreas(state.label || '');
      renderKeys(svg);

      if (isSharedLoad && sharedBanner instanceof HTMLElement) {
        sharedBanner.hidden = false;
      }

      // note-select用の再構築関数はif内で定義されるため、後段(ライブラリ読込)から
      // 参照できるよう外側のletに代入する形にする
      let rebuildNoteOptions;

      svg.addEventListener('click', (ev) => {
        const target = ev.target;
        if (!(target instanceof Element)) return;
        const shape = target.closest('path, rect, circle, ellipse, polygon, polyline');
        if (shape && svg.contains(shape) && shape.id) {
          cycleKeyState(shape);
        }
      });

      // 楽譜（左下オーバーレイ）初期化とイベント
      // セレクトへの保存値の反映（旧バージョンのテキスト保存も考慮）
      if (octaveSelect instanceof HTMLSelectElement && noteSelect instanceof HTMLSelectElement) {
        // ノートセレクトの内容をオクターブに応じて再構築
        rebuildNoteOptions = (oct) => {
          const entriesAllDesc = [
            { v: 11, label: 'B' },
            { v: 10, label: 'A#/Bb' },
            { v: 9, label: 'A' },
            { v: 8, label: 'G#/Ab' },
            { v: 7, label: 'G' },
            { v: 6, label: 'F#/Gb' },
            { v: 5, label: 'F' },
            { v: 4, label: 'E' },
            { v: 3, label: 'D#/Eb' },
            { v: 2, label: 'D' },
            { v: 1, label: 'C#/Db' },
            { v: 0, label: 'C' },
          ];
          const entriesC1 = [
            { v: 10, label: 'A#/Bb' },
            { v: 11, label: 'B' },
          ];
          const current = parseInt(noteSelect.value || '0', 10);
          const allowed = (oct === 1) ? entriesC1 : entriesAllDesc;
          noteSelect.innerHTML = '';
          allowed.forEach(({ v, label }) => {
            const opt = document.createElement('option');
            opt.value = String(v);
            opt.textContent = label;
            noteSelect.appendChild(opt);
          });
          // 現在値が許容されない場合は先頭を選択
          const stillExists = allowed.some(({ v }) => v === current);
          noteSelect.value = stillExists ? String(current) : String(allowed[0].v);
        };

        // 共有URL/下書きでstate.noteが既に決まっていれば復元。無ければHTMLの初期値をそのまま使用
        const restored = state.note
          ? applyNoteToSelects(state.note, octaveSelect, noteSelect, rebuildNoteOptions)
          : false;
        if (!restored) {
          rebuildNoteOptions(parseInt(octaveSelect.value, 10));
        }
        syncNoteState();

        const onChange = () => {
          const oct = parseInt(octaveSelect.value, 10);
          rebuildNoteOptions(oct);
          syncNoteState();
          saveCurrentDraft();
          updateScoreSvg(svg);
        };
        octaveSelect.addEventListener('change', onChange);
        noteSelect.addEventListener('change', onChange);
      }

      // Trill UI: チェックで活性化、C1時の選択制限は本体と同様に適用
      const rebuildTrillNoteOptions = (oct) => {
        if (!(trillNoteSelect instanceof HTMLSelectElement)) return;
        const entriesAllDesc = [
          { v: 11, label: 'B' },
          { v: 10, label: 'A#/Bb' },
          { v: 9, label: 'A' },
          { v: 8, label: 'G#/Ab' },
          { v: 7, label: 'G' },
          { v: 6, label: 'F#/Gb' },
          { v: 5, label: 'F' },
          { v: 4, label: 'E' },
          { v: 3, label: 'D#/Eb' },
          { v: 2, label: 'D' },
          { v: 1, label: 'C#/Db' },
          { v: 0, label: 'C' },
        ];
        const entriesC1 = [
          { v: 10, label: 'A#/Bb' },
          { v: 11, label: 'B' },
        ];
        const current = parseInt((trillNoteSelect.value || '11'), 10);
        const allowed = (oct === 1) ? entriesC1 : entriesAllDesc;
        trillNoteSelect.innerHTML = '';
        allowed.forEach(({ v, label }) => {
          const opt = document.createElement('option');
          opt.value = String(v);
          opt.textContent = label;
          trillNoteSelect.appendChild(opt);
        });
        const stillExists = allowed.some(({ v }) => v === current);
        trillNoteSelect.value = stillExists ? String(current) : String(allowed[0].v);
      };

      if (trillEnabled instanceof HTMLInputElement &&
          trillOctaveSelect instanceof HTMLSelectElement &&
          trillNoteSelect instanceof HTMLSelectElement) {
        // 共有URL/下書きでstate.trillNoteが既に決まっていれば復元
        const restoredTrill = state.trillNote
          ? applyNoteToSelects(state.trillNote, trillOctaveSelect, trillNoteSelect, rebuildTrillNoteOptions)
          : false;
        trillEnabled.checked = restoredTrill;
        trillOctaveSelect.disabled = !trillEnabled.checked;
        trillNoteSelect.disabled = !trillEnabled.checked;
        if (!restoredTrill) {
          rebuildTrillNoteOptions(parseInt(trillOctaveSelect.value, 10) || 3);
        }
        syncTrillNoteState();

        trillEnabled.addEventListener('change', () => {
          const enabled = !!trillEnabled.checked;
          trillOctaveSelect.disabled = !enabled;
          trillNoteSelect.disabled = !enabled;
          if (enabled) {
            rebuildTrillNoteOptions(parseInt(trillOctaveSelect.value, 10) || 3);
          }
          syncTrillNoteState();
          saveCurrentDraft();
          // トグル時にも即時再描画
          updateScoreSvg(svg);
        });
        trillOctaveSelect.addEventListener('change', () => {
          rebuildTrillNoteOptions(parseInt(trillOctaveSelect.value, 10) || 3);
          syncTrillNoteState();
          saveCurrentDraft();
          updateScoreSvg(svg);
        });
        trillNoteSelect.addEventListener('change', () => {
          syncTrillNoteState();
          saveCurrentDraft();
          updateScoreSvg(svg);
        });
      }
      // 初回描画
      updateScoreSvg(svg);

      // 音名を安全なファイル名断片に変換（"#"はURL同様に"s"へ）
      function noteToFilenameToken(note) {
        return note ? String(note).replace('#', 's') : '';
      }
      function buildFingeringFilename() {
        const token = noteToFilenameToken(state.note);
        return `fingering_${token || 'untitled'}.png`;
      }
      // 音名の表示行(トリル時は「C#4 → D#4」)。画像フッターと共有テキストで共通に使う
      function buildNoteLine() {
        return state.trillNote ? `${state.note} → ${state.trillNote}` : (state.note || '');
      }
      // 画像に焼き込む文字列(音名+トリル、シェアURL)
      function buildFooterLines(shareUrl) {
        const noteLine = buildNoteLine();
        const lines = [];
        if (noteLine) lines.push(noteLine);
        lines.push(shareUrl);
        return lines;
      }

      // ダウンロードボタンを有効化
      if (downloadBtn instanceof HTMLButtonElement) {
        downloadBtn.disabled = false;
        // Downloadを実行したら、その他シートは自動で閉じる
        // (closeMoreModalは同スコープ内で後から定義されるがfunction宣言なのでhoistされ、ここから参照できる)
        downloadBtn.addEventListener('click', () => { closeMoreModal(); });
        downloadBtn.addEventListener('click', () => {
          const currentSvg = document.getElementById('bassoonSvg');
          if (!currentSvg) return;
          const shareUrl = location.origin + location.pathname + stateToShareQuery(state);
          exportSvgToPngBlob(currentSvg, { footerLines: buildFooterLines(shareUrl) })
            .then((blob) => {
              if (!blob) return;
              const a = document.createElement('a');
              a.href = URL.createObjectURL(blob);
              a.download = buildFingeringFilename();
              document.body.appendChild(a);
              a.click();
              a.remove();
              setTimeout(() => URL.revokeObjectURL(a.href), 1000);
              // 成功メッセージ（画像のみDL）
              showToast('画像のみダウンロードしました');
            })
            .catch(() => {
              showToast('画像の作成に失敗しました。もう一度お試しください。', { error: true });
            });
        });
      }

      // Shareボタン
      if (shareBtn instanceof HTMLButtonElement) {
        shareBtn.disabled = false;
        shareBtn.addEventListener('click', async () => {
          const currentSvg = document.getElementById('bassoonSvg');
          if (!currentSvg) return;
          const shareUrl = location.origin + location.pathname + stateToShareQuery(state);
          const notes = (getSavedText() || '').trim();
          const tag = '#BsnFingApp';
          const hasTag = new RegExp('(^|\\s)'+tag.replace('#','\\#')+'(\\s|$)').test(notes);
          // 音名 / メモ / タグ / シェアURL を行で並べる（メモが空の行は出さない）
          const noteLine = buildNoteLine();
          const shareText = [noteLine, notes, hasTag ? '' : tag, shareUrl]
            .filter(Boolean)
            .join('\n');
          const filename = buildFingeringFilename();
          try {
            const blob = await exportSvgToPngBlob(currentSvg, { footerLines: buildFooterLines(shareUrl) });
            if (!blob) throw new Error('png blob failed');
            const file = new File([blob], filename, { type: 'image/png' });
            if (navigator.canShare && navigator.canShare({ files: [file] }) && navigator.share) {
              await navigator.share({ files: [file], text: shareText });
              return;
            }
            if (navigator.share) {
              await navigator.share({ text: shareText });
              return;
            }
            // フォールバック: テキストをクリップボード、画像は自動ダウンロード
            try { await navigator.clipboard.writeText(shareText); } catch {}
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(a.href), 1000);
            showToast('お使いの環境では画像付き共有に対応していません。画像をダウンロードしました。テキストはクリップボードにコピー済みです。', { error: true });
          } catch (e) {
            showToast('共有に失敗しました。ダウンロード機能をご利用ください。', { error: true });
          }
        });
      }

      // Saveボタン: 現在の運指をライブラリ(LocalStorage)へ保存
      if (saveBtn instanceof HTMLButtonElement) {
        saveBtn.addEventListener('click', () => {
          addLibraryEntry(state);
          showToast('ライブラリに保存しました');
        });
      }

      // 共有URLで開いた時のバナー: 保存 / 閉じる
      if (sharedSaveBtn instanceof HTMLButtonElement) {
        sharedSaveBtn.addEventListener('click', () => {
          addLibraryEntry(state);
          if (sharedBanner instanceof HTMLElement) sharedBanner.hidden = true;
          showToast('ライブラリに保存しました');
        });
      }
      if (sharedDismissBtn instanceof HTMLButtonElement) {
        sharedDismissBtn.addEventListener('click', () => {
          if (sharedBanner instanceof HTMLElement) sharedBanner.hidden = true;
        });
      }

      // state(keys/note/trillNote/label)をUIへ反映する。ライブラリからの読込で使う
      function applyStateToUI() {
        renderKeys(svg);
        syncAllTextAreas(state.label || '');

        if (state.note) {
          applyNoteToSelects(state.note, octaveSelect, noteSelect, rebuildNoteOptions);
        }
        syncNoteState();

        const hasTrill = !!state.trillNote;
        if (trillEnabled instanceof HTMLInputElement) {
          trillEnabled.checked = hasTrill;
          if (trillOctaveSelect instanceof HTMLSelectElement) trillOctaveSelect.disabled = !hasTrill;
          if (trillNoteSelect instanceof HTMLSelectElement) trillNoteSelect.disabled = !hasTrill;
        }
        if (hasTrill) {
          applyNoteToSelects(state.trillNote, trillOctaveSelect, trillNoteSelect, rebuildTrillNoteOptions);
        }
        syncTrillNoteState();

        updateScoreSvg(svg);
      }

      function loadEntryIntoState(entry) {
        state.version = entry.version || 1;
        state.note = entry.note || '';
        state.trillNote = entry.trillNote || null;
        state.keys = { ...(entry.keys || {}) };
        state.label = entry.label || '';
        applyStateToUI();
        saveCurrentDraft();
      }

      function openLibraryModal() {
        if (!(libraryModal instanceof HTMLElement)) return;
        renderLibraryList();
        libraryModal.hidden = false;
      }
      function closeLibraryModal() {
        if (!(libraryModal instanceof HTMLElement)) return;
        libraryModal.hidden = true;
      }

      function renderLibraryList() {
        if (!(libraryList instanceof HTMLElement)) return;
        const filter = (libraryFilterInput instanceof HTMLInputElement ? libraryFilterInput.value : '').trim().toLowerCase();
        const list = loadLibrary().slice().sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        const filtered = filter ? list.filter((e) => (e.note || '').toLowerCase().includes(filter)) : list;

        libraryList.innerHTML = '';
        if (libraryEmptyMessage instanceof HTMLElement) {
          libraryEmptyMessage.hidden = filtered.length > 0;
        }
        filtered.forEach((entry) => {
          const li = document.createElement('li');

          const info = document.createElement('div');
          info.className = 'library-item-info';
          const noteLine = document.createElement('div');
          noteLine.className = 'library-item-note';
          noteLine.textContent = entry.trillNote ? `${entry.note} → ${entry.trillNote}` : (entry.note || '(無題)');
          const labelLine = document.createElement('div');
          labelLine.className = 'library-item-label';
          labelLine.textContent = entry.label || '';
          info.appendChild(noteLine);
          info.appendChild(labelLine);

          const actions = document.createElement('div');
          actions.className = 'library-item-actions';

          const loadBtn = document.createElement('button');
          loadBtn.type = 'button';
          loadBtn.textContent = '読込';
          loadBtn.setAttribute('aria-label', `${entry.note || ''}を読み込む`);
          loadBtn.addEventListener('click', () => {
            loadEntryIntoState(entry);
            closeLibraryModal();
          });

          const dupBtn = document.createElement('button');
          dupBtn.type = 'button';
          dupBtn.textContent = '複製';
          dupBtn.setAttribute('aria-label', `${entry.note || ''}を複製`);
          dupBtn.addEventListener('click', () => {
            duplicateLibraryEntry(entry.id);
            renderLibraryList();
          });

          // iOS Safariの「ホーム画面に追加」(standalone)ではwindow.confirm()が
          // 表示されず常にキャンセル扱いになるため、native dialogに頼らず
          // ボタン自体で2段階確認する(1回目は警告表示、3秒以内の2回目で削除確定)。
          const delBtn = document.createElement('button');
          delBtn.type = 'button';
          delBtn.className = 'library-delete-btn';
          delBtn.textContent = '削除';
          delBtn.setAttribute('aria-label', `${entry.note || ''}を削除`);
          let pendingDelete = false;
          let revertTimer = null;
          delBtn.addEventListener('click', () => {
            if (!pendingDelete) {
              pendingDelete = true;
              delBtn.textContent = '本当に削除？';
              revertTimer = setTimeout(() => {
                pendingDelete = false;
                delBtn.textContent = '削除';
              }, 3000);
              return;
            }
            clearTimeout(revertTimer);
            removeLibraryEntry(entry.id);
            renderLibraryList();
          });

          actions.appendChild(loadBtn);
          actions.appendChild(dupBtn);
          actions.appendChild(delBtn);
          li.appendChild(info);
          li.appendChild(actions);
          libraryList.appendChild(li);
        });
      }

      // その他(⋯)モーダル: Library/Downloadを格納する
      function closeMoreModal() {
        if (!(moreModal instanceof HTMLElement)) return;
        moreModal.hidden = true;
        if (moreBtn instanceof HTMLButtonElement) moreBtn.setAttribute('aria-expanded', 'false');
      }
      if (moreBtn instanceof HTMLButtonElement) {
        moreBtn.addEventListener('click', () => {
          if (moreModal instanceof HTMLElement) {
            moreModal.hidden = false;
            moreBtn.setAttribute('aria-expanded', 'true');
          }
        });
      }
      if (moreCloseBtn instanceof HTMLButtonElement) {
        moreCloseBtn.addEventListener('click', closeMoreModal);
      }
      if (moreModal instanceof HTMLElement) {
        // このモーダルは一覧の再描画をしないため、Libraryのcapture対応(下記コメント参照)は不要
        moreModal.addEventListener('click', (e) => {
          const dialog = moreModal.querySelector('.modal-dialog');
          const t = e.target;
          if (!(dialog instanceof HTMLElement) || !(t instanceof HTMLElement)) return;
          if (!dialog.contains(t)) closeMoreModal();
        });
      }

      if (libraryBtn instanceof HTMLButtonElement) {
        libraryBtn.addEventListener('click', openLibraryModal);
        // Libraryを開いたら、その他シートは自動で閉じる
        libraryBtn.addEventListener('click', closeMoreModal);
      }
      if (libraryCloseBtn instanceof HTMLButtonElement) {
        libraryCloseBtn.addEventListener('click', closeLibraryModal);
      }
      if (libraryModal instanceof HTMLElement) {
        // captureフェーズで判定する: 削除/複製は一覧を再描画してクリックされたボタン自体を
        // DOMから外すため、bubbleフェーズで判定するとe.targetが既に切り離されていて
        // dialog.contains(t)が誤ってfalseになり、モーダルが意図せず閉じてしまう。
        libraryModal.addEventListener('click', (e) => {
          const dialog = libraryModal.querySelector('.modal-dialog');
          const t = e.target;
          if (!(dialog instanceof HTMLElement) || !(t instanceof HTMLElement)) return;
          if (!dialog.contains(t)) closeLibraryModal();
        }, { capture: true });
      }
      if (libraryFilterInput instanceof HTMLInputElement) {
        libraryFilterInput.addEventListener('input', renderLibraryList);
      }

      if (libraryExportBtn instanceof HTMLButtonElement) {
        libraryExportBtn.addEventListener('click', () => {
          const envelope = { version: 1, fingerings: loadLibrary() };
          const blob = new Blob([JSON.stringify(envelope, null, 2)], { type: 'application/json' });
          const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, '');
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = `fingering_library_${ymd}.json`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        });
      }

      if (libraryImportInput instanceof HTMLInputElement) {
        libraryImportInput.addEventListener('change', () => {
          const file = libraryImportInput.files && libraryImportInput.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = () => {
            try {
              const parsed = JSON.parse(String(reader.result || ''));
              const incoming = Array.isArray(parsed && parsed.fingerings) ? parsed.fingerings : null;
              if (!incoming) throw new Error('invalid envelope');
              const existing = loadLibrary();
              const seen = new Set(existing.map((e) => `${e.note || ''}|${e.trillNote || ''}|${canonicalKeysString(e.keys)}`));
              let imported = 0, skipped = 0;
              incoming.forEach((item) => {
                if (!item || typeof item !== 'object') return;
                const sig = `${item.note || ''}|${item.trillNote || ''}|${canonicalKeysString(item.keys)}`;
                if (seen.has(sig)) { skipped++; return; }
                existing.push({
                  id: randomId(),
                  version: item.version || 1,
                  note: item.note || '',
                  trillNote: item.trillNote || null,
                  keys: { ...(item.keys || {}) },
                  label: item.label || '',
                  createdAt: item.createdAt || new Date().toISOString(),
                });
                seen.add(sig);
                imported++;
              });
              saveLibrary(existing);
              renderLibraryList();
              showToast(`${imported}件インポートしました(重複${skipped}件はスキップ)`);
            } catch (e) {
              showToast('インポートに失敗しました。JSONファイルの形式を確認してください。', { error: true });
            } finally {
              libraryImportInput.value = '';
            }
          };
          reader.readAsText(file);
        });
      }

      // Memoボタンでメモ用モーダルを開く
      if (memoBtn instanceof HTMLButtonElement) {
        memoBtn.disabled = false;
        memoBtn.textContent = 'Memo';
        memoBtn.setAttribute('aria-label', 'メモや注釈を入力');
        memoBtn.addEventListener('click', openTextModal);
      }

      // Text Input モーダル制御
      if (textCloseBtn instanceof HTMLButtonElement) {
        textCloseBtn.addEventListener('click', () => {
          if (textArea instanceof HTMLTextAreaElement) {
            saveTextValue(textArea.value || '');
          }
          closeTextModal();
        });
      }
      // モーダル外クリックで閉じる（内側では閉じない）
      if (textModal instanceof HTMLElement) {
        textModal.addEventListener('click', (e) => {
          const dialog = textModal.querySelector('.modal-dialog');
          const t = e.target;
          if (!(dialog instanceof HTMLElement) || !(t instanceof HTMLElement)) return;
          const clickedInside = dialog.contains(t);
          if (!clickedInside) {
            // 外側クリック: 保存して閉じる
            if (textArea instanceof HTMLTextAreaElement) {
              saveTextValue(textArea.value || '');
            }
            closeTextModal();
          }
        });
      }
      if (textArea instanceof HTMLTextAreaElement) {
        textArea.addEventListener('input', () => {
          saveTextValue(textArea.value || '');
        });
      }
      if (textDeleteBtn instanceof HTMLButtonElement) {
        textDeleteBtn.addEventListener('click', () => {
          // テキストエリアをクリアし、LocalStorageからも削除
          if (textArea instanceof HTMLTextAreaElement) {
            textArea.value = '';
          }
          state.label = '';
          saveCurrentDraft();
          if (textArea instanceof HTMLTextAreaElement) {
            textArea.focus();
          }
        });
      }
    })
    .catch((err) => {
      console.error('SVG load failed', err);
      wrapper.textContent = 'SVGの読み込みに失敗しました。';
    });
})();

// SVG -> PNG Blob 変換
// 指定幅に収まるまでフォントサイズを縮める(最小値まで)
function fitFontSize(ctx, text, maxWidth, startPx, minPx, fontFamily) {
  let px = startPx;
  while (px > minPx) {
    ctx.font = `${px}px ${fontFamily}`;
    if (ctx.measureText(text).width <= maxWidth) break;
    px -= 1;
  }
  return px;
}

// SVG -> PNG Blob 変換。viewBox基準の固定解像度で書き出すため、画面サイズに依存しない。
// options.scale: viewBoxに対する倍率(既定2.5倍。2倍以上を維持し画質を確保する)
// options.footerLines: 画像下部に焼き込むテキスト行(1行目=音名、2行目=シェアURL 等)
function exportSvgToPngBlob(currentSvg, options = {}) {
  const scale = options.scale || 2.5;
  const footerLines = options.footerLines || [];
  return new Promise((resolve, reject) => {
    try {
      // SVGをクローンして、エクスポートに都合のよい寸法属性を付与
      const cloned = currentSvg.cloneNode(true);
      let vb = cloned.viewBox && cloned.viewBox.baseVal;
      if (!vb || !vb.width || !vb.height) {
        // viewBoxが無ければ現在のレイアウト寸法で代用
        const rect = currentSvg.getBoundingClientRect();
        const w = Math.max(1, Math.round(rect.width));
        const h = Math.max(1, Math.round(rect.height));
        cloned.setAttribute('viewBox', `0 0 ${w} ${h}`);
        vb = { width: w, height: h };
      }
      const imgW = Math.max(1, Math.round(vb.width * scale));
      const imgH = Math.max(1, Math.round(vb.height * scale));
      cloned.setAttribute('width', String(imgW));
      cloned.setAttribute('height', String(imgH));
      cloned.setAttribute('preserveAspectRatio', 'xMidYMid meet');

      const serializer = new XMLSerializer();
      let svgString = serializer.serializeToString(cloned);
      if (!/^<\?xml/.test(svgString)) {
        svgString = '<?xml version="1.0" encoding="UTF-8"?>\n' + svgString;
      }
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);

      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const fontFamily = "'Noto Sans JP', system-ui, sans-serif";
        const measureCtx = canvas.getContext('2d');
        if (!measureCtx) { URL.revokeObjectURL(url); reject(new Error('no ctx')); return; }
        const maxTextWidth = imgW - Math.round(24 * scale);

        // 1行目(音名)は大きめ、2行目以降(シェアURL等)は小さめの基準サイズで、
        // 幅に収まらない場合は自動的に縮小する。
        const lineSpecs = footerLines.map((line, i) => {
          const isFirst = i === 0;
          const startPx = Math.round((isFirst ? 22 : 13) * scale);
          const minPx = Math.round((isFirst ? 14 : 8) * scale);
          const px = fitFontSize(measureCtx, line, maxTextWidth, startPx, minPx, fontFamily);
          return { text: line, px };
        });

        const footerPaddingV = Math.round(10 * scale);
        const lineGap = Math.round(6 * scale);
        const footerH = lineSpecs.length
          ? Math.round(lineSpecs.reduce((sum, s) => sum + s.px * 1.3, 0) + lineGap * Math.max(0, lineSpecs.length - 1) + footerPaddingV * 2)
          : 0;

        canvas.width = imgW;
        canvas.height = imgH + footerH;
        const ctx = canvas.getContext('2d');
        if (!ctx) { URL.revokeObjectURL(url); reject(new Error('no ctx2')); return; }
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, imgW, imgH);

        if (lineSpecs.length) {
          ctx.fillStyle = '#111';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          let y = imgH + footerPaddingV;
          lineSpecs.forEach((s) => {
            ctx.font = `${s.px}px ${fontFamily}`;
            y += (s.px * 1.3) / 2;
            ctx.fillText(s.text, canvas.width / 2, y);
            y += (s.px * 1.3) / 2 + lineGap;
          });
        }

        URL.revokeObjectURL(url);
        canvas.toBlob((blob) => {
          if (!blob) { reject(new Error('no blob')); return; }
          resolve(blob);
        }, 'image/png');
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('img error')); };
      img.src = url;
    } catch (err) {
      reject(err);
    }
  });
}

// 文字列の音名を簡易パース（例: C4, F#3, Eb3, G♭2）
function parseNoteText(s) {
  if (!s) return null;
  const m = s.trim().match(/^([A-Ga-g])([#♯b♭]?)(\d)$/);
  if (!m) return null;
  const letter = m[1].toUpperCase();
  const accRaw = m[2] || '';
  const octave = parseInt(m[3], 10);
  const accidental = accRaw === '♯' ? '#' : accRaw === '♭' ? 'b' : accRaw;
  const letterIndexMap = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };
  const diatonicIndex = octave * 7 + letterIndexMap[letter];
  const refDiatonic = (3 * 7) + letterIndexMap['D']; // D3 を基準
  const step = diatonicIndex - refDiatonic;
  return { letter, accidental, octave, step };
}

// 文字の音名を半音インデックス(0=C)へ（シャープ優先）
function noteTextToIndex(letter, accidental) {
  const baseIndex = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[letter];
  if (baseIndex == null) return null;
  if (accidental === '#') return (baseIndex + 1) % 12;
  if (accidental === 'b') return (baseIndex + 11) % 12;
  return baseIndex;
}

// 音名文字列(例:"C#4")をパースし、オクターブ/音名セレクトへ反映する。
// rebuildFn はオクターブ変更時のセレクト内容再構築関数(rebuildNoteOptions/rebuildTrillNoteOptions)。
// 反映できた場合はtrueを返す。
function applyNoteToSelects(noteText, octaveSelectEl, noteSelectEl, rebuildFn) {
  if (!noteText || !(octaveSelectEl instanceof HTMLSelectElement) || !(noteSelectEl instanceof HTMLSelectElement)) {
    return false;
  }
  const parsed = parseNoteText(noteText);
  if (!parsed) return false;
  octaveSelectEl.value = String(parsed.octave);
  if (typeof rebuildFn === 'function') rebuildFn(parsed.octave);
  const idx = noteTextToIndex(parsed.letter, parsed.accidental);
  if (idx != null) noteSelectEl.value = String(idx);
  return true;
}

// 半音インデックスとオクターブから文字列（例: C#4）
function indexAndOctaveToText(index, octave) {
  const map = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  const name = map[((index % 12) + 12) % 12];
  return name + String(octave);
}

// SVG左下に五線と音符を重ね描画（非破壊／クリック非阻害）
function updateScoreSvg(svg) {
  const octaveEl = document.getElementById('octave-select');
  const noteEl = document.getElementById('note-select');
  const trillEnabledEl = document.getElementById('trill-enabled');
  const trillOctEl = document.getElementById('trill-octave-select');
  const trillNoteEl = document.getElementById('trill-note-select');

  let g = svg.querySelector('#score-overlay');
  if (!g) {
    g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('id', 'score-overlay');
    // 音符に対するクリックを下層へ通さない
    g.setAttribute('style', 'pointer-events:auto');
    g.addEventListener('click', (e) => { e.stopPropagation(); e.preventDefault(); }, { capture: true });
    svg.appendChild(g);
  }
  while (g.firstChild) g.removeChild(g.firstChild);

  // 楽譜は常に表示。選択が無ければ C3 に。
  let octave = 3;
  let index = 0; // 0=C
  if (octaveEl instanceof HTMLSelectElement) {
    const n = parseInt(octaveEl.value, 10);
    if (Number.isFinite(n)) octave = n;
  }
  if (noteEl instanceof HTMLSelectElement) {
    const n = parseInt(noteEl.value, 10);
    if (Number.isFinite(n)) index = n;
  }

  // 表示用データの算出（#優先／b優先の両方を用意）
  const sharpPref = [
    { l: 'C', a: '' },  // 0
    { l: 'C', a: '#' }, // 1
    { l: 'D', a: '' },  // 2
    { l: 'D', a: '#' }, // 3
    { l: 'E', a: '' },  // 4
    { l: 'F', a: '' },  // 5
    { l: 'F', a: '#' }, // 6
    { l: 'G', a: '' },  // 7
    { l: 'G', a: '#' }, // 8
    { l: 'A', a: '' },  // 9
    { l: 'A', a: '#' }, // 10
    { l: 'B', a: '' }   // 11
  ];
  const flatPref = [
    { l: 'C', a: '' },  // 0
    { l: 'D', a: 'b' }, // 1 = Db
    { l: 'D', a: '' },  // 2
    { l: 'E', a: 'b' }, // 3 = Eb
    { l: 'E', a: '' },  // 4
    { l: 'F', a: '' },  // 5
    { l: 'G', a: 'b' }, // 6 = Gb
    { l: 'G', a: '' },  // 7
    { l: 'A', a: 'b' }, // 8 = Ab
    { l: 'A', a: '' },  // 9
    { l: 'B', a: 'b' }, // 10 = Bb
    { l: 'B', a: '' }   // 11
  ];

  function calcStepFromD3(letter) {
    const letterIndexMap = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };
    const diatonicIndex = octave * 7 + letterIndexMap[letter];
    const refDiatonic = (3 * 7) + letterIndexMap['D']; // D3 を基準
    return diatonicIndex - refDiatonic;
  }

  const midi = (octave + 1) * 12 + (index % 12); // C4=60
  const useTenor = midi >= 61; // C#4(61)以上はテナー

  const dims = getSvgDimensions(svg);
  const svgW = dims.width, svgH = dims.height;
  const padLeft = 16, padBottom = 16;
  const staffWidth = Math.min(260, Math.max(180, svgW * 0.35));
  const gap = 16; // 線間
  const centerY = svgH - padBottom - (gap * 2) - 8; // 中央線（D3基準）
  const left = padLeft;

  // スケールをかけて被りを軽減（約50%）し、左下付近を基準点にして縮小
  const SCORE_SCALE = 0.5;
  const anchorX = left;
  const anchorY = svgH - padBottom;
  const transformStr = `translate(${anchorX},${anchorY}) scale(${SCORE_SCALE}) translate(${-anchorX},${-anchorY}) translate(0,-48)`;
  g.setAttribute('transform', transformStr);

  // 五線 5本
  for (let i = -4; i <= 4; i += 2) {
    const y = centerY - (i * (gap / 2));
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', String(left));
    line.setAttribute('x2', String(left + staffWidth));
    line.setAttribute('y1', String(y));
    line.setAttribute('y2', String(y));
    line.setAttribute('stroke', '#333');
    line.setAttribute('stroke-width', '1.5');
    g.appendChild(line);
  }

  // ヘ音記号 or テナー（C）記号（位置・サイズ調整、ヘ音記号の点を追加）
  {
    const clef = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    const clefX = left + 8;
    const clefYBase = centerY - gap + 30; // 3倍サイズ基準
    // ヘ音記号のみ 0.5線間 + 6px だけ下げる（基準線は維持）
    const clefY = useTenor ? clefYBase : (clefYBase + (gap / 2) + 6);
    clef.setAttribute('x', String(clefX));
    clef.setAttribute('y', String(clefY));
    clef.setAttribute('font-family', 'Noto Music, Segoe UI Symbol, Apple Symbols, serif');
    clef.setAttribute('font-size', '90');
    clef.setAttribute('fill', '#111');
    // 𝄢 (F clef), 𝄡 (C clef)
    clef.textContent = useTenor ? '𝄡' : '𝄢';
    g.appendChild(clef);

    // 要望によりヘ音記号の2点は描画しない
  }

  // 音符
  {
    const baseX = left + Math.floor(staffWidth * 0.55);
    const idx = index % 12;
    const isChromatic = [1,3,6,8,10].includes(idx);
    const trillOn = (trillEnabledEl instanceof HTMLInputElement) ? !!trillEnabledEl.checked : false;

    const variants = isChromatic
      ? (trillOn ? [sharpPref[idx]] : [sharpPref[idx], flatPref[idx]])
      : [sharpPref[idx]]; // 自然音は1つのみ

    variants.forEach((v, i) => {
      const stepFromD3 = calcStepFromD3(v.l);
      // テナー記号（C記号が第4線）では C4 を第4線に置くため、
      // D3基準の+6（C4）を+2（第4線）へ合わせるオフセット -4 を適用
      const displayStep = useTenor ? (stepFromD3 - 4) : stepFromD3;
      // 半音時: 2つの加線が中央で12px空くように、中心間距離を(2*ledgerHalf + 12)に設定
      const ledgerHalf = 18;
      const chromaticGap = 12; // 加線の中央の空き幅（px）
      const chromaticOffset = ledgerHalf + chromaticGap / 2; // = 24px
      const showTwo = isChromatic && !trillOn;
      const x = baseX + (showTwo ? (i === 0 ? -chromaticOffset : chromaticOffset) : 0);
      const xBaseShifted = x + 20; // 現状の右シフト
      // Trill時は元の音符をさらに24px左へ移動
      const xNote = xBaseShifted + (trillOn ? -24 : 0);
      const y = centerY - (displayStep * (gap / 2));

      // 加線（先に描画して、後で描く音符が上に重なる）
      if (Math.abs(displayStep) > 4) {
        const dir = displayStep > 0 ? 1 : -1;
        for (let s = dir * 6; Math.abs(s) <= Math.abs(displayStep); s += dir * 2) {
          const ly = centerY - (s * (gap / 2));
          const l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
          l.setAttribute('x1', String(xNote - ledgerHalf));
          l.setAttribute('x2', String(xNote + ledgerHalf));
          l.setAttribute('y1', String(ly));
          l.setAttribute('y2', String(ly));
          l.setAttribute('stroke', '#333');
          l.setAttribute('stroke-width', '1.5');
          g.appendChild(l);
        }
      }

      if (v.a) {
        const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        // どちらもXを3px左へ、サイズを20に。#のみYを+2px下げる。
        const ax = xNote - 28; // 音符基準の左側に配置（相対位置は維持）
        const ay = y + 5 + (v.a === '#' ? 2 : 0);
        t.setAttribute('x', String(ax));
        t.setAttribute('y', String(ay));
        t.setAttribute('font-family', 'Georgia, serif');
        t.setAttribute('font-size', '20');
        t.setAttribute('fill', '#111');
        t.textContent = v.a === '#' ? '♯' : '♭';
        g.appendChild(t);
      }

      const ell = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
      ell.setAttribute('cx', String(xNote));
      ell.setAttribute('cy', String(y));
      ell.setAttribute('rx', '10');
      ell.setAttribute('ry', '8');
      ell.setAttribute('fill', '#111');
      ell.setAttribute('transform', `rotate(-15 ${xNote} ${y})`);
      g.appendChild(ell);

      // 加線は上で先に描画済み（音符は常に加線の上）
    });
  }

  // Trill音符（チェック時のみ、右側に追加表示）
  if (trillEnabledEl instanceof HTMLInputElement && trillEnabledEl.checked &&
      trillOctEl instanceof HTMLSelectElement && trillNoteEl instanceof HTMLSelectElement) {
    const tOct = parseInt(trillOctEl.value, 10);
    const tIdx = parseInt(trillNoteEl.value, 10) % 12;
    const name = sharpPref[tIdx];
    const letter = name.l;
    const acc = name.a; // '#', 'b', or ''（sharp優先）
    // トリル音用の段階計算はトリル側オクターブで行う
    const letterIndexMap = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };
    const diatonicIndex = tOct * 7 + letterIndexMap[letter];
    const refDiatonic = (3 * 7) + letterIndexMap['D']; // D3 基準
    const stepFromD3 = diatonicIndex - refDiatonic;
    const displayStep = useTenor ? (stepFromD3 - 4) : stepFromD3;

    // Trillも本体と同じX基準で配置
    const baseXForTrill = left + Math.floor(staffWidth * 0.55);
    const x = baseXForTrill; // 本体と同じ基準
    const xNote = x + 38; // 本体の+20pxに加えてTrillは+18px右へ（さらに+6px）
    const y = centerY - (displayStep * (gap / 2));

    // 加線（先に描画）
    if (Math.abs(displayStep) > 4) {
      const dir = displayStep > 0 ? 1 : -1;
      for (let s = dir * 6; Math.abs(s) <= Math.abs(displayStep); s += dir * 2) {
        const ly = centerY - (s * (gap / 2));
        const l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        l.setAttribute('x1', String(xNote - 18));
        l.setAttribute('x2', String(xNote + 18));
        l.setAttribute('y1', String(ly));
        l.setAttribute('y2', String(ly));
        l.setAttribute('stroke', '#333');
        l.setAttribute('stroke-width', '1.5');
        g.appendChild(l);
      }
    }

    // 臨時記号（位置調整は本体と同様のルール）
    if (acc) {
      const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      const ax = xNote - 28; // 本体と同様に音符基準の左側へ
      const ay = y + 5 + (acc === '#' ? 2 : 0);
      t.setAttribute('x', String(ax));
      t.setAttribute('y', String(ay));
      t.setAttribute('font-family', 'Georgia, serif');
      t.setAttribute('font-size', '20');
      t.setAttribute('fill', '#111');
      t.textContent = acc === '#' ? '♯' : '♭';
      g.appendChild(t);
    }

    // 音符
    const ell = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
    ell.setAttribute('cx', String(xNote));
    ell.setAttribute('cy', String(y));
    ell.setAttribute('rx', '10');
    ell.setAttribute('ry', '8');
    ell.setAttribute('fill', '#111');
    ell.setAttribute('transform', `rotate(-15 ${xNote} ${y})`);
    g.appendChild(ell);
  }

  // 凡例（左側・楽譜の上に配置。クリックは無効＝下のキーも変化させない）
  {
    let lg = svg.querySelector('#legend-overlay');
    if (!lg) {
      lg = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      lg.setAttribute('id', 'legend-overlay');
      // 凡例領域でイベントを消費して下層へ伝播させない
      lg.setAttribute('style', 'pointer-events:auto');
      lg.addEventListener('click', (e) => { e.stopPropagation(); e.preventDefault(); }, { capture: true });
      svg.appendChild(lg);
    }
    while (lg.firstChild) lg.removeChild(lg.firstChild);

    const boxPadX = 6, boxPadY = 6;
    const lineH = 12;
    const sw = 10; // 色見本サイズ（直径）
    const gapX = 6; // 見本と文字の間
    const entries = [
      { label: 'Press/Cover', color: '#111' },
      { label: 'Trill', color: 'red' },
      { label: 'HalfHole', color: 'blue' },
    ];
    // フォントサイズ（小さめ指定）
    const legendFontSize = 10;
    // テキスト幅を実測して、はみ出さない幅を算出
    let maxTextW = 0;
    entries.forEach((e) => {
      const mt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      mt.setAttribute('x', '0');
      mt.setAttribute('y', '0');
      mt.setAttribute('font-family', 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif');
      mt.setAttribute('font-size', String(legendFontSize));
      mt.setAttribute('style', 'pointer-events:none; visibility:hidden');
      mt.textContent = e.label;
      lg.appendChild(mt);
      try {
        const w = mt.getBBox().width;
        if (w > maxTextW) maxTextW = w;
      } catch {}
      mt.remove();
    });
    const contentW = Math.ceil(sw + gapX + maxTextW);
    const contentH = entries.length * lineH;
    const boxW = Math.ceil(contentW + boxPadX * 2); // 文字がはみ出ない幅
    const boxH = contentH + boxPadY * 2;
    const margin = 12;
    // 位置: 指定のパス（左側ブロックの上端）に上端を揃える。
    // 万一見つからない場合は上端マージン位置にフォールバック。
    const boxX = Math.max(4, Math.min(svgW - margin - boxW, left));
    let boxY = Math.max(4, margin);
    try {
      const anchor = svg.querySelector('#bb');
      if (anchor) {
        const bb = anchor.getBBox();
        if (bb && Number.isFinite(bb.y)) {
          boxY = Math.max(4, bb.y);
        }
      }
    } catch {}

    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bg.setAttribute('x', String(boxX));
    bg.setAttribute('y', String(boxY));
    bg.setAttribute('width', String(boxW));
    bg.setAttribute('height', String(boxH));
    bg.setAttribute('rx', '6');
    bg.setAttribute('fill', 'rgba(255,255,255,0.9)');
    bg.setAttribute('stroke', '#ccc');
    bg.setAttribute('stroke-width', '1');
    // 背景だけクリックを受け止める（下層へ通さない）
    bg.setAttribute('style', 'pointer-events:auto');
    lg.appendChild(bg);

    entries.forEach((e, i) => {
      const y = boxY + boxPadY + i * lineH + 2;
      const swatch = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      const cx = boxX + boxPadX + sw / 2;
      const cy = y + sw / 2;
      swatch.setAttribute('cx', String(cx));
      swatch.setAttribute('cy', String(cy));
      swatch.setAttribute('r', String(sw / 2));
      // 円の塗りつぶし
      swatch.setAttribute('fill', e.color);
      swatch.setAttribute('stroke', 'none');
    // 凡例内のスウォッチやテキストはクリック無効
      swatch.setAttribute('style', 'pointer-events:none');
      lg.appendChild(swatch);

      const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      t.setAttribute('x', String(boxX + boxPadX + sw + gapX));
      t.setAttribute('y', String(y + sw - 2));
      t.setAttribute('font-family', 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif');
      t.setAttribute('font-size', String(legendFontSize));
      t.setAttribute('fill', '#222');
      t.textContent = e.label;
      t.setAttribute('style', 'pointer-events:none');
      lg.appendChild(t);
    });
  }
}

function getSvgDimensions(svg) {
  const vb = svg.viewBox && svg.viewBox.baseVal;
  if (vb && vb.width && vb.height) return { width: vb.width, height: vb.height };
  const wAttr = svg.getAttribute('width');
  const hAttr = svg.getAttribute('height');
  const w = wAttr ? parseFloat(wAttr) : NaN;
  const h = hAttr ? parseFloat(hAttr) : NaN;
  if (Number.isFinite(w) && Number.isFinite(h)) return { width: w, height: h };
  try {
    const bb = svg.getBBox();
    return { width: bb.width, height: bb.height };
  } catch {
    return { width: 600, height: 800 };
  }
}
