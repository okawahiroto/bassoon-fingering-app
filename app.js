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
  if (!wrapper) return;
  const src = wrapper.getAttribute('data-src');
  if (!src) return;

  const colors = ['black', 'red', 'white'];

  function cycleElementColor(el) {
    const raw = el.getAttribute('data-color-index');
    let idx = raw ? parseInt(raw, 10) : -1;
    idx = (idx + 1) % colors.length;
    // 図形の内側がクリック対象なので、常にfillを変更
    el.setAttribute('fill', colors[idx]);
    el.setAttribute('data-color-index', String(idx));
  }

  fetch(src)
    .then((res) => res.text())
    .then((svgText) => {
      wrapper.innerHTML = svgText;
      const svg = wrapper.querySelector('svg');
      if (!svg) return;
      svg.id = 'bassoonSvg';

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
          };
          img.src = url;
        });
      }
    })
    .catch((err) => {
      console.error('SVG load failed', err);
      wrapper.textContent = 'SVGの読み込みに失敗しました。';
    });
})();
