// Bellenode service worker — cache minimal du shell, passe-plat pour /api/*
const VERSION = 'bn-v1';
const SHELL_CACHE = 'bn-shell-' + VERSION;
const RUNTIME_CACHE = 'bn-runtime-' + VERSION;
const SHELL_ASSETS = ['/', '/manifest.webmanifest', '/favicon.png', '/apple-touch-icon.png', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((c) => c.addAll(SHELL_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => !k.endsWith(VERSION)).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // API : réseau d'abord, fallback cache
  if (url.pathname.startsWith('/api/')) {
    event.respondWith((async () => {
      try {
        const net = await fetch(request);
        return net;
      } catch (e) {
        const cached = await caches.match(request);
        if (cached) return cached;
        throw e;
      }
    })());
    return;
  }

  // Navigation (HTML) : réseau d'abord, fallback index
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const net = await fetch(request);
        const cache = await caches.open(SHELL_CACHE);
        cache.put('/', net.clone());
        return net;
      } catch (e) {
        const cached = await caches.match('/');
        if (cached) return cached;
        throw e;
      }
    })());
    return;
  }

  // Assets (JS/CSS/PNG) : cache d'abord, fallback réseau + stocke
  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;
    try {
      const net = await fetch(request);
      if (net.ok) {
        const cache = await caches.open(RUNTIME_CACHE);
        cache.put(request, net.clone());
      }
      return net;
    } catch (e) {
      throw e;
    }
  })());
});
