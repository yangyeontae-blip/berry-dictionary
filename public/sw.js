// 베리의 숲 국어사전 서비스 워커: 한 번 본 화면·그림·사전 조각을 기기에 넣어 두고, 인터넷이 약해도 펼칠 수 있게 한다.
// __VERSION__ 과 __SHELL__ 은 빌드(vite.config.ts)에서 채운다. 버전이 바뀌면 옛 보관함을 지운다.
const VERSION = '__VERSION__';
const SHELL = __SHELL__;
const CACHE = 'berry-dict-' + VERSION;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('berry-dict-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin || url.pathname.includes('/api/')) return;
  if (req.mode === 'navigate') {
    // 화면은 새 판을 먼저, 인터넷이 없으면 넣어 둔 화면으로.
    e.respondWith(fetch(req).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put('./', copy)); return r; }).catch(() => caches.match('./', {ignoreSearch: true}).then(r => r || caches.match('index.html'))));
    return;
  }
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => {
    if (r.ok && r.type === 'basic') { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return r;
  })));
});
