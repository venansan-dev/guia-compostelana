const CACHE_NAME = 'guia-compostelana-v1479';
const TILE_CACHE = 'guia-tiles-v5';
const IMG_CACHE  = 'guia-imgs-v6';
const LIB_CACHE  = 'guia-libs-v1';
const TRACK_CACHE = 'guia-tracks-v4';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json'
];

// Imágenes POIs (sincronizado con las imágenes referenciadas en index.html)
const POI_IMAGES = ['https://i.postimg.cc/0NmcSJk6/descrip.png', 'https://i.postimg.cc/0NwKTNDS/historia2.png', 'https://i.postimg.cc/1XdXBwx5/IMG-0229.jpg', 'https://i.postimg.cc/3xbwPnvL/historia3.png', 'https://i.postimg.cc/6Qv4kQn8/brujula2.png', 'https://i.postimg.cc/6p1S2PqR/losaestrelladavid.jpg', 'https://i.postimg.cc/7ZQLpm20/brujula3.png', 'https://i.postimg.cc/7ZQcGRh2/freixo.jpg', 'https://i.postimg.cc/85qh3dYg/IMG-0859.jpg', 'https://i.postimg.cc/9QNfvJ7G/etapas3.png', 'https://i.postimg.cc/C1gNNsDK/IMG-0213.jpg', 'https://i.postimg.cc/Cx6KWmq8/asis3.png', 'https://i.postimg.cc/D00S3F1Q/graffiticoia.jpg', 'https://i.postimg.cc/DzX49zLW/etapas2.png', 'https://i.postimg.cc/Fsy3DmWJ/Captura-de-pantalla-2026-06-02-a-las-0-05-57.png', 'https://i.postimg.cc/HLy8qLXc/asistente2.png', 'https://i.postimg.cc/HnGvFWjJ/headr4.png', 'https://i.postimg.cc/Hnnjb3Nk/IMG-1179.jpg', 'https://i.postimg.cc/Hnnr1HbB/fortalezacastro.jpg', 'https://i.postimg.cc/J0VkKrsg/santamariadeguizan.jpg', 'https://i.postimg.cc/JhxGVc20/IMG-4705.png', 'https://i.postimg.cc/L5HDVXtt/IMG-1026.jpg', 'https://i.postimg.cc/Ls1gcsLL/principal2.png', 'https://i.postimg.cc/MHCNTPDJ/balaidos.jpg', 'https://i.postimg.cc/MHq8dzB5/hero8.png', 'https://i.postimg.cc/P5FqB2wS/mipunto3.png', 'https://i.postimg.cc/PqwvgqYt/mipunto2.png', 'https://i.postimg.cc/QCGTS8Fv/santacristinalavadores.jpg', 'https://i.postimg.cc/QMTbR3vh/Captura-de-pantalla-2026-05-31-a-las-13-52-42.png', 'https://i.postimg.cc/RVZ22Wdx/IMG-1120.jpg', 'https://i.postimg.cc/SKMYBKCN/alertas2.png', 'https://i.postimg.cc/Ssz9W2Kq/torrelavandeira.jpg', 'https://i.postimg.cc/VvhdYTFW/casaceta.jpg', 'https://i.postimg.cc/W3NGwNdL/concatedral.jpg', 'https://i.postimg.cc/Xq5nND5x/IMG-2940.jpg', 'https://i.postimg.cc/ZnG2R7cm/iglesiacastrelos.jpg', 'https://i.postimg.cc/gJzVHzxW/laxe.jpg', 'https://i.postimg.cc/j22DYKyM/iglesiabembrive.jpg', 'https://i.postimg.cc/k5yzbjd9/logohead.png', 'https://i.postimg.cc/m2TbCRTs/casc4.png', 'https://i.postimg.cc/nzQmvjhN/torrepadin.jpg', 'https://i.postimg.cc/qqFzkYGD/IMG-E1212.jpg', 'https://i.postimg.cc/rm387xgK/IMG-0201.jpg', 'https://i.postimg.cc/rmV1NVKY/bembrive.jpg', 'https://i.postimg.cc/rwYpvQrR/alertas3.png', 'https://i.postimg.cc/sfSQF2nR/Captura-de-pantalla-2026-05-31-a-las-13-32-32.png', 'https://i.postimg.cc/tRWLFtGh/vieira.png', 'https://i.postimg.cc/wB9NkRLk/Captura-de-pantalla-2026-05-31-a-las-14-14-50.png', 'https://i.postimg.cc/wTzh0rXs/Captura-de-pantalla-2026-05-31-a-las-14-09-56.png', 'https://i.postimg.cc/x88XVYL3/iglesiateis.jpg', 'https://i.postimg.cc/xThPVV4d/olivo.jpg', 'https://i.postimg.cc/yxxDCB0Z/escudoamorcortes.jpg', 'https://i.postimg.cc/zBRhnbGj/santiagodeparada.jpg'];

// Librerías externas (Leaflet, markercluster, Firebase) necesarias para que
// el mapa y la app funcionen sin conexión tras la primera carga.
const LIB_URLS = [
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js',
  'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css',
  'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css',
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-database-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth-compat.js'
];

// Tracks de TODAS las etapas (trazados oficiales). Se precachean en el
// install para que el modo Ruta Oficial funcione 100% offline desde el
// primer momento, sin necesidad de haber visitado antes cada etapa.
const TRACK_URLS = [
  'tracks/es01c_05a.json',
  'tracks/es01c_06a.json',
  'tracks/es01c_07a.json',
  'tracks/es01c_08a.json',
  'tracks/es01c_09a.json',
  'tracks/es01c_10a.json',
  'tracks/es01c_11a.json',
  'tracks/es01c_12a.json',
  'tracks/es01c_13a.json',
  'tracks/es01c_14a.json',
  'tracks/es01c_15a.json',
  'tracks/es01c_16a.json',
  'tracks/es01c_17a.json',
  'tracks/es01c_18a.json',
  'tracks/es01c_19a.json',
  'tracks/es01c_20a.json',
  'tracks/es01c_21a.json',
  'tracks/es01c_22a.json',
  'tracks/es01c_23a.json',
  'tracks/es01c_24a.json',
  'tracks/es01c_25a.json',
  'tracks/es01c_26a.json',
  'tracks/es01c_27a.json',
  'tracks/es01c_28a.json',
  'tracks/es01c_29a.json',
  'tracks/es01c_30a.json',
  'tracks/es01c_31a.json',
  'tracks/es01c_32a.json',
  'tracks/es01c_33a.json',
  'tracks/es02a_01a.json',
  'tracks/es02a_02a.json',
  'tracks/es02a_03a.json',
  'tracks/es02a_04a.json',
  'tracks/es02a_05a.json',
  'tracks/es02a_06a.json',
  'tracks/es03a_01a.json',
  'tracks/es03a_02a.json',
  'tracks/es03a_03a.json',
  'tracks/es03a_04a.json',
  'tracks/es03a_05a.json',
  'tracks/es03a_06a.json',
  'tracks/es03a_07a.json',
  'tracks/es03a_08a.json',
  'tracks/es03a_09a.json',
  'tracks/es03a_10a.json',
  'tracks/es03a_11a.json',
  'tracks/es03a_12a.json',
  'tracks/es03a_13a.json',
  'tracks/es03a_14a.json',
  'tracks/es03a_15a.json',
  'tracks/es03a_16a.json',
  'tracks/es03a_17a.json',
  'tracks/es03a_18a.json',
  'tracks/es03a_19a.json',
  'tracks/es03a_20a.json',
  'tracks/es03a_21a.json',
  'tracks/es03a_22a.json',
  'tracks/es03a_23a.json',
  'tracks/es03a_24a.json',
  'tracks/es03a_25a.json',
  'tracks/es03a_26a.json',
  'tracks/es03a_27a.json',
  'tracks/es03a_28a.json',
  'tracks/es03a_29a.json',
  'tracks/es03a_30a.json',
  'tracks/es03a_31a.json',
  'tracks/es05a_01a.json',
  'tracks/es05a_02a.json',
  'tracks/es05a_03a.json',
  'tracks/es05a_04a.json',
  'tracks/es05a_05a.json',
  'tracks/es05a_06a.json',
  'tracks/es05a_07a.json',
  'tracks/es05a_08a.json',
  'tracks/es05a_09a.json',
  'tracks/es05a_10a.json',
  'tracks/es05a_11a.json',
  'tracks/es06a_01a.json',
  'tracks/es06a_02a.json',
  'tracks/es06a_03a.json',
  'tracks/es06a_04a.json',
  'tracks/es06a_05a.json',
  'tracks/es06a_06a.json',
  'tracks/es18a_01a.json',
  'tracks/es18a_02a.json',
  'tracks/es18a_03a.json',
  'tracks/es18a_04a.json',
  'tracks/es18a_05a.json',
  'tracks/es18a_06a.json',
  'tracks/es18a_07a.json',
  'tracks/es18a_08a.json',
  'tracks/rclone-mount-config.json'
];

self.addEventListener('install', function(e) {
  e.waitUntil(
    Promise.all([
      caches.open(CACHE_NAME).then(function(c) { return c.addAll(STATIC_ASSETS); }),
      caches.open(IMG_CACHE).then(function(c) {
        return Promise.allSettled(POI_IMAGES.map(function(url) {
          return c.add(url).catch(function(){});
        }));
      }),
      caches.open(LIB_CACHE).then(function(c) {
        return Promise.allSettled(LIB_URLS.map(function(url) {
          return c.add(url).catch(function(){});
        }));
      }),
      caches.open(TRACK_CACHE).then(function(c) {
        return Promise.allSettled(TRACK_URLS.map(function(url) {
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
        if (key !== CACHE_NAME && key !== TILE_CACHE && key !== IMG_CACHE && key !== LIB_CACHE && key !== TRACK_CACHE) {
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

  // Librerías externas (Leaflet, markercluster, Firebase, Google Fonts) →
  // cache first con auto-cache al vuelo, para que el mapa siga funcionando sin red.
  if (url.includes('unpkg.com') || url.includes('gstatic.com') || url.includes('fonts.googleapis.com')) {
    e.respondWith(
      caches.open(LIB_CACHE).then(function(c) {
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

  // Tracks de etapas (GPX→JSON) → cache first con auto-cache.
  // Se descargan bajo demanda al caminar y quedan disponibles offline.
  if (url.includes('tracks/') && url.endsWith('.json')) {
    e.respondWith(
      caches.open(TRACK_CACHE).then(function(c) {
        return c.match(e.request).then(function(cached) {
          if (cached) return cached;
          return fetch(e.request).then(function(res) {
            if (res && res.status === 200) c.put(e.request, res.clone());
            return res;
          }).catch(function() { return new Response('null', {status: 404}); });
        });
      })
    );
    return;
  }

  // Navegación / HTML → network first que ADEMÁS refresca la caché.
  // Así, tras subir una versión nueva, la siguiente carga ya trae el HTML
  // actualizado aunque el Service Worker anterior siguiera en control.
  if (e.request.mode === 'navigate' ||
      (e.request.destination === 'document') ||
      url.endsWith('/') || url.endsWith('/index.html')) {
    e.respondWith(
      fetch(e.request).then(function(res) {
        if (res && res.status === 200) {
          var copia = res.clone();
          caches.open(CACHE_NAME).then(function(c){ c.put(e.request, copia); });
        }
        return res;
      }).catch(function() {
        return caches.match(e.request).then(function(cached) {
          return cached || caches.match('/index.html') || caches.match('/');
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
