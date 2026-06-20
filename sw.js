const CACHE_NAME = 'guia-compostelana-v1330';
const TILE_CACHE = 'guia-tiles-v5';
const IMG_CACHE  = 'guia-imgs-v5';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json'
];

// Imágenes POIs
const POI_IMAGES = ['https://i.postimg.cc/zBRhnbGj/santiagodeparada.jpg', 'https://i.postimg.cc/vmb63LGX/IMG-0208.jpg', 'https://i.postimg.cc/Fsy3DmWJ/Captura-de-pantalla-2026-06-02-a-las-0-05-57.png', 'https://i.postimg.cc/4xhHQ5pL/IMG-0859.jpg', 'https://i.postimg.cc/wBqhc9S5/santacristinalavadores.jpg', 'https://i.postimg.cc/Xq5Y9wt7/santamariadeguizan.jpg', 'https://i.postimg.cc/Y9XFxcYN/santiagodeparada.jpg', 'https://i.postimg.cc/sXqGy3bD/torrelavandeira.jpg', 'https://i.postimg.cc/Qd8KzMpZ/torrepadin.jpg', 'https://i.postimg.cc/Y9c4PKQZ/IMG-1026.jpg'];

self.addEventListener('install', function(e) {
  e.waitUntil(
    Promise.all([
      caches.open(CACHE_NAME).then(function(c) { return c.addAll(STATIC_ASSETS); }),
      caches.open(IMG_CACHE).then(function(c) {
        return Promise.allSettled(POI_IMAGES.map(function(url) {
          return c.add(url).catch(function(){});
        }));
      })
    ]).then(function() { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.map(function(key) {
        if (key !== CACHE_NAME && key !== TILE_CACHE && key !== IMG_CACHE) {
          return caches.delete(key);
        }
      }));
    }).then(function() { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(e) {
  var url = e.request.url;

  // Tiles OSM → cache-first con auto-cache al vuelo
  if (url.includes('tile.openstreetmap.org')) {
    e.respondWith(
      caches.open(TILE_CACHE).then(function(c) {
        return c.match(e.request).then(function(cached) {
          if (cached) return cached;
          return fetch(e.request).then(function(res) {
            if (res && res.status === 200) c.put(e.request, res.clone());
            return res;
          }).catch(function() { return new Response('', {status: 503}); });
        });
      })
    );
    return;
  }

  // Imágenes postimg → cache first
  if (url.includes('postimg.cc') || url.includes('postimg.io')) {
    e.respondWith(
      caches.open(IMG_CACHE).then(function(c) {
        return c.match(e.request).then(function(cached) {
          if (cached) return cached;
          return fetch(e.request).then(function(res) {
            if (res && res.status === 200) c.put(e.request, res.clone());
            return res;
          }).catch(function() { return new Response('', {status: 404}); });
        });
      })
    );
    return;
  }

  // Todo lo demás → network first, fallback cache
  e.respondWith(
    fetch(e.request).catch(function() {
      return caches.match(e.request);
    })
  );
});
