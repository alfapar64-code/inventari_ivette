const CACHE_NAME = 'inventario-ivette-v1';
const ASSETS = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './manifest.json'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
        .then(cache => cache.addAll(ASSETS))
    );
});

self.addEventListener('fetch', event => {
    if (event.request.url.includes('docs.google.com')) {
        return; // No cachear el CSV, siempre queremos datos en vivo
    }
    event.respondWith(
        caches.match(event.request)
        .then(response => response || fetch(event.request))
    );
});
