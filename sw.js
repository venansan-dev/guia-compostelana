const CACHE_NAME = 'guia-compostelana-v2046';
const TILE_CACHE = 'guia-tiles-v5';
const IMG_CACHE  = 'guia-imgs-v10';
const LIB_CACHE  = 'guia-libs-v1';
const TRACK_CACHE = 'guia-tracks-v4';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/app.js',
  '/i18n.js',
  '/pois.js',
  '/manifest.json'
];

// Imágenes POIs (sincronizado con las imágenes referenciadas en index.html)
const POI_IMAGES = ['https://i.postimg.cc/5yJ2vk9j/descrip.webp', 'https://i.postimg.cc/mkf5BspB/historia2.webp', 'https://i.postimg.cc/RFK0WzBw/IMG-0229.webp', 'https://i.postimg.cc/0jRBPsX9/historia3.webp', 'https://i.postimg.cc/Fz5BN4W2/brujula2.webp', 'https://i.postimg.cc/vBfm4dsN/losaestrelladavid.webp', 'https://i.postimg.cc/Bb9V407s/brujula3-2.webp', 'https://i.postimg.cc/rsTwWYVf/freixo.webp', 'https://i.postimg.cc/1twz8ZQr/IMG-0859.webp', 'https://i.postimg.cc/Bb9V407S/etapas3.webp', 'https://i.postimg.cc/C1gNNsDK/IMG-0213.jpg', 'https://i.postimg.cc/Fz5BN4C5/asis3.webp', 'https://i.postimg.cc/T1x3mHdk/graffiticoia.webp', 'https://i.postimg.cc/ZntM4SsR/etapas2.webp', 'https://i.postimg.cc/4ykSsgLD/asistente2.webp', 'https://i.postimg.cc/Sx0rth1M/headr4.webp', 'https://i.postimg.cc/63nQ8NXh/IMG-1179.webp', 'https://i.postimg.cc/nzBLXtx8/fortalezacastro.webp', 'https://i.postimg.cc/brPwbFyF/santamariadeguizan.webp', 'https://i.postimg.cc/Bb3nDwZj/IMG-4705.webp', 'https://i.postimg.cc/wvLB1dpf/IMG-1026.webp', 'https://i.postimg.cc/Y06ySsT2/principal2.webp', 'https://i.postimg.cc/MHCNTPDJ/balaidos.jpg', 'https://i.postimg.cc/mkY6r5Kb/mipunto3.webp', 'https://i.postimg.cc/J0Ndh2SM/mipunto2.webp', 'https://i.postimg.cc/T1x3mHdB/santacristinalavadores.webp', 'https://i.postimg.cc/d39t9mDw/coiai.webp', 'https://i.postimg.cc/NMm0Kwc7/IMG-1120.webp', 'https://i.postimg.cc/XJpbp4gp/alertas2.webp', 'https://i.postimg.cc/RhmZfbSk/torrelavandeira.webp', 'https://i.postimg.cc/zvNGWPz6/casaceta.webp', 'https://i.postimg.cc/L5S8f09r/concatedral.webp', 'https://i.postimg.cc/TwgPKX6N/IMG-2940.webp', 'https://i.postimg.cc/qqrvnZBT/iglesiacastrelos.webp', 'https://i.postimg.cc/XqWYFDN4/laxe.webp', 'https://i.postimg.cc/J08zJd7W/iglesiabembrive.webp', 'https://i.postimg.cc/vTFNbs2Z/logohead.webp', 'https://i.postimg.cc/hP2mT0LN/casc6.webp', 'https://i.postimg.cc/kGCg8hM7/torrepadin.webp', 'https://i.postimg.cc/DZLzSKTR/IMG-E1212.webp', 'https://i.postimg.cc/Kjb8LscZ/bembrive.webp', 'https://i.postimg.cc/j20Ftb3V/alertas3.webp', 'https://i.postimg.cc/90BFBtzW/bouzas.webp', 'https://i.postimg.cc/9fmZ7NSx/vieira8.webp', 'https://i.postimg.cc/tJzCzt7q/escudos.webp', 'https://i.postimg.cc/prBXBYyr/real.webp', 'https://i.postimg.cc/D0hwsYfv/iglesiateis.webp', 'https://i.postimg.cc/Hnmk5PWk/olivo.webp', 'https://i.postimg.cc/nrxh7wVC/escudoamorcortes.webp', 'https://i.postimg.cc/nr1c1YMZ/santiagodeparada.webp'];

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
  // Precache CRÍTICO (bloqueante): estáticos + librerías. Es lo mínimo para
  // que la app arranque y funcione offline tras la primera carga.
  e.waitUntil(
    Promise.all([
      caches.open(CACHE_NAME).then(function(c) {
        // Cacheamos cada recurso por separado (no addAll atómico): si uno
        // falla, los demás se guardan igual. Antes, si un solo recurso de
        // STATIC_ASSETS fallaba, no se cacheaba NADA y la app no abría offline.
        return Promise.allSettled(STATIC_ASSETS.map(function(url) {
          return c.add(url).catch(function(){});
        }));
      }),
      caches.open(LIB_CACHE).then(function(c) {
        return Promise.allSettled(LIB_URLS.map(function(url) {
          return c.add(url).catch(function(){});
        }));
      })
    ]).then(function() { return self.skipWaiting(); })
  );

  // Precache DIFERIDO (no bloqueante): imágenes de POIs y tracks de etapas.
  // Antes iban dentro del waitUntil y disparaban ~140 peticiones de golpe que
  // competían con la carga inicial de la página en la PRIMERA visita en móvil.
  // Ahora se cachean en segundo plano; además el handler 'fetch' ya las cachea
  // bajo demanda, así que el modo offline no depende de que esto termine.
  caches.open(IMG_CACHE).then(function(c) {
    POI_IMAGES.forEach(function(url) { c.add(url).catch(function(){}); });
  });
  caches.open(TRACK_CACHE).then(function(c) {
    TRACK_URLS.forEach(function(url) { c.add(url).catch(function(){}); });
  });
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

  // Imágenes postimg → cache first.
  // postimg.cc sirve desde una CDN que puede responder con redirecciones o
  // respuestas opacas (type:'opaque', status 0) en peticiones cross-origin.
  // Antes solo cacheábamos status===200, así que esas respuestas válidas no
  // se guardaban y, sin red, la imagen salía rota. Ahora cacheamos cualquier
  // respuesta utilizable y, si todo falla, devolvemos un error de red (no un
  // 404 fijo) para que el navegador pueda reintentar al recuperar conexión.
  if (url.includes('postimg.cc') || url.includes('postimg.io')) {
    e.respondWith(
      caches.open(IMG_CACHE).then(function(c) {
        return c.match(e.request).then(function(cached) {
          if (cached) return cached;
          return fetch(e.request).then(function(res) {
            if (res && (res.status === 200 || res.type === 'opaque' || res.status === 0)) {
              c.put(e.request, res.clone()).catch(function(){});
            }
            return res;
          }).catch(function() {
            // Sin red y sin caché: reintentar una vez por si fue un fallo
            // transitorio; si vuelve a fallar, devolver error de red.
            return fetch(e.request).catch(function(){ return Response.error(); });
          });
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
        // Sin conexión: servir el index cacheado. Probamos varias claves e
        // ignoramos los parámetros de URL (?utm=, start_url del manifest, etc.),
        // que es la causa de que match(e.request) fallara y saliera la página
        // blanca del navegador al abrir la PWA tras un cierre total.
        return caches.match(e.request, { ignoreSearch: true }).then(function(cached) {
          if (cached) return cached;
          return caches.match('/index.html', { ignoreSearch: true });
        }).then(function(cached) {
          if (cached) return cached;
          return caches.match('/', { ignoreSearch: true });
        }).then(function(cached) {
          return cached || Response.error();
        });
      })
    );
    return;
  }

  // pois.js y app.js (datos + lógica de la app) → cache first con
  // actualización en segundo plano. Carga instantánea desde caché; si hay
  // red, refresca para la próxima vez.
  if (url.endsWith('/pois.js') || url.endsWith('/app.js') || url.endsWith('/i18n.js')) {
    e.respondWith(
      caches.open(CACHE_NAME).then(function(c) {
        return c.match(e.request).then(function(cached) {
          var red = fetch(e.request).then(function(res) {
            if (res && res.status === 200) c.put(e.request, res.clone());
            return res;
          }).catch(function() { return cached; });
          return cached || red;
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
