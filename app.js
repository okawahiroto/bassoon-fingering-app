(function () {
  const circle = document.getElementById('circle');
  if (circle) {
    const fills = ['black', 'red', 'white'];
    let index = -1;
    circle.addEventListener('click', () => {
      index = (index + 1) % fills.length;
      circle.setAttribute('fill', fills[index]);
    });
  }
})();

(function () {
  const wrapper = document.getElementById('bassoon-wrapper');
  const downloadBtn = document.getElementById('download-btn');
  const textBtn = document.getElementById('text-btn');
  const textModal = document.getElementById('text-modal');
  const textArea = document.getElementById('text-area');
  const inlineTextArea = document.getElementById('inline-text-area');
  const textCloseBtn = document.getElementById('text-close-btn');
  const textDeleteBtn = document.getElementById('text-delete-btn');
  if (!wrapper) return;
  const src = wrapper.getAttribute('data-src');
  if (!src) return;

  const colors = ['black', 'red', 'white'];
  const TEXT_KEY = 'fingering_text';

  function cycleElementColor(el) {
    const raw = el.getAttribute('data-color-index');
    let idx = raw ? parseInt(raw, 10) : -1;
    idx = (idx + 1) % colors.length;
    // 図形の内側がクリック対象なので、常にfillを変更
    el.setAttribute('fill', colors[idx]);
    el.setAttribute('data-color-index', String(idx));
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

  fetch(src)
    .then((res) => res.text())
    .then((svgText) => {
      wrapper.innerHTML = svgText;
      const svg = wrapper.querySelector('svg');
      if (!svg) return;
      svg.id = 'bassoonSvg';

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

      // ダウンロードボタンを有効化
      if (downloadBtn instanceof HTMLButtonElement) {
        downloadBtn.disabled = false;
        downloadBtn.addEventListener('click', () => {
          const currentSvg = document.getElementById('bassoonSvg');
          if (!currentSvg) return;

          // 表示サイズに合わせてPNGを書き出す
          const rect = currentSvg.getBoundingClientRect();
          const width = Math.max(1, Math.round(rect.width));
          const height = Math.max(1, Math.round(rect.height));

          const serializer = new XMLSerializer();
          let svgString = serializer.serializeToString(currentSvg);

          // XML宣言が無い場合の互換性確保（任意）
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
            if (!ctx) return;
            // 背景を白で塗りつぶしてから描画（透過防止）
            ctx.clearRect(0, 0, width, height);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);
            URL.revokeObjectURL(url);

            canvas.toBlob((blob) => {
              if (!blob) return;
              const a = document.createElement('a');
              a.href = URL.createObjectURL(blob);
              a.download = 'fingering.png';
              document.body.appendChild(a);
              a.click();
              a.remove();
              setTimeout(() => URL.revokeObjectURL(a.href), 1000);

              // メモのテキストも同時にダウンロード
              const notes = getSavedText();
              const tb = new Blob([notes], { type: 'text/plain;charset=utf-8' });
              const ta = document.createElement('a');
              ta.href = URL.createObjectURL(tb);
              ta.download = 'fingering-notes.txt';
              document.body.appendChild(ta);
              ta.click();
              ta.remove();
              setTimeout(() => URL.revokeObjectURL(ta.href), 1000);
            }, 'image/png');
          };
          img.onerror = () => {
            // 万一PNG化に失敗したら生のSVGをダウンロード
            URL.revokeObjectURL(url);
            const a = document.createElement('a');
            a.href = URL.createObjectURL(svgBlob);
            a.download = 'fingering.svg';
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(a.href), 1000);

            // 失敗時もテキストはダウンロード
            const notes = getSavedText();
            const tb = new Blob([notes], { type: 'text/plain;charset=utf-8' });
            const ta = document.createElement('a');
            ta.href = URL.createObjectURL(tb);
            ta.download = 'fingering-notes.txt';
            document.body.appendChild(ta);
            ta.click();
            ta.remove();
            setTimeout(() => URL.revokeObjectURL(ta.href), 1000);
          };
          img.src = url;
        });
      }

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
