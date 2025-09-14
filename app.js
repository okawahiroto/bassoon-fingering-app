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
  const textBtn = document.getElementById('text-btn');
  const textModal = document.getElementById('text-modal');
  const textArea = document.getElementById('text-area');
  const inlineTextArea = document.getElementById('inline-text-area');
  const textCloseBtn = document.getElementById('text-close-btn');
  const textDeleteBtn = document.getElementById('text-delete-btn');
  const noteInput = document.getElementById('note-input');
  const includeScoreCheckbox = document.getElementById('include-score');
  if (!wrapper) return;
  const src = wrapper.getAttribute('data-src');
  if (!src) return;

  const colors = ['black', 'red', 'blue'];
  const TEXT_KEY = 'fingering_text';
  const NOTE_KEY = 'fingering_note_text';
  const INCLUDE_SCORE_KEY = 'fingering_include_score';

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
    if (textArea instanceof HTMLTextAreaElement) {
      textArea.value = saved;
      setTimeout(() => textArea.focus(), 0);
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

  function getSavedNote() {
    try { return localStorage.getItem(NOTE_KEY) || ''; } catch { return ''; }
  }
  function setSavedNote(v) {
    try { localStorage.setItem(NOTE_KEY, v || ''); } catch {}
  }
  function getSavedIncludeScore() {
    try { return localStorage.getItem(INCLUDE_SCORE_KEY) !== '0'; } catch { return true; }
  }
  function setSavedIncludeScore(flag) {
    try { localStorage.setItem(INCLUDE_SCORE_KEY, flag ? '1' : '0'); } catch {}
  }

  fetch(src)
    .then((res) => res.text())
    .then((svgText) => {
      wrapper.innerHTML = svgText;
      const svg = wrapper.querySelector('svg');
      if (!svg) return;
      svg.id = 'bassoonSvg';

      // 純CSSレイアウトにより高さ調整（JSは不要）

      // 初期表示で保存済みメモを適用
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
      if (noteInput instanceof HTMLInputElement) {
        const savedNote = getSavedNote();
        if (savedNote) noteInput.value = savedNote;
        noteInput.addEventListener('input', () => {
          setSavedNote(noteInput.value || '');
          updateScoreSvg(svg);
        });
      }
      if (includeScoreCheckbox instanceof HTMLInputElement) {
        includeScoreCheckbox.checked = getSavedIncludeScore();
        includeScoreCheckbox.addEventListener('change', () => {
          setSavedIncludeScore(!!includeScoreCheckbox.checked);
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

      // Share to X/Copy Image ボタンは廃止（Shareのみ使用）

      // Text Imput モーダル制御
      if (textBtn instanceof HTMLButtonElement) {
        textBtn.addEventListener('click', openTextModal);
      }
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
      if (textModal instanceof HTMLElement) {
        // 背景クリックで閉じる
        textModal.addEventListener('click', (e) => {
          const t = e.target;
          if (t instanceof HTMLElement && t.dataset.close === 'true') {
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

      const serializer = new XMLSerializer();
      let svgString = serializer.serializeToString(currentSvg);
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
        const ctx = canvas.getContext('2d');
        if (!ctx) { URL.revokeObjectURL(url); reject(new Error('no ctx')); return; }
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        // ヘッダー合成は行わず、SVG内の見た目そのままを書き出す
        ctx.drawImage(img, 0, 0, width, height);
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

// SVG左下に五線と音符を重ね描画（非破壊／クリック非阻害）
function updateScoreSvg(svg) {
  const noteTextEl = document.getElementById('note-input');
  const includeScoreEl = document.getElementById('include-score');
  const noteText = noteTextEl instanceof HTMLInputElement ? (noteTextEl.value || '').trim() : '';
  const includeScore = includeScoreEl instanceof HTMLInputElement ? !!includeScoreEl.checked : false;

  let g = svg.querySelector('#score-overlay');
  if (!g) {
    g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('id', 'score-overlay');
    g.setAttribute('style', 'pointer-events:none');
    svg.appendChild(g);
  }
  while (g.firstChild) g.removeChild(g.firstChild);

  if (!includeScore) return; // 非表示なら何も描かない

  const parsed = parseNoteText(noteText);

  const dims = getSvgDimensions(svg);
  const svgW = dims.width, svgH = dims.height;
  const padLeft = 16, padBottom = 16;
  const staffWidth = Math.min(260, Math.max(180, svgW * 0.35));
  const gap = 16; // 線間
  const centerY = svgH - padBottom - (gap * 2) - 8; // D3基準
  const left = padLeft;

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

  // 音符（有効な音名がある場合のみ）
  if (parsed) {
    const x = left + Math.floor(staffWidth / 2);
    const y = centerY - (parsed.step * (gap / 2));

    if (parsed.accidental) {
      const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      t.setAttribute('x', String(x - 22));
      t.setAttribute('y', String(y + 5));
      t.setAttribute('font-family', 'Georgia, serif');
      t.setAttribute('font-size', '18');
      t.setAttribute('fill', '#111');
      t.textContent = parsed.accidental === '#' ? '♯' : '♭';
      g.appendChild(t);
    }

    const ell = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
    ell.setAttribute('cx', String(x));
    ell.setAttribute('cy', String(y));
    ell.setAttribute('rx', '8');
    ell.setAttribute('ry', '6');
    ell.setAttribute('fill', '#111');
    ell.setAttribute('transform', `rotate(-15 ${x} ${y})`);
    g.appendChild(ell);

    // 加線
    if (Math.abs(parsed.step) > 4) {
      const dir = parsed.step > 0 ? 1 : -1;
      for (let s = dir * 6; Math.abs(s) <= Math.abs(parsed.step); s += dir * 2) {
        const ly = centerY - (s * (gap / 2));
        const l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        l.setAttribute('x1', String(x - 16));
        l.setAttribute('x2', String(x + 16));
        l.setAttribute('y1', String(ly));
        l.setAttribute('y2', String(ly));
        l.setAttribute('stroke', '#333');
        l.setAttribute('stroke-width', '1.5');
        g.appendChild(l);
      }
    }
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
