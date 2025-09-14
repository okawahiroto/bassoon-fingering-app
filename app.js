// 画面高に合わせてメインコンテンツを等比縮小
function fitContentToViewport() {
  const root = document.getElementById('page-content');
  if (!(root instanceof HTMLElement)) return;
  // テキスト入力中はスケール変更しない（ソフトキーボード対策）
  const ae = document.activeElement;
  if (ae && (ae.tagName === 'TEXTAREA' || (ae.tagName === 'INPUT'))) return;

  // いったんリセットして実寸を測る
  root.style.transform = 'none';

  const vh = (window.visualViewport && window.visualViewport.height) || window.innerHeight;
  const margin = 12; // 上下の余白
  const contentRect = root.getBoundingClientRect();
  const scale = Math.min(1, (vh - margin) / Math.max(contentRect.height, 1));
  root.style.transform = `scale(${scale})`;
}

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
  if (!wrapper) return;
  const src = wrapper.getAttribute('data-src');
  if (!src) return;

  const colors = ['black', 'red', 'blue'];
  const TEXT_KEY = 'fingering_text';

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

  fetch(src)
    .then((res) => res.text())
    .then((svgText) => {
      wrapper.innerHTML = svgText;
      const svg = wrapper.querySelector('svg');
      if (!svg) return;
      svg.id = 'bassoonSvg';

      // 初回レイアウトで画面内に収める
      fitContentToViewport();

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

          exportSvgToPngBlob(currentSvg).then((blob) => {
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
            // モバイルでの連続DL安定のため少し遅らせる
            setTimeout(() => {
              const ta = document.createElement('a');
              ta.href = URL.createObjectURL(tb);
              ta.download = 'fingering-notes.txt';
              document.body.appendChild(ta);
              ta.click();
              ta.remove();
              setTimeout(() => URL.revokeObjectURL(ta.href), 1000);
            }, 500);
          }).catch(() => {
            // PNG化に失敗したらSVGをダウンロード
            const serializer = new XMLSerializer();
            const currentSvg2 = document.getElementById('bassoonSvg');
            if (!currentSvg2) return;
            let svgString = serializer.serializeToString(currentSvg2);
            if (!/^<\?xml/.test(svgString)) {
              svgString = '<?xml version="1.0" encoding="UTF-8"?>\n' + svgString;
            }
            const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(svgBlob);
            a.download = 'fingering.svg';
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(a.href), 1000);

            // テキストはダウンロード
            const notes = getSavedText();
            const tb = new Blob([notes], { type: 'text/plain;charset=utf-8' });
            const ta = document.createElement('a');
            ta.href = URL.createObjectURL(tb);
            ta.download = 'fingering-notes.txt';
            document.body.appendChild(ta);
            ta.click();
            ta.remove();
            setTimeout(() => URL.revokeObjectURL(ta.href), 1000);
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

// リサイズや向き変更で再フィット
window.addEventListener('resize', () => {
  // visualViewport対応ブラウザならそのイベントも拾う
  fitContentToViewport();
});
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', fitContentToViewport);
}
window.addEventListener('orientationchange', fitContentToViewport);
window.addEventListener('load', fitContentToViewport);
