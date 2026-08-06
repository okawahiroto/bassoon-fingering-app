// アプリ本体をキャッシュしてオフライン起動を可能にする(Phase 3: PWA堅牢化, Issue #4)。
// 静的アセット(CSS/JS/フォント/アイコン)の中身を変更したら CACHE_NAME のバージョンを
// 上げること。上げないと古いキャッシュが使われ続け、更新が反映されない。
const CACHE_NAME = 'bassoon-fingering-v1';

const APP_SHELL = [
  './',
  'index.html',
  'app.css',
  'app.js',
  'lib/shareUrl.js',
  'manifest.webmanifest',
  'picture/bassoon_key.svg',
  'picture/icons/icon-192.png',
  'picture/icons/icon-512.png',
  'picture/icons/apple-touch-icon.png',
  'vendor/bootstrap.min.css',
  'vendor/fonts/noto-sans-jp.css',
  'vendor/fonts/NotoSansJP-400.woff2',
  'vendor/fonts/NotoSansJP-500.woff2',
  'vendor/fonts/NotoSansJP-700.woff2',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

// キャッシュ優先、無ければネットワークから取得してキャッシュに追加。
// ネットワークも失敗した場合、ページ遷移リクエストだけはアプリ本体(index.html)を返す。
// 同一オリジンのGETリクエストのみを対象にする(外部への問い合わせは素通し)。
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return res;
        })
        .catch(() => {
          if (req.mode === 'navigate') return caches.match('index.html');
          throw new Error('offline and not cached');
        });
    })
  );
});
