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
    })
    .catch((err) => {
      console.error('SVG load failed', err);
      wrapper.textContent = 'SVGの読み込みに失敗しました。';
    });
})();
