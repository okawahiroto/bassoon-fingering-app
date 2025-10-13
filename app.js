(function () {
  const circle = document.getElementById('circle');
  if (circle) {
    const colorSeq = ['black', 'red', 'blue'];
    circle.addEventListener('click', () => {
      const raw = circle.getAttribute('data-color-index');
      if (raw == null) {
        // none -> black
        circle.setAttribute('fill', colorSeq[0]);
        circle.setAttribute('data-color-index', '0');
      } else {
        let idx = parseInt(raw, 10);
        if (Number.isNaN(idx)) idx = -1;
        if (idx >= 0 && idx < colorSeq.length - 1) {
          idx += 1;
          circle.setAttribute('fill', colorSeq[idx]);
          circle.setAttribute('data-color-index', String(idx));
        } else {
          // last -> none
          circle.setAttribute('fill', 'transparent');
          circle.removeAttribute('data-color-index');
        }
      }
    });
  }
})();

(function () {
  const wrapper = document.getElementById('bassoon-wrapper');
  const downloadBtn = document.getElementById('download-btn');
  const shareBtn = document.getElementById('share-btn');
  const memoBtn = document.getElementById('memo-btn');
  const textBtn = document.getElementById('text-btn');
  const textModal = document.getElementById('text-modal');
  const textArea = document.getElementById('text-area');
  const inlineTextArea = document.getElementById('inline-text-area');
  const textCloseBtn = document.getElementById('text-close-btn');
  const textDeleteBtn = document.getElementById('text-delete-btn');
  const octaveSelect = document.getElementById('octave-select');
  const noteSelect = document.getElementById('note-select');
  const trillEnabled = document.getElementById('trill-enabled');
  const trillOctaveSelect = document.getElementById('trill-octave-select');
  const trillNoteSelect = document.getElementById('trill-note-select');
  if (!wrapper) return;
  const src = wrapper.getAttribute('data-src');
  if (!src) return;

  const colors = ['black', 'red', 'blue'];
  const TEXT_KEY = 'fingering_text';
  const NOTE_KEY = 'fingering_note_text'; // 互換用（例: "C#4"）
  const NOTE_INDEX_KEY = 'fingering_note_index'; // 0-11
  const OCTAVE_KEY = 'fingering_note_octave'; // 1-5（C1..C5）

  function cycleElementColor(el) {
    const raw = el.getAttribute('data-color-index');
    if (raw == null) {
      // none -> first color (black)
      el.setAttribute('fill', colors[0]);
      el.setAttribute('data-color-index', '0');
      return;
    }
    let idx = parseInt(raw, 10);
    if (!Number.isFinite(idx)) idx = -1;
    if (idx >= 0 && idx < colors.length - 1) {
      idx += 1;
      el.setAttribute('fill', colors[idx]);
      el.setAttribute('data-color-index', String(idx));
    } else {
      // last color -> none (transparent to keep hit area)
      el.setAttribute('fill', 'transparent');
      el.removeAttribute('data-color-index');
    }
  }

  // --- テキストモーダルとLocalStorage ---
  function openTextModal() {
    if (!(textModal instanceof HTMLElement)) return;
    textModal.hidden = false;
    const saved = getSavedText();
    // 現在の音名 + オクターブを初期値として用意（Trill ON時はハイフンで連結）
    const formatNoteWithOct = (label, octNum) => {
      const parts = String(label || '').split('/')
        .map((s) => (s || '').trim())
        .filter(Boolean);
      return parts.map((p) => `${p}${octNum}`).join('/');
    };
    const buildInitialFromSelections = () => {
      let base = '';
      if (octaveSelect instanceof HTMLSelectElement && noteSelect instanceof HTMLSelectElement) {
        const oct = parseInt(octaveSelect.value, 10);
        const noteLabel = noteSelect.options[noteSelect.selectedIndex]?.textContent || '';
        base = formatNoteWithOct(noteLabel, isNaN(oct) ? '' : oct);
      }
      let trill = '';
      const trillOn = (trillEnabled instanceof HTMLInputElement) && !!trillEnabled.checked;
      if (
        trillOn &&
        trillOctaveSelect instanceof HTMLSelectElement &&
        trillNoteSelect instanceof HTMLSelectElement
      ) {
        const toct = parseInt(trillOctaveSelect.value, 10);
        const tlabel = trillNoteSelect.options[trillNoteSelect.selectedIndex]?.textContent || '';
        trill = formatNoteWithOct(tlabel, isNaN(toct) ? '' : toct);
      }
      const combined = trill ? `${base}-${trill}` : base;
      return { base, trill, combined, trillOn };
    };
    if (textArea instanceof HTMLTextAreaElement) {
      const { combined } = buildInitialFromSelections();
      const existing = (saved || '').trim();
      textArea.value = existing ? `${combined} ${existing}` : combined;
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
    try {
      localStorage.setItem(TEXT_KEY, val || '');
    } catch (e) {
      // ignore
    }
  }
  function syncAllTextAreas(val) {
    if (textArea instanceof HTMLTextAreaElement) {
      textArea.value = val;
    }
    if (inlineTextArea instanceof HTMLTextAreaElement) {
      inlineTextArea.value = val;
    }
  }
  function getSavedText() {
    try {
      return localStorage.getItem(TEXT_KEY) || '';
    } catch {
      return '';
    }
  }

  function getSavedNoteText() {
    try { return localStorage.getItem(NOTE_KEY) || ''; } catch { return ''; }
  }
  function setSavedNoteText(v) {
    try { localStorage.setItem(NOTE_KEY, v || ''); } catch {}
  }
  function getSavedNoteIndex() {
    try {
      const s = localStorage.getItem(NOTE_INDEX_KEY);
      const n = s == null ? NaN : parseInt(s, 10);
      return Number.isFinite(n) ? n : null;
    } catch { return null; }
  }
  function setSavedNoteIndex(n) {
    try { localStorage.setItem(NOTE_INDEX_KEY, String(n)); } catch {}
  }
  function getSavedOctave() {
    try {
      const s = localStorage.getItem(OCTAVE_KEY);
      const n = s == null ? NaN : parseInt(s, 10);
      return Number.isFinite(n) ? n : null;
    } catch { return null; }
  }
  function setSavedOctave(n) {
    try { localStorage.setItem(OCTAVE_KEY, String(n)); } catch {}
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

      // 初期表示で保存済みメモを適用
      // リフレッシュ時はメモをクリア（LocalStorageのメモを削除）
      try { localStorage.removeItem(TEXT_KEY); } catch {}
      const initialNotes = getSavedText();
      syncAllTextAreas(initialNotes);

      svg.addEventListener('click', (ev) => {
        const target = ev.target;
        if (!(target instanceof Element)) return;
        const shape = target.closest('path, rect, circle, ellipse, polygon, polyline');
        if (shape && svg.contains(shape)) {
          cycleElementColor(shape);
        }
      });

      // 楽譜（左下オーバーレイ）初期化とイベント
      // セレクトへの保存値の反映（旧バージョンのテキスト保存も考慮）
      if (octaveSelect instanceof HTMLSelectElement && noteSelect instanceof HTMLSelectElement) {
        // ノートセレクトの内容をオクターブに応じて再構築
        const rebuildNoteOptions = (oct) => {
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

        // 初期表示はHTMLの初期値をそのまま使用（LocalStorageからは復元しない）
        // オプション構築はオクターブに依存
        rebuildNoteOptions(parseInt(octaveSelect.value, 10));

        const onChange = () => {
          const oct = parseInt(octaveSelect.value, 10);
          rebuildNoteOptions(oct);
          const idx = parseInt(noteSelect.value, 10);
          setSavedNoteIndex(idx);
          setSavedOctave(oct);
          // 互換用の文字列も保存（シャープ優先表記）
          const txt = indexAndOctaveToText(idx, oct);
          setSavedNoteText(txt);
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
        // 初期状態は非活性のまま
        trillOctaveSelect.disabled = !trillEnabled.checked;
        trillNoteSelect.disabled = !trillEnabled.checked;
        // 初期オプション構築
        rebuildTrillNoteOptions(parseInt(trillOctaveSelect.value, 10) || 3);

        trillEnabled.addEventListener('change', () => {
          const enabled = !!trillEnabled.checked;
          trillOctaveSelect.disabled = !enabled;
          trillNoteSelect.disabled = !enabled;
          if (enabled) {
            rebuildTrillNoteOptions(parseInt(trillOctaveSelect.value, 10) || 3);
          }
          // トグル時にも即時再描画
          updateScoreSvg(svg);
        });
        trillOctaveSelect.addEventListener('change', () => {
          rebuildTrillNoteOptions(parseInt(trillOctaveSelect.value, 10) || 3);
          updateScoreSvg(svg);
        });
        trillNoteSelect.addEventListener('change', () => {
          updateScoreSvg(svg);
        });
      }
      // 初回描画
      updateScoreSvg(svg);

      // ダウンロードボタンを有効化
      if (downloadBtn instanceof HTMLButtonElement) {
        downloadBtn.disabled = false;
        downloadBtn.addEventListener('click', () => {
          const currentSvg = document.getElementById('bassoonSvg');
          if (!currentSvg) return;
          exportSvgToPngBlob(currentSvg)
            .then((blob) => {
              if (!blob) return;
              const a = document.createElement('a');
              a.href = URL.createObjectURL(blob);
              a.download = 'fingering.png';
              document.body.appendChild(a);
              a.click();
              a.remove();
              setTimeout(() => URL.revokeObjectURL(a.href), 1000);
              // 成功メッセージ（画像のみDL）
              try { alert('画像のみダウンロードしました'); } catch {}
            })
            .catch(() => {
              alert('画像の作成に失敗しました。もう一度お試しください。');
            });
        });
      }

      // Shareボタン
      if (shareBtn instanceof HTMLButtonElement) {
        shareBtn.disabled = false;
        shareBtn.addEventListener('click', async () => {
          const currentSvg = document.getElementById('bassoonSvg');
          if (!currentSvg) return;
          const notes = (getSavedText() || '').trim();
          const tag = '#BsnFingApp';
          const hasTag = new RegExp('(^|\\s)'+tag.replace('#','\\#')+'(\\s|$)').test(notes);
          const shareText = hasTag ? notes : (notes ? notes + '\n' + tag : tag);
          try {
            const blob = await exportSvgToPngBlob(currentSvg);
            if (!blob) throw new Error('png blob failed');
            const file = new File([blob], 'fingering.png', { type: 'image/png' });
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
            a.download = 'fingering.png';
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(a.href), 1000);
            alert('お使いの環境では画像付き共有に対応していません。画像をダウンロードしました。テキストはクリップボードにコピー済みです。');
          } catch (e) {
            alert('共有に失敗しました。ダウンロード機能をご利用ください。');
          }
        });
      }

      // Memoボタンでメモ用モーダルを開く
      if (memoBtn instanceof HTMLButtonElement) {
        memoBtn.disabled = false;
        memoBtn.textContent = 'Memo';
        memoBtn.setAttribute('aria-label', 'メモや注釈を入力');
        memoBtn.addEventListener('click', openTextModal);
      }

      // Share to X/Copy Image ボタンは廃止（Shareのみ使用）

      // Text Input モーダル制御
      if (textCloseBtn instanceof HTMLButtonElement) {
        textCloseBtn.addEventListener('click', () => {
          if (textArea instanceof HTMLTextAreaElement) {
            saveTextValue(textArea.value || '');
          } else if (inlineTextArea instanceof HTMLTextAreaElement) {
            saveTextValue(inlineTextArea.value || '');
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
            } else if (inlineTextArea instanceof HTMLTextAreaElement) {
              saveTextValue(inlineTextArea.value || '');
            }
            closeTextModal();
          }
        });
      }
      if (textArea instanceof HTMLTextAreaElement) {
        textArea.addEventListener('input', () => {
          const val = textArea.value || '';
          saveTextValue(val);
          if (inlineTextArea instanceof HTMLTextAreaElement) {
            inlineTextArea.value = val;
          }
        });
      }
      if (inlineTextArea instanceof HTMLTextAreaElement) {
        inlineTextArea.addEventListener('input', () => {
          const val = inlineTextArea.value || '';
          saveTextValue(val);
          if (textArea instanceof HTMLTextAreaElement) {
            textArea.value = val;
          }
        });
      }
      if (textDeleteBtn instanceof HTMLButtonElement) {
        textDeleteBtn.addEventListener('click', () => {
          // テキストエリアをクリアし、LocalStorageからも削除
          if (textArea instanceof HTMLTextAreaElement) {
            textArea.value = '';
          }
          if (inlineTextArea instanceof HTMLTextAreaElement) {
            inlineTextArea.value = '';
          }
          try {
            localStorage.removeItem(TEXT_KEY);
          } catch {}
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
function exportSvgToPngBlob(currentSvg) {
  return new Promise((resolve, reject) => {
    try {
      const rect = currentSvg.getBoundingClientRect();
      const width = Math.max(1, Math.round(rect.width));
      const height = Math.max(1, Math.round(rect.height));

      // SVGをクローンして、エクスポートに都合のよい寸法属性を付与
      const cloned = currentSvg.cloneNode(true);
      // viewBoxが無ければBBoxから生成（失敗時はレイアウト寸法で代用）
      if (!cloned.getAttribute('viewBox')) {
        try {
          const bb = currentSvg.getBBox();
          cloned.setAttribute('viewBox', `0 0 ${Math.max(1, Math.ceil(bb.width))} ${Math.max(1, Math.ceil(bb.height))}`);
        } catch {
          cloned.setAttribute('viewBox', `0 0 ${width} ${height}`);
        }
      }
      // 出力サイズを明示
      cloned.setAttribute('width', String(width));
      cloned.setAttribute('height', String(height));
      // 歪み防止のため既定の比率保持（中央）
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
        canvas.width = width;
        canvas.height = height;
        let ctx = canvas.getContext('2d');
        if (!ctx) { URL.revokeObjectURL(url); reject(new Error('no ctx')); return; }
        // 歪まないようアスペクト比を維持して描画（レターボックス）
        let destX = 0, destY = 0, destW = width, destH = height;
        const vb = cloned.viewBox && cloned.viewBox.baseVal;
        if (vb && vb.width && vb.height) {
          const sx = width / vb.width;
          const sy = height / vb.height;
          const scale = Math.min(sx, sy); // meet（全体を収める）
          destW = Math.round(vb.width * scale);
          destH = Math.round(vb.height * scale);
          destX = Math.floor((width - destW) / 2);
          destY = Math.floor((height - destH) / 2);
        }
        // 左右の余白をトリミング：出力キャンバス幅をコンテンツ幅に合わせ、左右のレターボックスを除去
        const outW = destW;
        const outH = height;
        if (canvas.width !== outW || canvas.height !== outH) {
          canvas.width = outW; canvas.height = outH;
          ctx = canvas.getContext('2d');
          if (!ctx) { URL.revokeObjectURL(url); reject(new Error('no ctx2')); return; }
        }
        ctx.clearRect(0, 0, outW, outH);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, outW, outH);
        // ソースの左右をクロップして描画（上下面の余白は保持）
        ctx.drawImage(img, destX, 0, destW, height, 0, 0, outW, outH);
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
// (iOS専用のDataURLフォールバック、およびUA判定は撤去し標準動作に戻しています)

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
    clef.textContent = useTenor ? '\uD834\uDD21' : '\uD834\uDD22';
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
      const anchor = svg.querySelector('path[d^="M144 262H196.857C203.011 262"]');
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
