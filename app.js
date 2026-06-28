
  // PUNTOS se carga desde pois.js (script externo, cargado antes que este)
  if (typeof window.PUNTOS === "undefined") { window.PUNTOS = []; }
  var PUNTOS = window.PUNTOS;

// PUNTOS — definidos en el HTML del array PUNTOS global

// ============================================================
// FIREBASE — init y funciones persistentes
// ============================================================
firebase.initializeApp({
  apiKey: "AIzaSyB2h9ta0WSoK3BqK1ZU5IWQeZA_H8HwM-4",
  authDomain: "guiacompostelana.firebaseapp.com",
  databaseURL: "https://guiacompostelana-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "guiacompostelana",
  storageBucket: "guiacompostelana.firebasestorage.app",
  messagingSenderId: "454833387853",
  appId: "1:454833387853:web:61e784528b2d7b081e1f04"
});
var db = firebase.database();
var auth = firebase.auth();

// Autenticación anónima: registra al usuario normal sin pedirle nada,
// para que pueda comentar/crear alertas cumpliendo las reglas (auth != null).
// No interfiere con el login de admin (email/contraseña).
auth.onAuthStateChanged(function(user) {
  if (!user) {
    auth.signInAnonymously().catch(function(err) {
      console.warn('Auth anónima falló:', err && err.code);
    });
  }
});

// ── Sanitización anti-XSS para datos de usuario (comentarios, alertas, POIs) ──
// Escapa caracteres peligrosos antes de inyectar texto en innerHTML.
function esc(s){
  return String(s == null ? '' : s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
// Versión para texto dentro de atributos onclick="..." (contexto JS dentro de HTML).
function escAttr(s){
  return esc(s).replace(/\\/g,'&#92;');
}

// ── LOG DE ERRORES (Firebase) ───────────────────────────────────────────────
var _errorLogCount = 0;
var _errorLogMax = 8; // tope de envíos por sesión, para no inundar la base si algo falla en bucle
function _logError(contexto, err) {
  try {
    if (typeof db === 'undefined' || _errorLogCount >= _errorLogMax) return;
    _errorLogCount++;
    var msg = (err && err.message) ? err.message : String(err == null ? 'error desconocido' : err);
    var stack = (err && err.stack) ? String(err.stack).slice(0, 500) : '';
    db.ref('errores_app').push({
      contexto: String(contexto || '').slice(0, 150),
      mensaje: msg.slice(0, 300),
      stack: stack,
      version: (typeof _APP_VERSION !== 'undefined' ? _APP_VERSION : ''),
      ua: (navigator.userAgent || '').slice(0, 200),
      idioma: (typeof idiomaActual !== 'undefined' ? idiomaActual : ''),
      ts: Date.now()
    }).catch(function(){});
  } catch(e) { /* si el propio logger falla, no hacemos nada más */ }
}
window.addEventListener('error', function(e) {
  _logError('window.onerror @ ' + (e.filename || '?') + ':' + (e.lineno || '?'), e.error || e.message);
});
window.addEventListener('unhandledrejection', function(e) {
  _logError('unhandledrejection', e.reason);
});

// ── EFECTO ONDA EN TÍTULOS DE DONACIONES ────────────────────────────────────
function aplicarOndaTitulo(elId) {
  var el = document.getElementById(elId);
  if (!el) return;
  // Leer texto limpio — si ya tiene spans de onda anterior, usar textContent
  var texto = el.textContent.trim();
  if (!texto) return;
  // Envolver cada letra en un span
  el.innerHTML = texto.split('').map(function(ch) {
    if (ch === ' ') return '<span style="display:inline-block;width:0.3em"> </span>';
    return '<span class="don-letra" style="display:inline-block;transition:transform 0.3s ease,color 0.3s ease">' + ch + '</span>';
  }).join('');
}

function lanzarOndaTitulo(elId) {
  var el = document.getElementById(elId);
  if (!el) return;
  var letras = el.querySelectorAll('.don-letra');
  letras.forEach(function(span, i) {
    setTimeout(function() {
      span.style.transform = 'translateY(-7px)';
      span.style.color = '#fff';
      setTimeout(function() {
        span.style.transform = 'translateY(0)';
        span.style.color = '#FFE066';
      }, 300);
    }, i * 60);
  });
}

function initOndaTitulos() {
  // Solo aplicar onda al banner pequeño — el grande tiene estructura HTML interna
  aplicarOndaTitulo('footer-don-title');
  setTimeout(function() {
    lanzarOndaTitulo('footer-don-title');
    setInterval(function() { lanzarOndaTitulo('footer-don-title'); }, 8000);
  }, 1500);

  // Para el banner grande, aplicar onda solo al primer div hijo (Donaciones)
  var donH2 = document.getElementById('donaciones-h2');
  if (donH2) {
    var firstLine = donH2.querySelector('div');
    if (firstLine) {
      firstLine.id = 'donaciones-h2-title';
      aplicarOndaTitulo('donaciones-h2-title');
      setTimeout(function() {
        lanzarOndaTitulo('donaciones-h2-title');
        setInterval(function() { lanzarOndaTitulo('donaciones-h2-title'); }, 8000);
      }, 6500);
    }
  }
}

document.addEventListener('DOMContentLoaded', function() {
  setTimeout(initOndaTitulos, 800);
});

// ── OCULTAR BOTÓN MAPA CUANDO TARJETA EXPANDIDA SE SUPERPONE ────────────────
// Usa IntersectionObserver para detectar si el carrusel está encima del mapa
(function() {
  function initCarouselObserver() {
    var carousel = document.getElementById('carousel');
    var mapBlock = document.querySelector('.map-block');
    if (!carousel || !mapBlock) return;

    var observer = new IntersectionObserver(function(entries) {
      // No hacemos nada aquí — el control lo lleva el leer-mas listener
    }, { threshold: 0 });

    // En móvil, cuando hay tarjeta expandida y el usuario hace scroll
    // el botón ya se oculta por el listener de leerMas
    // Aquí añadimos control por scroll: si el carousel está visible en pantalla
    // junto con el mapa, ocultar el botón si hay tarjeta expandida
    window.addEventListener('scroll', function() {
      var btnAdd = document.getElementById('btn-add-poi-map');
      if (!btnAdd) return;
      var expanded = document.querySelector('.poi-desc.expanded');
      if (!expanded && !_navActiva) {
        btnAdd.style.display = 'flex';
        return;
      }
      // Hay tarjeta expandida — verificar si se superpone visualmente con el mapa
      var mapRect = mapBlock ? mapBlock.getBoundingClientRect() : null;
      var carouselEl = document.querySelector('.carousel-wrap');
      var carouselRect = carouselEl ? carouselEl.getBoundingClientRect() : null;
      if (mapRect && carouselRect) {
        var overlap = mapRect.bottom > carouselRect.top;
        btnAdd.style.display = (overlap || _navActiva) ? 'none' : 'flex';
      }
    }, { passive: true });
  }
  document.addEventListener('DOMContentLoaded', function() {
    setTimeout(initCarouselObserver, 1000);
  });
})();

// ── BOTÓN PRINCIPAL: INSTALAR APP o ACTIVAR NOTIFICACIONES ──────────────────
// - En el navegador normal: ofrece instalar la PWA (Android) o guía (iOS)
// - Dentro de la app instalada (standalone): activa/desactiva notificaciones

var notifActivadas = (typeof Notification !== 'undefined' && Notification.permission === 'granted');
if (notifActivadas) { setTimeout(function(){ if(typeof iniciarProximidad==='function') iniciarProximidad(); }, 2000); }
var _cromosNotifOn = (function(){ try{ var v=localStorage.getItem('cromosNotifOn'); return v===null?true:v==='1'; }catch(e){return true;} })(); // controla modales de desbloqueo y cromos
var deferredInstallPrompt = null; // guarda el evento beforeinstallprompt

// Capturar el evento de instalación de Android Chrome
window.addEventListener('beforeinstallprompt', function(e) {
  e.preventDefault();
  deferredInstallPrompt = e;
  actualizarBtnPrincipal(); // actualizar botón ahora que tenemos el prompt
});

// Detectar si ya está instalada como PWA
function esStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches ||
         window.navigator.standalone === true;
}

// Detectar iOS
function esIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

// Acción del botón — decide qué hacer según contexto
function accionBtnPrincipal() {
  if (esStandalone()) {
    // Estamos dentro de la app: comportamiento notificaciones
    if (notifActivadas) {
      desactivarNotificaciones();
    } else {
      activarNotificaciones();
    }
  } else if (deferredInstallPrompt) {
    // Android Chrome en navegador: lanzar instalador nativo
    deferredInstallPrompt.prompt();
    deferredInstallPrompt.userChoice.then(function(result) {
      if (result.outcome === 'accepted') {
        deferredInstallPrompt = null;
        actualizarBtnPrincipal();
      }
    });
  } else if (esIOS()) {
    // iOS: mostrar modal de instrucciones
    mostrarGuiaIOS();
  } else {
    // Escritorio o navegador sin soporte de instalación: ir directo a notificaciones
    if (notifActivadas) {
      desactivarNotificaciones();
    } else {
      activarNotificaciones();
    }
  }
}

// Modal de instrucciones para iOS
function cerrarModalIOS() {
  var m = document.getElementById('modal-ios-install');
  if (m) m.parentNode.removeChild(m);
}

function mostrarGuiaIOS() {
  // Eliminar si ya existe
  var viejo = document.getElementById('modal-ios-install');
  if (viejo) viejo.parentNode.removeChild(viejo);

  // Overlay
  var overlay = document.createElement('div');
  overlay.id = 'modal-ios-install';
  overlay.style.cssText = [
    'position:fixed',
    'top:0','left:0','right:0','bottom:0',
    'background:rgba(0,0,0,0.6)',
    'z-index:99999',
    'display:flex',
    'align-items:flex-end',
    'justify-content:center',
    '-webkit-tap-highlight-color:transparent'
  ].join(';');

  // Panel blanco
  var panel = document.createElement('div');
  panel.style.cssText = [
    'background:#fff',
    'border-radius:20px 20px 0 0',
    'padding:20px 20px 40px',
    'width:100%',
    'max-width:480px',
    'position:relative',
    'box-sizing:border-box'
  ].join(';');

  // Botón X — grande y con z-index alto para asegurarse que recibe el tap
  var x = document.createElement('button');
  x.textContent = '✕';
  x.style.cssText = [
    'position:absolute',
    'top:10px','right:10px',
    'width:44px','height:44px',
    'background:#f0f0f0',
    'border:none',
    'border-radius:50%',
    'font-size:18px',
    'cursor:pointer',
    'z-index:100000',
    'display:flex',
    'align-items:center',
    'justify-content:center',
    '-webkit-appearance:none',
    'color:#333'
  ].join(';');
  x.addEventListener('touchend', function(e) {
    e.preventDefault();
    e.stopPropagation();
    cerrarModalIOS();
  });
  x.addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();
    cerrarModalIOS();
  });

  // Handle bar
  var bar = document.createElement('div');
  bar.style.cssText = 'width:40px;height:4px;background:#ddd;border-radius:2px;margin:0 auto 16px;';

  // Título
  var h3 = document.createElement('h3');
  h3.style.cssText = 'font-size:18px;margin:0 0 8px;font-family:Playfair Display,serif;padding-right:40px';
  h3.textContent = '📲 Instalar la app';

  // Subtítulo
  var p = document.createElement('p');
  p.style.cssText = 'font-size:13px;color:#666;margin:0 0 16px;line-height:1.5';
  p.textContent = 'Para instalar y recibir notificaciones en iPhone/iPad:';

  // Pasos
  var pasos = [
    ['1️⃣', 'Toca el botón ', 'Compartir', ' ⬆️ en la barra de Safari'],
    ['2️⃣', 'Desplázate y toca ', 'Añadir a pantalla de inicio', ' ➕'],
    ['3️⃣', 'Abre la app desde tu pantalla de inicio y activa las notificaciones', '', '']
  ];

  pasos.forEach(function(paso) {
    var fila = document.createElement('div');
    fila.style.cssText = 'display:flex;align-items:center;gap:10px;background:#f5f5f0;border-radius:10px;padding:10px 12px;margin-bottom:8px';
    var ico = document.createElement('span');
    ico.style.cssText = 'font-size:20px;flex-shrink:0';
    ico.textContent = paso[0];
    var txt = document.createElement('span');
    txt.style.cssText = 'font-size:13px;color:#1a1a1a';
    txt.innerHTML = paso[1] + (paso[2] ? '<strong>' + paso[2] + '</strong>' : '') + paso[3];
    fila.appendChild(ico);
    fila.appendChild(txt);
    panel.appendChild(fila);
  });

  // Montar
  panel.insertBefore(p, panel.firstChild);
  panel.insertBefore(h3, panel.firstChild);
  panel.insertBefore(bar, panel.firstChild);
  panel.insertBefore(x, panel.firstChild);
  overlay.appendChild(panel);

  // Cerrar tocando el overlay (fuera del panel)
  overlay.addEventListener('touchend', function(e) {
    if (e.target === overlay) { e.preventDefault(); cerrarModalIOS(); }
  });
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) cerrarModalIOS();
  });

  document.body.appendChild(overlay);
}
// Añadir CSS del modal iOS
(function() {
  var s = document.createElement('style');
  s.textContent = '#modal-ios-install{display:none}#modal-ios-install.visible{display:flex!important}';
  document.head.appendChild(s);
})();

function mostrarToastNotif(tipo) {
  var viejo = document.getElementById('modal-notif-info');
  if (viejo) viejo.parentNode.removeChild(viejo);

  var esNoSoportado = (tipo === 'noSoportado');

  var overlay = document.createElement('div');
  overlay.id = 'modal-notif-info';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.55);z-index:999999;display:flex;align-items:flex-end;justify-content:center;-webkit-tap-highlight-color:transparent;font-family:DM Sans,sans-serif';

  var panel = document.createElement('div');
  panel.style.cssText = 'background:#fff;border-radius:20px 20px 0 0;padding:20px 20px 40px;width:100%;max-width:480px;position:relative;box-sizing:border-box;transform:translateY(100%);transition:transform 0.3s cubic-bezier(0.32,0.72,0,1)';

  function cerrar() {
    panel.style.transform = 'translateY(100%)';
    setTimeout(function(){ overlay.remove(); }, 300);
  }

  // ✕
  var btnX = document.createElement('button');
  btnX.textContent = '✕';
  btnX.style.cssText = 'position:absolute;top:12px;right:12px;width:36px;height:36px;background:#f0f0f0;border:none;border-radius:50%;font-size:16px;cursor:pointer;z-index:1;display:flex;align-items:center;justify-content:center;color:#555;-webkit-appearance:none';
  btnX.addEventListener('click', cerrar);
  btnX.addEventListener('touchend', function(e){ e.preventDefault(); cerrar(); });

  // Handle bar
  var bar = document.createElement('div');
  bar.style.cssText = 'width:40px;height:4px;background:#e0e0e0;border-radius:2px;margin:0 auto 18px';

  // Icono grande
  var ico = document.createElement('div');
  ico.style.cssText = 'font-size:40px;text-align:center;margin-bottom:12px';
  ico.textContent = esNoSoportado ? '📲' : '🔒';

  // Título
  var h3 = document.createElement('div');
  h3.style.cssText = 'font-size:18px;font-weight:700;color:#1a1a1a;margin-bottom:6px;font-family:Playfair Display,serif;padding-right:40px';
  h3.textContent = esNoSoportado ? 'Instala la app para recibir avisos' : 'Notificaciones bloqueadas';

  // Subtítulo
  var sub = document.createElement('div');
  sub.style.cssText = 'font-size:13px;color:#6b7280;margin-bottom:18px;line-height:1.55';
  sub.textContent = esNoSoportado
    ? 'Tu navegador no permite notificaciones. Para activarlas necesitas instalar la app en tu pantalla de inicio.'
    : 'Has bloqueado los permisos de notificación. Puedes activarlos desde los ajustes de tu navegador para este sitio.';

  panel.appendChild(btnX);
  panel.appendChild(bar);
  panel.appendChild(ico);
  panel.appendChild(h3);
  panel.appendChild(sub);

  if (esNoSoportado) {
    // Pasos de instalación
    var pasos = [
      ['1️⃣', 'Toca el botón ', 'Compartir ⬆️', ' en la barra de Safari'],
      ['2️⃣', 'Desplázate y toca ', 'Añadir a pantalla de inicio ➕', ''],
      ['3️⃣', 'Abre la app instalada y activa las notificaciones desde aquí', '', '']
    ];
    pasos.forEach(function(paso) {
      var fila = document.createElement('div');
      fila.style.cssText = 'display:flex;align-items:center;gap:10px;background:#f5f5f0;border-radius:10px;padding:10px 12px;margin-bottom:8px';
      var em = document.createElement('span');
      em.style.cssText = 'font-size:20px;flex-shrink:0';
      em.textContent = paso[0];
      var txt = document.createElement('span');
      txt.style.cssText = 'font-size:13px;color:#1a1a1a';
      txt.innerHTML = paso[1] + (paso[2] ? '<strong>' + paso[2] + '</strong>' : '') + paso[3];
      fila.appendChild(em);
      fila.appendChild(txt);
      panel.appendChild(fila);
    });
    // Botón Android si hay prompt
    if (typeof deferredInstallPrompt !== 'undefined' && deferredInstallPrompt) {
      var btnA = document.createElement('button');
      btnA.textContent = '📲 Añadir a pantalla de inicio';
      btnA.style.cssText = 'width:100%;margin-top:14px;background:#1D9E75;color:#fff;border:none;border-radius:12px;padding:12px;font-size:14px;font-weight:600;cursor:pointer;font-family:DM Sans,sans-serif';
      btnA.addEventListener('click', function() {
        deferredInstallPrompt.prompt();
        deferredInstallPrompt.userChoice.then(function(r) {
          if (r.outcome === 'accepted') deferredInstallPrompt = null;
          cerrar();
        });
      });
      panel.appendChild(btnA);
    }
  } else {
    // Bloqueado: solo botón cerrar informativo
    var btnC = document.createElement('button');
    btnC.textContent = 'Entendido';
    btnC.style.cssText = 'width:100%;background:#f3f4f6;color:#374151;border:none;border-radius:12px;padding:11px;font-size:13px;font-weight:600;cursor:pointer;font-family:DM Sans,sans-serif';
    btnC.addEventListener('click', cerrar);
    panel.appendChild(btnC);
  }

  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  requestAnimationFrame(function(){
    requestAnimationFrame(function(){ panel.style.transform = 'translateY(0)'; });
  });

  overlay.addEventListener('click', function(e){ if (e.target === overlay) cerrar(); });
  overlay.addEventListener('touchend', function(e){ if (e.target === overlay){ e.preventDefault(); cerrar(); } });
}

function activarNotificaciones() {
  if (!('Notification' in window)) {
    mostrarToastNotif('noSoportado');
    return;
  }
  if (Notification.permission === 'denied') {
    mostrarToastNotif('bloqueadas');
    return;
  }
  Notification.requestPermission().then(function(perm) {
    if (perm === 'granted') {
      notifActivadas = true;
      actualizarBtnPrincipal();
      _actualizarBtnAlertas();
      iniciarProximidad();
    }
  });
}

function desactivarNotificaciones() {
  notifActivadas = false;
  actualizarBtnPrincipal();
  _actualizarBtnAlertas();
}

// Mantener alias por si se llama desde otro sitio
function actualizarBtnNotif() { actualizarBtnPrincipal(); }

function esMobile() {
  return /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent) || window.innerWidth < 768;
}

function actualizarBtnPrincipal() {
  var t2 = T[idiomaActual]||T.es;
  var label, bg, shadow;

  if (esStandalone()) {
    // DENTRO de la app instalada: mostrar botón de notificaciones
    label  = notifActivadas
      ? (t2.btnNotifOn||'✅ Avisos de POIs activados')
      : '🔔 '+(t2.btnNotifOff||'Activa avisos de puntos de interés cercanos');
    bg     = notifActivadas ? 'var(--verde-oscuro)' : 'var(--verde)';
    shadow = notifActivadas ? '0 2px 8px rgba(29,158,117,0.5)' : '0 2px 8px rgba(29,158,117,0.3)';
  } else {
    // EN EL NAVEGADOR (móvil o escritorio): siempre mostrar botón de instalar
    label  = '📲 '+(t2.btnInstalarApp||'Instala la app y recibe avisos de los puntos de interés más cercanos a ti');
    bg     = 'var(--verde)';
    shadow = '0 2px 8px rgba(29,158,117,0.3)';
  }

  ['btn-notif','btn-notif-m'].forEach(function(id) {
    var btn = document.getElementById(id);
    if (!btn) return;
    // El botón puede tener un span#btn-notif-txt interior
    var span = btn.querySelector('#btn-notif-txt') || btn;
    span.textContent = label.replace(/^📲 ?/, '');
    btn.style.background = bg;
    btn.style.boxShadow = shadow;
  });
}


var _TODOS_PANELES = [
  'brujula-drawer','sos-drawer','meteo-drawer','historia-drawer',
  'poi-drawer','donaciones-drawer','comousar-drawer','contacto-drawer','album-drawer','album-panel','tablero-drawer','modal-add-poi','album-recuerdos-drawer'
];
function cerrarTodosLosPaneles() {
  var mapSection = document.querySelector('#map-block .map-section');
  _TODOS_PANELES.forEach(function(id) {
    var p = document.getElementById(id);
    if (p) p.classList.remove('slide-in');
  });
  if (mapSection) mapSection.classList.remove('slide-out');
  var _bt = document.getElementById('mapa-cat-panel-title');
  if (_bt) { _bt.style.display = 'none'; _bt.textContent = ''; }
}
function _abrirSlide(panelId) {
  var mapSection = document.querySelector('#map-block .map-section');
  var panel = document.getElementById(panelId);
  if (!mapSection || !panel) return;
  _TODOS_PANELES.forEach(function(id) {
    if (id !== panelId) {
      var p = document.getElementById(id);
      if (p) p.classList.remove('slide-in');
    }
  });
  // Reset barTitle before setting new one
  var _btReset = document.getElementById('mapa-cat-panel-title');
  if (_btReset) { _btReset.style.display = 'none'; _btReset.textContent = ''; }
  panel.scrollTop = 0;
  mapSection.classList.add('slide-out');
  panel.classList.add('slide-in');
  var _noCenter = ['album-panel','tablero-drawer','album-recuerdos-drawer','donaciones-drawer','comousar-drawer','contacto-drawer','poi-drawer'];
  if (_noCenter.indexOf(panelId) === -1) _centrarMapa();
  var _t = T[idiomaActual]||T.es;
  var _panelTitles = {
    "poi-drawer": "📍 "+(_t.navPuntos||'Ranking'),
    "album-panel": "🏅 "+(_t.rankingTitulo||'Ranking del Peregrino'),
    "tablero-drawer": (_t.coleccionTitulo||'🐚 Colección del Peregrino'),
    "album-recuerdos-drawer": "📷 "+(_t.btnAlbumRec||'Álbum'),
    "brujula-drawer": "🧭 "+(_t.navBrujula||'Brújula'),
    "meteo-drawer": "🌤️ "+(_t.meteoTitulo||'Previsión meteorológica'),
    "sos-drawer": "🆘 "+(_t.navEmergencias||'Emergencias').replace(/^🆘\s*/,''),
    "historia-drawer": (_t.navHistoria||'🐚 Historia Compostelana'),
    "donaciones-drawer": "❤️ "+(_t.navDonaciones||'Donaciones'),
    "comousar-drawer": "ℹ️ "+(_t.navComoUsar||'Cómo usar'),
    "contacto-drawer": "✉️ "+(_t.navContacto||'Contacto'),
    "modal-add-poi": "📌 "+(_t.addPoi||'Nuevo punto')
  };
  var barTitle = document.getElementById('mapa-cat-panel-title');
  if (barTitle) {
    barTitle.textContent = _panelTitles[panelId] || '';
    barTitle.style.display = 'flex';
  }
  // Bloquear scroll horizontal de la barra de chips mientras hay panel activo
  var catBar = document.getElementById('mapa-cat-bar');
  if (catBar) { catBar.style.overflowX = 'hidden'; catBar.style.touchAction = 'none'; }
}
function _cerrarSlide(panelId) {
  var mapSection = document.querySelector('#map-block .map-section');
  var panel = document.getElementById(panelId);
  if (!panel) return;
  var _noCenter2 = ['album-panel','tablero-drawer','album-recuerdos-drawer','donaciones-drawer','comousar-drawer','contacto-drawer','poi-drawer'];
  panel.classList.remove('slide-in');
  if (mapSection) mapSection.classList.remove('slide-out');
  if (_noCenter2.indexOf(panelId) === -1) setTimeout(_centrarMapa, 300);
  var barTitle = document.getElementById('mapa-cat-panel-title');
  if (barTitle) { barTitle.style.display = 'none'; barTitle.textContent = ''; }
  // Restaurar scroll horizontal de la barra de chips
  var catBar = document.getElementById('mapa-cat-bar');
  if (catBar) { catBar.style.overflowX = 'auto'; catBar.style.touchAction = ''; }
}

function _sincronizarChipAlertasPOI() {
  var chip = document.getElementById('chip-alerta-drawer');
  if (!chip) return;
  var hayVisibles = PUNTOS.some(function(p){ return p.esAlerta && !alertasOcultas[p.id]; });
  if (hayVisibles) {
    chip.style.display = 'inline-flex';
    if (!chip.classList.contains('active')) {
      chip.style.animation = 'chipAlertaPulse 1.2s ease-in-out infinite';
      chip.style.background = '#dc2626';
      chip.style.color = '#fff';
      chip.style.borderColor = '#dc2626';
    }
  } else {
    // Si el chip estaba activo (filtro seleccionado), volver a "todos"
    if (chip.classList.contains('active')) {
      chip.classList.remove('active');
      var todos = document.querySelector('#poi-drawer-filtros .cat-chip');
      if (todos) todos.classList.add('active');
      _poiDrawerCatActual = 'todos';
      _renderPoiDrawerCarrusel();
    }
    chip.style.display = 'none';
    chip.style.animation = '';
  }
}

function abrirComoUsarDrawer() { _abrirSlide('comousar-drawer'); cambiarIdioma(idiomaActual); }
function cerrarComoUsarDrawer() { _cerrarSlide('comousar-drawer'); }
var _albumPanelOrigen = null;
function abrirAlbumPanel(origen) {
  _albumPanelOrigen = origen || null;
  _abrirSlide('album-panel');
  cambiarIdioma(idiomaActual);
  var intentos = 0;
  function _intentarRender() {
    if (window._albumGetVisitas && window._getRango) {
      _renderAlbumPanel();
      // ── Modal resumen ranking si hay cromos pendientes ──
      setTimeout(function() {
        try {
          if (typeof _modalPergamino !== 'function') return;
          if (!window._ocaGetCromosConKeys || !window._albumGetVisitas) return;
          // Primero obtenemos el número de cromos abiertos para el rango
          window._albumGetVisitas(function(visitas) {
            var n = visitas ? visitas.filter(function(v){ return v && typeof v.num === 'number'; }).length : 0;
            // Luego comprobamos si hay cromos en el mazo
            window._ocaGetCromosConKeys(function(entries) {
              try {
                var mazo = entries.filter(function(e){ return e && e.item && !e.item.resuelto; });
                var abiertos = entries.filter(function(e){ return e && e.item && e.item.resuelto; });
                var numAb = {};
                abiertos.forEach(function(e){ numAb[e.item.num] = (numAb[e.item.num]||0)+1; });
                var casillas = Object.keys(numAb).length;
                if (mazo.length === 0) return;
                var t = (typeof T !== 'undefined' && T[idiomaActual]) ? T[idiomaActual] : {};
                var rango = window._getRango ? window._getRango(casillas) : null;
                var rangoTxt = rango ? ' ' + rango.emoji + ' <strong>' + rango.label + '</strong>.' : '';
                var nCromos = 'Tienes ' + casillas + ' casillas en tu tablero.' + rangoTxt;
                var mazoTxt = mazo.length === 1
                  ? '🎴 Tienes <strong>1 cromo sin abrir</strong> en tu mazo. ¡Ábrelo desde la sección Tablero de Juego!'
                  : '🎴 Tienes <strong>' + mazo.length + ' cromos sin abrir</strong> en tu mazo. ¡Ábrelos desde la sección Tablero de Juego!';
                _modalPergamino({
                  id: 'modal-ranking-aviso',
                  titulo: nCromos,
                  opciones: [{ emoji:'🎲', tit: 'Juego Oca — Abrir cromos del mazo', sub: 'Tablero de Juego', accion: function(){ _abrirColeccionDesdeRanking(); } }],
                  cancelTxt: t.cerrar || 'Cerrar',
                  extraHtml: '<div style="background:rgba(0,0,0,0.15);border-left:3px solid #c9a84c;border-radius:0 8px 8px 0;padding:10px 12px;font-size:13px;color:#1a0800;line-height:1.6">' + mazoTxt + '</div>'
                });
              } catch(e) { console.warn('modal-ranking inner:', e); }
            });
          });
        } catch(e) { console.warn('modal-ranking-aviso:', e); }
      }, 650);
    } else if (intentos++ < 20) {
      setTimeout(_intentarRender, 100);
    }
  }
  _intentarRender();
}
function abrirTableroDrawer() {
  window._tableroNeedsRefresh = false;
  _abrirSlide('tablero-drawer');
  // Defer para que slide-in esté aplicado antes de renderizar
  setTimeout(_renderTableroOca, 50);
}
function cerrarTableroDrawer() {
  _cerrarSlide('tablero-drawer');
  setTimeout(function() { _abrirSlide('album-panel'); _renderAlbumPanel(); }, 50);
}
function cerrarAlbumPanel() {
  _cerrarSlide('album-panel');
  if (_albumPanelOrigen === 'poi-drawer') {
    _albumPanelOrigen = null;
    setTimeout(function() { _abrirSlide('poi-drawer'); }, 50);
  }
}
function abrirContactoDrawer() { _abrirSlide('contacto-drawer'); cambiarIdioma(idiomaActual); }
function cerrarContactoDrawer() { _cerrarSlide('contacto-drawer'); }
function abrirAlbumDrawer() {
  _abrirModalAlbumRecuerdos();
}
function cerrarAlbumDrawer() { _cerrarSlide('album-drawer'); setTimeout(function() { _abrirSlide('poi-drawer'); }, 50); }

function _abrirModalAlbumRecuerdos() {
  var grid = document.getElementById('album-rec-grid');
  var vacio = document.getElementById('album-rec-vacio');
  if (grid) grid.innerHTML = '';
  _abrirSlide('album-recuerdos-drawer');
  if (grid && vacio) _renderAlbumRecuerdos(grid, vacio);
}

function _renderAlbumRecuerdos(grid, vacioCont) {
  if (!window._albumGetVisitas || !window._albumGetFoto) {
    vacioCont.style.display = 'block'; return;
  }
  var GENERIC = '';
  window._albumGetVisitas(function(visitas) {
    var poiVisitas = visitas.filter(function(v){ return v.poiId && !(v.poiId||'').startsWith('u_'); });
    var contador = document.getElementById('album-rec-contador');
    if (poiVisitas.length === 0) {
      vacioCont.style.display = 'block';
      if (contador) contador.textContent = 'Sin lugares visitados';
      return;
    }
    vacioCont.style.display = 'none';
    var nFotos = 0;
    // Ordenar por fecha desc
    poiVisitas.sort(function(a,b){ return (b.fecha||0)-(a.fecha||0); });
    var pending = poiVisitas.length;
    var results = new Array(poiVisitas.length);
    poiVisitas.forEach(function(v, idx) {
      window._albumGetFoto(v.poiId, function(blob) {
        results[idx] = { v: v, blob: blob };
        if (--pending === 0) {
          results.forEach(function(item) {
            var v2 = item.v, blob = item.blob;
            var hasOwn = !!blob;
            if (hasOwn) nFotos++;
            var src = hasOwn ? URL.createObjectURL(blob) : GENERIC;
            var d = new Date(v2.fecha || 0);
            var fechaTxt = d.toLocaleDateString('es-ES',{day:'2-digit',month:'2-digit',year:'numeric'})
              + ' · ' + d.toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'});
            var card = document.createElement('div');
            card.style.cssText = 'background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.1);border-radius:8px;overflow:hidden;display:flex;flex-direction:column';
            card.style.cursor='pointer';
            // Gradiente por categoría para casillas sin foto
            var _catBg = {
              'edificación religiosa':'135deg,#1a0e2e,#2d1050',
              'vestigio arqueológico':'135deg,#1a1a0a,#2d2d10',
              'albergue':'135deg,#0a1a2e,#0f2a40',
              'edificación histórica':'135deg,#1a0a0a,#2d1010',
              'localización histórica':'135deg,#0a1a0a,#102810',
              'monumento':'135deg,#1a0e1a,#2d1040',
              'etapa':'135deg,#0a1a2e,#0f2a40',
              'mirador':'135deg,#0a1a2e,#0f2040',
              'naturaleza':'135deg,#0a1a0a,#0f2010'
            };
            var _catBgVal = _catBg[v2.categoria] || '135deg,#1a0e2e,#2d1050';
            var imgBlock = hasOwn
              ? '<div style="position:relative;aspect-ratio:1/1;overflow:hidden"><img src="' + src + '" style="width:100%;height:100%;object-fit:cover;display:block" loading="lazy"></div>'
              : '<div style="position:relative;aspect-ratio:1/1;overflow:hidden;background:linear-gradient('+_catBgVal+');">'
                + '<div style="position:absolute;inset:0;background:radial-gradient(ellipse at 50% 50%,rgba(255,255,255,0.06) 0%,transparent 70%)"></div>'
                + '<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:6px">'
                + '<div style="font-size:26px;line-height:1;filter:drop-shadow(0 2px 6px rgba(0,0,0,0.5))">' + (v2.emoji||'📍') + '</div>'
                + '<div style="background:rgba(0,0,0,0.45);border:1px solid rgba(255,255,255,0.2);border-radius:12px;padding:5px 9px;backdrop-filter:blur(4px);text-align:center">'
                + '<div style="font-size:14px;margin-bottom:2px">📷</div>'
                + '<div style="font-size:9px;color:rgba(255,255,255,0.9);font-weight:700;letter-spacing:0.3px;line-height:1.3">Tu foto recuerdo aquí!</div>'
                + '</div></div></div>';
            card.innerHTML = imgBlock
              + '<div style="padding:3px 5px 4px">'
              + '<div style="font-size:7px;font-weight:700;color:#fff;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + (v2.nombre||v2.poiId||'') + '</div>'
              + '<div style="font-size:6px;color:rgba(255,255,255,0.35)">' + fechaTxt + '</div>'
              + '</div>';
            (function(hasFoto,imgSrc,nom,em,fecha2){
              card.addEventListener('click',function(){
                var lb=document.createElement('div');
                lb.style.cssText='position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.92);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:1rem;box-sizing:border-box';
                lb.innerHTML=(hasFoto?'<img src="'+imgSrc+'" style="max-width:100%;max-height:65vh;object-fit:contain;border-radius:8px">':'<div style="font-size:64px;margin-bottom:8px">'+em+'</div>')
                  +'<div style="margin-top:10px;text-align:center"><div style="font-size:14px;font-weight:700;color:#fff">'+em+' '+nom+'</div>'
                  +'<div style="font-size:11px;color:rgba(255,255,255,0.5);margin-top:3px">'+fecha2+'</div>'
                  +(hasFoto?'':'<div style="font-size:11px;color:rgba(255,255,255,0.35);margin-top:6px">📷 Sin foto asignada</div>')+'</div>'
                  +'<button onclick="this.parentNode.remove()" style="margin-top:14px;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.25);border-radius:20px;padding:7px 22px;color:#fff;font-size:13px;cursor:pointer;font-family:DM Sans,sans-serif">Cerrar</button>';
                lb.addEventListener('click',function(e){if(e.target===lb)lb.remove();});
                document.body.appendChild(lb);
              });
            })(hasOwn, src, v2.nombre||v2.poiId||'', v2.emoji||'📍', fechaTxt);
            // Botón cámara
            (function(pid, crd){
              var btnCam = document.createElement('button');
              btnCam.style.cssText = 'position:absolute;top:3px;right:3px;background:rgba(0,0,0,0.55);border:1px solid rgba(255,255,255,0.3);border-radius:50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:12px;color:#fff;backdrop-filter:blur(3px);z-index:2;padding:0';
              btnCam.textContent = '📷';
              btnCam.title = 'Añadir foto';
              btnCam.addEventListener('click', function(e){
                e.stopPropagation();
                window._albumPedirFotoCard ? window._albumPedirFotoCard(pid) : _albumPedirFoto(pid, crd);
                // Refresh grid after photo saved
                setTimeout(function(){
                  var g=document.getElementById('album-rec-grid');
                  var v=document.getElementById('album-rec-vacio');
                  if(g&&v&&window._renderAlbumRecuerdos){g.innerHTML='';_renderAlbumRecuerdos(g,v);}
                }, 1500);
              });
              // Make card position:relative for absolute button
              crd.style.position = 'relative';
              crd.appendChild(btnCam);
            })(v2.poiId, card);
            grid.appendChild(card);
          });
          if (contador) contador.textContent = poiVisitas.length + ' lugar' + (poiVisitas.length!==1?'es':'') + ' · ' + nFotos + ' foto' + (nFotos!==1?'s':'');
        }
      });
    });
  });
}

// Efecto typewriter para el casco asistente de la brújula: escribe el aviso
// letra a letra, anima el casco y reproduce su sonido, igual que el asistente.
function _brujulaCascoTypewriter() {
  var el = document.getElementById('brujula-casco-txt');
  var img = document.getElementById('brujula-casco-img');
  if (!el) return;
  var t = (typeof T!=='undefined' && T[idiomaActual]) ? T[idiomaActual] : (typeof T!=='undefined'?T.es:{});
  var html = t.brujulaAvisoFlechas || el.innerHTML;
  var text = html.replace(/<[^>]+>/g, '');
  if (!text) return;
  // Garantizar que el keyframe de la animación del casco existe
  if (!document.getElementById('_casc-pulse-style-global')) {
    var stG = document.createElement('style');
    stG.id = '_casc-pulse-style-global';
    stG.textContent = '@keyframes _casc-pulse{0%,100%{transform:scale(1) rotate(-3deg)}50%{transform:scale(1.08) rotate(3deg)}}';
    document.head.appendChild(stG);
  }
  // Cancelar cualquier typewriter previo de este casco
  if (window._brujulaTwTimer) { clearInterval(window._brujulaTwTimer); window._brujulaTwTimer = null; }
  var i = 0, speed = 34;
  function _render() {
    var vis  = text.slice(0, i);
    var hide = text.slice(i);
    el.innerHTML = (vis ? '<span>' + vis.replace(/&/g,'&amp;').replace(/</g,'&lt;') + '</span>' : '')
                 + (hide ? '<span style="visibility:hidden">' + hide.replace(/&/g,'&amp;').replace(/</g,'&lt;') + '</span>' : '');
  }
  _render();
  // Activar animación y sonido del casco mientras escribe
  if (img) img.style.animation = '_casc-pulse 2.4s ease-in-out infinite';
  if (window._cascoSonido) { try{ window._cascoSonido(text.length * speed); }catch(e){} }
  window._brujulaTwTimer = setInterval(function() {
    if (i < text.length) {
      i++;
      _render();
      if (text[i-1] !== ' ' && window._cascoTick) window._cascoTick();
    } else {
      clearInterval(window._brujulaTwTimer); window._brujulaTwTimer = null;
      el.innerHTML = html; // restaurar con <strong> y formato
      if (img) img.style.animation = 'none'; // el casco se detiene al acabar, como el asistente
      if (window._cascoSonidoStop) { try{ window._cascoSonidoStop(); }catch(e){} }
    }
  }, speed);
}

function abrirBrujulaDrawer() {
  _abrirSlide('brujula-drawer');
  cambiarIdioma(idiomaActual);
  // Restaurar el estado real del botón tras el reseteo de cambiarIdioma
  if (typeof window._sincronizarUIBrujula === 'function') window._sincronizarUIBrujula();
  // Lanzar el efecto typewriter del casco tras abrir el panel
  setTimeout(_brujulaCascoTypewriter, 350);
}
function cerrarBrujulaDrawer() { _cerrarSlide('brujula-drawer'); }
function abrirSOSDrawer() { _abrirSlide('sos-drawer'); cambiarIdioma(idiomaActual); }
function cerrarSOSDrawer() { _cerrarSlide('sos-drawer'); }
function abrirMeteoDrawer() {
  _abrirSlide('meteo-drawer');
  cambiarIdioma(idiomaActual);
  var lat=(typeof userLat!=='undefined'&&userLat)?userLat:42.2328;
  var lng=(typeof userLng!=='undefined'&&userLng)?userLng:-8.7226;
  var lugar=document.getElementById('meteo-drawer-lugar');
  if(lugar) lugar.textContent=(typeof userLat!=='undefined'&&userLat)?'Tu ubicación':'Vigo';
  _cargarMeteoDrawer(lat,lng);
}
function cerrarMeteoDrawer() { _cerrarSlide('meteo-drawer'); }
function abrirHistoriaDrawer() { _abrirSlide('historia-drawer'); cambiarIdioma(idiomaActual); }
function cerrarHistoriaDrawer() { _cerrarSlide('historia-drawer'); }
function abrirPoiDrawer() {
  _abrirSlide('poi-drawer');
  cambiarIdioma(idiomaActual);
  _poiDrawerCatActual = 'todos';
  document.querySelectorAll('#poi-drawer-filtros .cat-chip').forEach(function(c,i){ c.classList.toggle('active', i===0); });
  _renderPoiDrawerCarrusel();
  _sincronizarChipAlertasPOI();
  // Traducir chips del drawer al idioma actual
  var t=T[idiomaActual]||T.es;
  var el=document.getElementById('chip-todos-drawer');if(el)el.textContent=t.chipTodos2||'📍 Todos';
}
function cerrarPoiDrawer() { _cerrarSlide('poi-drawer'); }



function abrirDonacionesDrawer() { _abrirSlide('donaciones-drawer'); cambiarIdioma(idiomaActual); }
function cerrarDonacionesDrawer() { _cerrarSlide('donaciones-drawer'); }


var _drawersAbiertos = 0;
function _bloquearScroll() {
  _drawersAbiertos++;
  document.body.style.overflow = 'hidden';
}
function _desbloquearScroll() {
  _drawersAbiertos = Math.max(0, _drawersAbiertos - 1);
  if (_drawersAbiertos === 0) document.body.style.overflow = '';
}


function _poiDrawerToggleRuta(id, btn) {
  addToRoute(id);
  var enRuta = !!rutaPuntos.find(function(x){ return x.id === id; });
  var t = T[idiomaActual] || T.es;
  btn.textContent = enRuta ? (t.enRuta||'✓ En ruta') : (t.añadirRuta||'+ Añadir a ruta');
  btn.style.background = enRuta ? '#1D9E75' : 'rgba(255,255,255,0.92)';
  btn.style.color = enRuta ? '#fff' : '#0F6E56';
  btn.style.borderColor = enRuta ? '#1D9E75' : 'rgba(29,158,117,0.4)';
  _actualizarMiniGeneradorDrawer();
}
function _poiDrawerLlegar(lat, lng) {
  cerrarPoiDrawer();
  if (mapa && lat && lng) {
    mapa.setView([lat, lng], 16);
    setTimeout(function() {
      mapa.eachLayer(function(layer) {
        if (layer.getLatLng && layer._popup) {
          var ll = layer.getLatLng();
          if (Math.abs(ll.lat - lat) < 0.0002 && Math.abs(ll.lng - lng) < 0.0002) {
            layer.openPopup();
          }
        }
      });
    }, 400);
  }
}
function _actualizarMiniGeneradorDrawer() {
  var el = document.getElementById('poi-drawer-ruta-info');
  if (!el) return;
  if (rutaPuntos.length === 0) {
    el.innerHTML = '<div style="font-size:12px;color:var(--texto-suave);font-style:italic">Añade puntos desde las tarjetas</div>';
  } else {
    el.innerHTML = rutaPuntos.map(function(p, i) {
      return '<div style="display:flex;align-items:center;gap:6px;font-size:12px;padding:3px 0">'
        + '<span style="width:16px;height:16px;border-radius:50%;background:var(--verde);color:#fff;font-size:9px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0">' + (i+1) + '</span>'
        + '<span style="flex:1;color:var(--texto)">' + p.nombre + '</span></div>';
    }).join('');
  }
}

var _poiDrawerCatActual = 'todos';

function _poiDrawerFiltrar(chip, cat) {
  _poiDrawerCatActual = cat;
  document.querySelectorAll('#poi-drawer-filtros .cat-chip').forEach(function(c){ c.classList.remove('active'); });
  if (chip) chip.classList.add('active');
  // Parar latido al entrar en alertas; restaurarlo al salir si siguen habiendo alertas
  var chipAl = document.getElementById('chip-alerta-drawer');
  if (chipAl) {
    if (cat === 'alerta') {
      chipAl.style.animation = 'none';
    } else {
      var hayAlertas = typeof PUNTOS !== 'undefined' && PUNTOS.some(function(p){ return p.esAlerta && !alertasOcultas[p.id]; });
      chipAl.style.animation = hayAlertas ? 'chipAlertaPulse 1.2s ease-in-out infinite' : '';
    }
  }
  _renderPoiDrawerCarrusel();
}

function _renderPoiDrawerCarrusel() {
  var car = document.getElementById('poi-drawer-carousel');
  if (!car) return;
  var t = T[idiomaActual] || T.es;
  var _todosRaw = (typeof PUNTOS !== 'undefined' ? PUNTOS : []).concat(typeof PUNTOS_USUARIO !== 'undefined' ? PUNTOS_USUARIO : []);
  var _vistos = {};
  var todos = _todosRaw.filter(function(p){ if(_vistos[p.id]) return false; _vistos[p.id]=true; return true; });
  var filtrados = todos.filter(function(p) {
    if (_poiDrawerCatActual === 'todos') return !p.esUsuario && !(p.id && p.id.indexOf('u_')===0) && p.categoria !== 'etapa' && p.categoria !== 'busqueda' && !(window._albumVisitasSet && window._albumVisitasSet[p.id]);
    if (_poiDrawerCatActual === 'alerta') return p.esAlerta;
    if (_poiDrawerCatActual === 'etapa-costa') return p.categoria === 'etapa' && p.variante === 'costa';
    if (_poiDrawerCatActual === 'etapa-interior') return p.categoria === 'etapa' && p.variante === 'interior';
    if (_poiDrawerCatActual === 'etapa-frances') return p.categoria === 'etapa' && p.variante === 'frances';
    if (_poiDrawerCatActual === 'etapa-norte') return p.categoria === 'etapa' && p.variante === 'norte';
    if (_poiDrawerCatActual === 'etapa-primitivo') return p.categoria === 'etapa' && p.variante === 'primitivo';
    if (_poiDrawerCatActual === 'etapa-ingles') return p.categoria === 'etapa' && p.variante === 'ingles';
    if (_poiDrawerCatActual === 'etapa-frances') return p.categoria === 'etapa' && p.variante === 'frances';
    if (_poiDrawerCatActual === 'etapa-norte') return p.categoria === 'etapa' && p.variante === 'norte';
    if (_poiDrawerCatActual === 'etapa-primitivo') return p.categoria === 'etapa' && p.variante === 'primitivo';
    if (_poiDrawerCatActual === 'etapa-ingles') return p.categoria === 'etapa' && p.variante === 'ingles';
    if (_poiDrawerCatActual === 'album') return !!(window._albumVisitasSet && window._albumVisitasSet[p.id]);
    if (_poiDrawerCatActual === 'usuario') return !!(p.esUsuario || (p.id && p.id.indexOf('u_')===0));
    return (p.categoria || '') === _poiDrawerCatActual;
  });
  if (!filtrados.length) {
    if (_poiDrawerCatActual === 'album') {
      car.innerHTML = '<div style="width:100%;padding:2rem 1.5rem;text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center"><div style="font-size:36px;margin-bottom:10px">🐚</div><div style="color:rgba(255,255,255,0.75);font-size:13px;font-weight:600;margin-bottom:6px">Tu álbum está vacío</div><div style="color:rgba(255,255,255,0.4);font-size:12px;line-height:1.6;max-width:240px">Activa el seguimiento GPS y acércate a los puntos del Camino. Cada visita desbloquea el cromo.</div></div>';
    } else {
      car.innerHTML = '<div style="width:100%;padding:2rem 1.5rem;text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center"><div style="font-size:36px;margin-bottom:10px">🐚</div><div style="color:rgba(255,255,255,0.75);font-size:13px;font-weight:600;margin-bottom:6px">Ningún punto cerca</div><div style="color:rgba(255,255,255,0.4);font-size:12px;line-height:1.6;max-width:240px">No hay lugares de esta categoría en el radio actual. Amplía el radio o explora otra categoría del Camino.</div></div>';
    }
    return;
  }
  filtrados = filtrados.slice().sort(function(a, b) {
    var da = a.distancia !== undefined ? a.distancia : 999999;
    var db = b.distancia !== undefined ? b.distancia : 999999;
    return da - db;
  });
  var frag = document.createDocumentFragment();
  filtrados.slice(0, 20).forEach(function(p) {
    var distHtml = p.distancia !== undefined
      ? '<span class="poi-dist">&#128205; ' + (p.distancia < 1 ? Math.round(p.distancia*1000)+' m' : p.distancia.toFixed(1)+' km') + '</span>'
      : '<span class="poi-dist calculando">&#128205; ...</span>';
    if (!valoraciones[p.id]) valoraciones[p.id] = {total:0, votos:0, miVoto:0};
    if (!opiniones[p.id]) opiniones[p.id] = [];
    var val = valoraciones[p.id];
    var media = val.votos > 0 ? (val.total/val.votos).toFixed(1) : '-';
    var pageUrl = encodeURIComponent(window.location.href);
    var texto = encodeURIComponent(p.nombre + ' - Guia Compostelana de Vigo');
    var ops = opiniones[p.id];
    var opsList = ops.length
      ? ops.map(function(o){ return '<div class="opinion-item"><strong>'+esc(o.autor)+':</strong> '+esc(o.texto)+'</div>'; }).join('')
      : '<div class="opinion-item" style="color:#bbb">'+(T[idiomaActual]||T.es).seElPrimero+'</div>';
    var enRuta = rutaPuntos.find(function(x){ return x.id === p.id; });
    var card = document.createElement('div');
    card.className = 'poi-card';
    card.setAttribute('data-poi-id', p.id);
    var pNombre = idiomaActual==='gl'&&p.nombre_gl ? p.nombre_gl : idiomaActual==='en'&&p.nombre_en ? p.nombre_en : p.nombre;
    var pDesc   = idiomaActual==='gl'&&p.descripcion_gl ? p.descripcion_gl : idiomaActual==='en'&&p.descripcion_en ? p.descripcion_en : p.descripcion;
    var pSub    = idiomaActual==='gl'&&p.subtitulo_gl ? p.subtitulo_gl : idiomaActual==='en'&&p.subtitulo_en ? p.subtitulo_en : (p.subtitulo||'');
    // Render especial para tarjetas de etapa
    if (p.categoria === 'etapa') {
      var difColor = p.dificultad === 'Fácil' ? '#22c55e' : p.dificultad === 'Media' ? '#f59e0b' : '#ef4444';
      var _difMap = {'Fácil':{es:'Fácil',gl:'Fácil',en:'Easy'},'Media':{es:'Media',gl:'Media',en:'Moderate'},'Moderada':{es:'Moderada',gl:'Moderada',en:'Moderate'},'Media-Alta':{es:'Media-Alta',gl:'Media-Alta',en:'Medium-High'},'Difícil':{es:'Difícil',gl:'Difícil',en:'Hard'},'Muy difícil':{es:'Muy difícil',gl:'Moi difícil',en:'Very hard'}};
      var difLabel = (_difMap[p.dificultad]||{})[idiomaActual] || (_difMap[p.dificultad]||{}).es || p.dificultad;
      var _tv = T[idiomaActual]||T.es;
      var _varMap = {costa:_tv.varianteCosta||'🌊 Ruta Costa',interior:_tv.varianteInterior||'🥾 Ruta Interior',frances:_tv.varianteFrances||'🔴 Ruta Francés',norte:_tv.varianteNorte||'🟠 Ruta Norte',primitivo:_tv.variantePrimitivo||'🟣 Ruta Primitivo',ingles:_tv.varianteIngles||'🟡 Ruta Inglés'};
      var varianteLabel = _varMap[p.variante] || p.variante;
      card.innerHTML =
        '<div style="background:linear-gradient(135deg,'+(p.variante==='costa'?'#0f2e50 0%,#1a3d65 50%,#1e4d7a':'#1a3020 0%,#2d5a3d 50%,#1D9E75')+'  100%);height:90px;position:relative;overflow:hidden;display:flex;align-items:flex-end;padding:8px 10px">'+
          '<div style="position:absolute;top:0;left:0;right:0;bottom:0;background-image:linear-gradient(rgba(255,255,255,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.03) 1px,transparent 1px);background-size:20px 20px;pointer-events:none"></div>'+
          '<div style="position:relative;z-index:1">'+
            '<div style="font-size:10px;color:rgba(255,255,255,0.6);font-weight:500;letter-spacing:0.8px;text-transform:uppercase;margin-bottom:2px">'+varianteLabel+'</div>'+
            '<div style="font-family:Playfair Display,serif;font-size:13px;font-weight:600;color:#fff;line-height:1.2">'+pNombre+'</div>'+
          '</div>'+
        '</div>'+
        '<div class="poi-body" style="padding:0.6rem 0.75rem">'+
          '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">'+
            '<span style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:3px 8px;font-size:11px;font-weight:600;color:#0369a1">⬆ '+p.desnivel_pos+' m</span>'+
            '<span style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:3px 8px;font-size:11px;font-weight:600;color:#15803d">'+p.km+' km</span>'+
            '<span style="background:#fefce8;border:1px solid #fde68a;border-radius:8px;padding:3px 8px;font-size:11px;font-weight:600;color:'+difColor+'">'+difLabel+'</span>'+
          '</div>'+
          (pSub ? '<div class="poi-subtitulo" style="margin-bottom:6px">'+pSub+'</div>' : '')+
          '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">'+
            distHtml+
            '<button class="poi-btn" data-id="'+p.id+'" data-lat="'+p.lat+'" data-lng="'+p.lng+'">'+(T[idiomaActual]||T.es).comoLlegar+'</button>'+
          '</div>'+
          '<button class="poi-detail-btn" data-poi-id="'+p.id+'" style="margin-top:2px;width:100%;background:rgba(29,158,117,0.12);border:1px solid rgba(29,158,117,0.3);border-radius:8px;padding:5px 8px;font-size:11px;font-weight:600;color:var(--verde-oscuro);cursor:pointer;font-family:DM Sans,sans-serif">📖 '+(T[idiomaActual]||T.es).verDetalle+'</button>'+
        '</div>';
      frag.appendChild(card);
      // Listener Ver detalle para etapas
      var detailBtnEtapa = card.querySelector('.poi-detail-btn');
      if (detailBtnEtapa) detailBtnEtapa.addEventListener('click', function(e) {
        e.stopPropagation();
        _abrirPoiDetalle(p);
      });
      return;
    }
    card.innerHTML =
      (window._imgCromo ? window._imgCromo(p, enRuta, T, idiomaActual) : (p.imagen ? '<div class="poi-img '+p.color+'" style="position:relative;overflow:hidden">'+
        '<img src="'+p.imagen+'" alt="'+p.nombre+'" class="poi-img-cover" loading="lazy" decoding="async" fetchpriority="low"/>'+
      '</div>' : ''))+
      (!p.esUsuario ? '<div class="poi-ranking" id="rank-'+p.id+'" style="left:8px;right:auto">&#9733; '+(val.votos>0?media:'-')+'</div>' : '')+
      '<div class="poi-body">'+
        '<div class="poi-category">'+( p.categoria||'')+'</div>'+
        '<div class="poi-nombre-row"><span class="poi-emoji">'+p.emoji+'</span><span class="poi-nombre">'+pNombre+'</span></div>'+
        (pSub ? '<div class="poi-subtitulo">'+pSub+'</div>' : '')+
        (p.esAlerta
          ? '<div style="margin:4px 0 8px">'+distHtml+'</div>'
          : '<div style="display:flex;align-items:center;justify-content:space-between;margin:4px 0 8px">'+
              distHtml+
              '<button class="poi-btn" data-id="'+p.id+'" data-lat="'+p.lat+'" data-lng="'+p.lng+'">'+(T[idiomaActual]||T.es).comoLlegar+'</button>'+
            '</div>'
        )+
        '<p class="poi-desc" id="desc-'+p.id+'">'+pDesc+'</p>'+
        '<button class="poi-leer-mas" id="leer-mas-'+p.id+'">'+(T[idiomaActual]||T.es).leerMas+'</button>'+
        (!p.esUsuario ? '<div class="poi-stars"><div class="stars" id="stars-'+p.id+'"></div><span class="stars-count" id="scount-'+p.id+'">'+(val.votos>0?media+' &middot; '+val.votos+' votos':'')+'</span></div>' : '')+
        (!p.esUsuario ? '<div class="poi-share">'+
          '<a class="poi-share-btn" href="https://wa.me/?text='+texto+'%20'+pageUrl+'" target="_blank">&#128172;</a>'+
          '<a class="poi-share-btn" href="https://www.facebook.com/sharer/sharer.php?u='+pageUrl+'" target="_blank">&#128248;</a>'+
          '<a class="poi-share-btn" href="https://twitter.com/intent/tweet?text='+texto+'&url='+pageUrl+'" target="_blank">&#128038;</a>'+
          '<a class="poi-share-btn" href="https://t.me/share/url?url='+pageUrl+'&text='+texto+'" target="_blank">&#9992;</a>'+
        '</div>' : '')+
        (p.esAlerta || p.esUsuario ? '' :
          '<div class="poi-opiniones">'+
            '<div class="poi-opiniones-lista" id="ops-'+p.id+'">'+opsList+'</div>'+
            '<div class="opinion-form">'+
              '<input class="opinion-input" id="op-txt-'+p.id+'" type="text" placeholder="'+(T[idiomaActual]||T.es).opinionPlaceholder+'"/>'+
              '<button class="opinion-send" data-pid="'+p.id+'">'+(T[idiomaActual]||T.es).enviar+'</button>'+
            '</div>'+
          '</div>'
        )+
        '<div style="display:flex;gap:5px;margin-top:6px;flex-wrap:wrap">'+
          (!p.esAlerta && (p.esUsuario || !(window._albumVisitasSet && window._albumVisitasSet[p.id])) ? '<button id="rbtn-'+p.id+'" class="poi-ruta-btn" data-poi="'+p.id+'" style="flex:1;justify-content:center;font-size:11px;padding:5px 6px;border-radius:8px;background:'+(enRuta?'#1D9E75':'rgba(29,158,117,0.12)')+';color:'+(enRuta?'#fff':'#1D9E75')+';border:1px solid '+(enRuta?'#1D9E75':'rgba(29,158,117,0.4)')+'">'+
            (enRuta?'&#10003; '+((T[idiomaActual]||T.es).enRuta||'En ruta').replace('✓ ',''):('+ '+(T[idiomaActual]||T.es).añadirRuta||'+ a ruta'))+'</button>' : '')+
          '<button class="poi-detail-btn" data-poi-id="'+p.id+'" style="flex:1;background:var(--verde-claro);border:1px solid rgba(29,158,117,0.3);border-radius:8px;padding:5px 6px;font-size:11px;font-weight:600;color:var(--verde-oscuro);cursor:pointer;font-family:DM Sans,sans-serif;text-align:center">💬 '+(T[idiomaActual]||T.es).verDetalle+'</button>'+
        '</div>'+
        (p.esUsuario ? '<button data-poi-del="'+p.id+'" style="margin-top:5px;width:100%;background:rgba(239,68,68,0.08);color:#ef4444;border:1px solid rgba(239,68,68,0.3);border-radius:8px;padding:5px 8px;font-size:11px;font-weight:600;cursor:pointer;font-family:DM Sans,sans-serif">🗑️ Eliminar este punto</button>' : '')+
      '</div>';
    frag.appendChild(card);
    // Si ya tiene foto propia guardada, aplicarla
    if (window._albumGetFoto && window._albumVisitasSet && window._albumVisitasSet[p.id]) {
      (function(pid){ window._albumGetFoto(pid, function(blob) {
        if (!blob) return;
        var url = URL.createObjectURL(blob);
        var el = document.getElementById('cromo-img-'+pid); if (el) el.src = url;
        var btn = document.getElementById('foto-btn-'+pid); if (btn) btn.innerHTML = '✏️ cambiar';
        // Eliminar overlay 'Añade foto' ya que el usuario tiene foto propia
        var wrap = document.querySelector('[data-cromo-id="'+pid+'"]');
        if (wrap) { var ov = wrap.querySelector('div[style*="pointer-events:none"]'); if (ov) ov.remove(); }
      }); })(p.id);
    }
    if (!p.esUsuario) { var starsContainer = card.querySelector('.stars');
    if (starsContainer) {
      starsContainer.innerHTML = '';
      for (var sn = 1; sn <= 5; sn++) {
        var star = document.createElement('span');
        star.innerHTML = sn <= val.miVoto ? '&#9733;' : '&#9734;';
        star.className = sn <= val.miVoto ? 'star activa' : 'star';
        star.setAttribute('data-id', p.id);
        star.setAttribute('data-n', sn);
        star.setAttribute('data-star', '1');
        starsContainer.appendChild(star);
      }
    } }
    var sendBtn = card.querySelector('.opinion-send');
    if (sendBtn) sendBtn.addEventListener('click', function(e) { e.stopPropagation(); enviarOpinion(sendBtn); });
    var opInput = card.querySelector('.opinion-input');
    if (opInput) opInput.addEventListener('click', function(e) { e.stopPropagation(); });
    var leerMasBtn = card.querySelector('.poi-leer-mas');
    if (leerMasBtn) {
      leerMasBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        var descEl = card.querySelector('.poi-desc');
        if (!descEl) return;
        var open = descEl.classList.contains('expanded');
        descEl.classList.toggle('expanded', !open);
        leerMasBtn.textContent = open ? (T[idiomaActual]||T.es).leerMas : (T[idiomaActual]||T.es).leerMenos;
      });
    }
    var llegarBtn = card.querySelector('.poi-btn');
    if (llegarBtn) llegarBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      cerrarPoiDrawer();
      irDesdeCarrusel(llegarBtn.getAttribute('data-id') || '');
    });
    var detailBtn = card.querySelector('.poi-detail-btn');
    if (detailBtn) detailBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      _abrirPoiDetalle(p);
    });
    var rutaBtn = card.querySelector('.poi-ruta-btn');
    if (rutaBtn) rutaBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      _poiDrawerToggleRuta(p.id, rutaBtn);
    });
  });
  car.innerHTML = '';
  car.appendChild(frag);
  // Sincronizar botones ruta con estado actual
  var t2 = T[idiomaActual] || T.es;
  car.querySelectorAll('.poi-ruta-btn').forEach(function(btn) {
    var id = btn.getAttribute('data-poi');
    var enRuta = !!rutaPuntos.find(function(x){ return x.id === id; });
    btn.classList.toggle('en-ruta', enRuta);
    btn.innerHTML = enRuta ? '&#10003; '+t2.enRuta.replace('✓ ','') : t2.añadirRuta;
    btn.style.background = enRuta ? '#1D9E75' : 'rgba(255,255,255,0.92)';
    btn.style.color      = enRuta ? '#fff' : '#0F6E56';
    btn.style.border     = enRuta ? '1px solid #1D9E75' : '1px solid rgba(29,158,117,0.4)';
  });
}

function _abrirRutaModal() {
  var existing = document.getElementById('poi-ruta-modal');
  if (existing) existing.remove();

  function _rutaInfoHtml() {
    if (rutaPuntos.length === 0) {
      return '<div style="font-size:12px;color:var(--texto-suave);font-style:italic">Añade puntos desde las tarjetas o el mapa</div>';
    }
    return rutaPuntos.map(function(p, i) {
      return '<div style="display:flex;align-items:center;gap:6px;font-size:12px;padding:3px 0">'
        + '<span style="width:16px;height:16px;border-radius:50%;background:var(--verde);color:#fff;font-size:9px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0">' + (i+1) + '</span>'
        + '<span style="flex:1;color:var(--texto)">' + p.nombre + '</span>'
        + '<button data-rid="' + p.id + '" style="background:none;border:none;color:#dc2626;font-size:14px;cursor:pointer;padding:0 2px;flex-shrink:0" title="Quitar">✕</button>'
        + '</div>';
    }).join('');
  }

  var modal = document.createElement('div');
  modal.id = 'poi-ruta-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:9800;background:rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;padding:1rem;box-sizing:border-box';
  modal.innerHTML =
    '<div style="background:#fff;border-radius:16px;max-width:320px;width:100%;box-shadow:0 8px 32px rgba(0,0,0,0.2);font-family:DM Sans,sans-serif;overflow:hidden">'+
      '<div style="padding:1rem 1rem 0.75rem;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--borde)">'+
        '<div style="display:flex;align-items:center;gap:7px">'+
          '<span style="font-size:18px">🗺️</span>'+
          '<span style="font-family:Playfair Display,serif;font-size:16px;font-weight:600;color:var(--texto)">Ruta</span>'+
        '</div>'+
        '<button id="ruta-modal-close" style="background:var(--verde-claro);border:none;border-radius:50%;width:28px;height:28px;font-size:15px;cursor:pointer;color:var(--verde-oscuro);display:flex;align-items:center;justify-content:center">✕</button>'+
      '</div>'+
      '<div style="padding:0.9rem 1rem 1rem">'+
        '<div id="ruta-modal-info" style="margin-bottom:0.75rem;max-height:140px;overflow-y:auto">'+_rutaInfoHtml()+'</div>'+
        '<div style="display:flex;gap:8px">'+
          '<button id="ruta-modal-mapa" style="flex:1;background:var(--verde);color:#fff;border:none;padding:9px 8px;border-radius:20px;font-size:13px;font-weight:600;cursor:pointer;font-family:DM Sans,sans-serif">🗺️ Mapa</button>'+
          '<button id="ruta-modal-ir" style="flex:1;background:var(--verde);color:#fff;border:none;padding:9px 8px;border-radius:20px;font-size:13px;font-weight:600;cursor:pointer;font-family:DM Sans,sans-serif">▶ Ir</button>'+
          '<button id="ruta-modal-limpiar" style="background:none;border:1px solid #fca5a5;color:#dc2626;padding:9px 12px;border-radius:20px;font-size:15px;cursor:pointer">🗑</button>'+
        '</div>'+
      '</div>'+
    '</div>';
  document.body.appendChild(modal);

  // Quitar punto individual
  modal.querySelector('#ruta-modal-info').addEventListener('click', function(e) {
    var rid = e.target.getAttribute('data-rid');
    if (rid) {
      quitarDeRuta(rid);
      _actualizarMiniGeneradorDrawer();
      var inf = modal.querySelector('#ruta-modal-info');
      if (inf) inf.innerHTML = _rutaInfoHtml();
    }
  });
  modal.querySelector('#ruta-modal-close').addEventListener('click', function() { modal.remove(); });
  modal.addEventListener('click', function(e) { if (e.target === modal) modal.remove(); });
  modal.querySelector('#ruta-modal-mapa').addEventListener('click', function() { modal.remove(); cerrarPoiDrawer(); irAlMapaConRuta(); });
  modal.querySelector('#ruta-modal-ir').addEventListener('click', function() { modal.remove(); cerrarPoiDrawer(); iniciarRuta(); });
  modal.querySelector('#ruta-modal-limpiar').addEventListener('click', function() {
    limpiarRuta();
    _actualizarMiniGeneradorDrawer();
    document.querySelectorAll('#poi-drawer-carousel .poi-ruta-btn').forEach(function(b){
      var _t=T[idiomaActual]||T.es;b.textContent=_t.añadirRuta||'+ Añadir a ruta';b.style.background='rgba(255,255,255,0.92)';b.style.color='#0F6E56';b.style.borderColor='rgba(29,158,117,0.4)';
    });
    var inf = modal.querySelector('#ruta-modal-info');
    if (inf) inf.innerHTML = _rutaInfoHtml();
  });
}

function _abrirPoiDetalle(p) {
  var existing = document.getElementById('poi-detalle-modal');
  if (existing) existing.remove();
  var val = valoraciones[p.id] || {total:0, votos:0, miVoto:0};
  var media = val.votos > 0 ? (val.total/val.votos).toFixed(1) : '-';
  var ops = opiniones[p.id] || [];
  var opsList = ops.length
    ? ops.map(function(o){ return '<div class="opinion-item"><strong>'+esc(o.autor)+':</strong> '+esc(o.texto)+'</div>'; }).join('')
    : '<div class="opinion-item" style="color:#bbb">'+(T[idiomaActual]||T.es).seElPrimero+'</div>';
  var t = T[idiomaActual] || T.es;
  var pNombre = idiomaActual==='gl'&&p.nombre_gl ? p.nombre_gl : idiomaActual==='en'&&p.nombre_en ? p.nombre_en : p.nombre;
  var pDesc   = idiomaActual==='gl'&&p.descripcion_gl ? p.descripcion_gl : idiomaActual==='en'&&p.descripcion_en ? p.descripcion_en : p.descripcion;
  var pageUrl = encodeURIComponent(window.location.href);
  var texto = encodeURIComponent(p.nombre + ' - Guia Compostelana de Vigo');

  var modal = document.createElement('div');
  modal.id = 'poi-detalle-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:9800;background:rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;padding:1rem;box-sizing:border-box';
  modal.innerHTML =
    '<div style="background:#fff;border-radius:16px;max-width:360px;width:100%;max-height:80vh;overflow-y:auto;box-shadow:0 8px 32px rgba(0,0,0,0.25);font-family:DM Sans,sans-serif">'+
      '<div style="padding:1rem 1rem 0;display:flex;align-items:flex-start;justify-content:space-between;gap:8px">'+
        '<div>'+
          '<div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:var(--verde);font-weight:500;margin-bottom:3px">'+p.emoji+' '+(p.categoria||'')+'</div>'+
          '<div style="font-size:17px;font-weight:600;color:var(--texto);line-height:1.3">'+pNombre+'</div>'+
        '</div>'+
        '<button id="poi-detalle-close" style="background:var(--verde-claro);border:none;border-radius:50%;width:30px;height:30px;font-size:16px;cursor:pointer;color:var(--verde-oscuro);flex-shrink:0;display:flex;align-items:center;justify-content:center">✕</button>'+
      '</div>'+
      (p.categoria==='etapa' ?
        '<div style="display:flex;gap:6px;flex-wrap:wrap;padding:0.5rem 1rem 0">'+
          '<span style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:3px 8px;font-size:11px;font-weight:600;color:#0369a1">⬆ '+p.desnivel_pos+' m</span>'+
          '<span style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:3px 8px;font-size:11px;font-weight:600;color:#15803d">'+p.km+' km</span>'+
          '<span style="background:#fefce8;border:1px solid #fde68a;border-radius:8px;padding:3px 8px;font-size:11px;font-weight:600;color:#a16207">'+((({'Fácil':{es:'Fácil',gl:'Fácil',en:'Easy'},'Media':{es:'Media',gl:'Media',en:'Moderate'},'Moderada':{es:'Moderada',gl:'Moderada',en:'Moderate'},'Media-Alta':{es:'Media-Alta',gl:'Media-Alta',en:'Medium-High'},'Difícil':{es:'Difícil',gl:'Difícil',en:'Hard'},'Muy difícil':{es:'Muy difícil',gl:'Moi difícil',en:'Very hard'}})[p.dificultad]||{})[idiomaActual]||p.dificultad||'')+'</span>'+
        '</div>' : '')+
      '<div style="padding:0.75rem 1rem;font-size:13px;color:#444;line-height:1.7">'+pDesc+'</div>'+
      '<div style="padding:0 1rem 0.5rem;display:flex;align-items:center;gap:8px">'+
        '<div class="stars" id="detalle-stars-'+p.id+'"></div>'+
        '<span class="stars-count" id="detalle-scount-'+p.id+'">'+(val.votos>0?media+' &middot; '+val.votos+' votos':'')+'</span>'+
      '</div>'+
      '<div style="padding:0 1rem 0.5rem;display:flex;gap:6px">'+
        '<a class="poi-share-btn" href="https://wa.me/?text='+texto+'%20'+pageUrl+'" target="_blank">&#128172;</a>'+
        '<a class="poi-share-btn" href="https://www.facebook.com/sharer/sharer.php?u='+pageUrl+'" target="_blank">&#128248;</a>'+
        '<a class="poi-share-btn" href="https://twitter.com/intent/tweet?text='+texto+'&url='+pageUrl+'" target="_blank">&#128038;</a>'+
        '<a class="poi-share-btn" href="https://t.me/share/url?url='+pageUrl+'&text='+texto+'" target="_blank">&#9992;</a>'+
      '</div>'+
      (!p.esAlerta ?
        '<div style="padding:0 1rem 1rem">'+
          '<div class="poi-opiniones-lista" id="detalle-ops-'+p.id+'" style="max-height:100px;overflow-y:auto;margin-bottom:8px">'+opsList+'</div>'+
          '<div class="opinion-form">'+
            '<input class="opinion-input" id="detalle-op-txt-'+p.id+'" type="text" placeholder="'+t.opinionPlaceholder+'"/>'+
            '<button class="opinion-send" id="detalle-op-send-'+p.id+'">'+t.enviar+'</button>'+
          '</div>'+
        '</div>' : '<div style="height:1rem"></div>'
      )+
    '</div>';

  document.body.appendChild(modal);

  // Estrellas
  var starsEl = modal.querySelector('#detalle-stars-'+p.id);
  if (starsEl) {
    for (var sn = 1; sn <= 5; sn++) {
      var star = document.createElement('span');
      star.innerHTML = sn <= val.miVoto ? '&#9733;' : '&#9734;';
      star.className = sn <= val.miVoto ? 'star activa' : 'star';
      star.setAttribute('data-id', p.id); star.setAttribute('data-n', sn); star.setAttribute('data-star', '1');
      starsEl.appendChild(star);
    }
  }
  // Enviar opinión
  var sendBtn = modal.querySelector('#detalle-op-send-'+p.id);
  if (sendBtn) sendBtn.addEventListener('click', function(e) { e.stopPropagation(); enviarOpinion(sendBtn); });
  var opInput = modal.querySelector('#detalle-op-txt-'+p.id);
  if (opInput) opInput.addEventListener('click', function(e) { e.stopPropagation(); });
  // Cerrar
  modal.querySelector('#poi-detalle-close').addEventListener('click', function() { modal.remove(); });
  modal.addEventListener('click', function(e) { if (e.target === modal) modal.remove(); });
}

function _cargarMeteoDrawer(lat,lng) {
  var url='https://api.open-meteo.com/v1/forecast?latitude='+lat+'&longitude='+lng+
    '&hourly=temperature_2m,weathercode,precipitation_probability,windspeed_10m'+
    '&daily=temperature_2m_max,temperature_2m_min,weathercode,precipitation_sum,windspeed_10m_max'+
    '&timezone=Europe/Madrid&forecast_days=2';
  var xhr=new XMLHttpRequest(); xhr.open('GET',url,true);
  xhr.onreadystatechange=function(){
    if(xhr.readyState!==4||xhr.status!==200) return;
    try {
      var data=JSON.parse(xhr.responseText);
      var now=new Date(); var ha=now.getHours();
      var times=data.hourly.time; var ci=0;
      for(var i=0;i<times.length;i++){if(parseInt(times[i].split('T')[1])===ha){ci=i;break;}}
      // Guardar datos clave para el asistente
      window._meteoActual = {
        temp: Math.round(data.hourly.temperature_2m[ci]),
        code: data.hourly.weathercode[ci],
        prob: data.hourly.precipitation_probability[ci],
        hora: ha,
        maxT: data.daily ? Math.round(data.daily.temperature_2m_max[0]) : null,
        minT: data.daily ? Math.round(data.daily.temperature_2m_min[0]) : null,
        icon: (typeof WMO_ICONS!=='undefined'&&WMO_ICONS[data.hourly.weathercode[ci]]) ? WMO_ICONS[data.hourly.weathercode[ci]] : '🌡️'
      };
      var horasEl=document.getElementById('meteo-drawer-horas');
      if(horasEl){
        var html='';
        for(var j=0;j<8;j++){
          var idx=ci+j; if(idx>=times.length) break;
          var hora=times[idx].split('T')[1].substring(0,5);
          var temp=Math.round(data.hourly.temperature_2m[idx]);
          var code=data.hourly.weathercode[idx];
          var prob=data.hourly.precipitation_probability[idx];
          var wind=Math.round(data.hourly.windspeed_10m[idx]);
          var icon=(typeof WMO_ICONS!=='undefined'&&WMO_ICONS[code])?WMO_ICONS[code]:'&#127777;';
          var lbl=j===0?'Ahora':hora;
          var al=j===0?'0.15':'0.08'; var alb=j===0?'0.25':'0.1';
          html+='<div style="flex-shrink:0;background:rgba(255,255,255,'+al+');border-radius:10px;padding:6px 10px;text-align:center;min-width:52px;border:1px solid rgba(255,255,255,'+alb+')">'
            +'<div style="font-size:9px;font-weight:600;color:rgba(255,255,255,0.5);margin-bottom:2px">'+lbl+'</div>'
            +'<div style="font-size:18px;margin-bottom:2px">'+icon+'</div>'
            +'<div style="font-size:13px;font-weight:700;color:#fff">'+temp+'&#176;</div>'
            +(prob>15?'<div style="font-size:9px;color:#60a5fa;margin-top:1px">&#128167;'+prob+'%</div>':'')
            +'<div style="font-size:9px;color:rgba(255,255,255,0.4);margin-top:1px">&#128168;'+wind+'</div>'
            +'</div>';
        }
        horasEl.innerHTML=html;
      }
      var resEl=document.getElementById('meteo-drawer-resumen');
      var resC=document.getElementById('meteo-drawer-resumen-content');
      if(resEl&&resC&&data.daily){
        var maxT=Math.round(data.daily.temperature_2m_max[0]);
        var minT=Math.round(data.daily.temperature_2m_min[0]);
        var prec=data.daily.precipitation_sum[0];
        var wMax=Math.round(data.daily.windspeed_10m_max[0]);
        var dIcon=(typeof WMO_ICONS!=='undefined'&&WMO_ICONS[data.daily.weathercode[0]])?WMO_ICONS[data.daily.weathercode[0]]:'';
        resC.innerHTML='<div style="color:rgba(255,255,255,0.85);font-size:13px">'+dIcon+' '+maxT+'&#176; / '+minT+'&#176;</div>'
          +'<div style="color:#60a5fa;font-size:13px">&#128167; '+(prec>0?prec.toFixed(1)+' mm':'Sin lluvia')+'</div>'
          +'<div style="color:rgba(255,255,255,0.6);font-size:13px">&#128168; '+wMax+' km/h m&#225;x</div>';
        resEl.style.display='block';
      }
      // ── Casco animado con mensaje contextual ────────────────────
      _meteoMensajeCasco(window._meteoActual);
    } catch(e){
      var h2=document.getElementById('meteo-drawer-horas');
      if(h2) h2.innerHTML='<div style="color:rgba(255,255,255,0.4);font-size:13px">No se pudieron cargar los datos</div>';
      _meteoMensajeCasco(null);
    }
  };
  xhr.send();
}

function _meteoMensajeCasco(m) {
  var txtEl = document.getElementById('meteo-casco-txt');
  var imgEl = document.getElementById('meteo-casco-img');
  if (!txtEl || !imgEl) return;

  var now = new Date();
  var dias = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
  var diasGL = ['domingo','luns','martes','mércores','xoves','venres','sábado'];
  var diasEN = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  var meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  var mesesGL = ['xaneiro','febreiro','marzo','abril','maio','xuño','xullo','agosto','setembro','outubro','novembro','decembro'];
  var mesesEN = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  var diaIdx = now.getDay(); var diaMes = now.getDate(); var mesIdx = now.getMonth();
  var lang = (typeof idiomaActual !== 'undefined') ? idiomaActual : 'es';
  var diaNom = lang==='gl' ? diasGL[diaIdx] : lang==='en' ? diasEN[diaIdx] : dias[diaIdx];
  var mesNom = lang==='gl' ? mesesGL[mesIdx] : lang==='en' ? mesesEN[mesIdx] : meses[mesIdx];
  var fechaTxt = lang==='en' ? diaNom+', '+mesNom+' '+diaMes : diaNom+' '+diaMes+' de '+mesNom;

  var msg;
  if (!m) {
    var sinMeteo = {
      es: ['¡Buen '+fechaTxt+'! El Camino te espera.','Feliz '+fechaTxt+'. ¿Damos el primer paso hoy?','¡Hoy es '+fechaTxt+'! Un buen día para explorar.'],
      gl: ['¡Bo '+fechaTxt+'! O Camiño agárdache.','Bo '+fechaTxt+'. ¿Damos o primeiro paso hoxe?','¡Hoxe é '+fechaTxt+'! Un bo día para explorar.'],
      en: ['Happy '+fechaTxt+'! The Way awaits.','Good '+fechaTxt+'. Shall we take the first step today?','Today is '+fechaTxt+'! A good day to explore.']
    };
    var arr = sinMeteo[lang] || sinMeteo.es;
    msg = arr[Math.floor(Math.random()*arr.length)];
  } else {
    var icon = m.icon || '🌡️';
    var temp = m.temp + '°';
    var lluvia = m.prob > 50;
    var frio = m.temp < 10;
    var calor = m.temp > 26;
    var horaStr = m.hora !== undefined ? m.hora + ':00h' : null;
    var h  = horaStr ? 'a las '+horaStr : 'en las próximas horas';
    var hEN = horaStr ? 'at '+horaStr : 'in the next few hours';
    var hGL = horaStr ? 'ás '+horaStr : 'nas próximas horas';
    if (lang === 'en') {
      if (lluvia)   msg = fechaTxt+' · '+icon+' Forecast for '+hEN+': '+temp+' with '+m.prob+'% chance of rain. Pack your waterproof cape and watch your step on wet stone paths.';
      else if (frio) msg = fechaTxt+' · '+icon+' '+temp+' expected '+hEN+'. Dress in layers and bring a windproof jacket — it will make a real difference on the route.';
      else if (calor) msg = fechaTxt+' · '+icon+' '+temp+' forecast '+hEN+'. Keep water close, cover your head and plan your rest stops in the shade.';
      else           msg = fechaTxt+' · '+icon+' '+temp+' forecast '+hEN+' — ideal walking weather. Enjoy the Camino, pilgrim!';
    } else if (lang === 'gl') {
      if (lluvia)   msg = fechaTxt+' · '+icon+' Previsión '+hGL+': '+temp+' con '+m.prob+'% de choiva. Leva o chuvasqueiro e coidado cos camiños de pedra mollados.';
      else if (frio) msg = fechaTxt+' · '+icon+' '+temp+' previstos '+hGL+'. Vai en capas e leva un cortalventos — notarase moito na ruta.';
      else if (calor) msg = fechaTxt+' · '+icon+' '+temp+' previstos '+hGL+'. Leva auga, tapa a cabeza e para á sombra cando poidas.';
      else           msg = fechaTxt+' · '+icon+' '+temp+' previstos '+hGL+' — tempo ideal para camiñar. ¡Bo Camiño, peregrino!';
    } else {
      if (lluvia)   msg = fechaTxt+' · '+icon+' Previsión '+h+': '+temp+' con '+m.prob+'% de lluvia. Lleva el chubasquero y cuidado con los caminos de piedra mojados.';
      else if (frio) msg = fechaTxt+' · '+icon+' '+temp+' previstos '+h+'. Abrígate en capas y lleva un cortavientos — lo notarás en el camino.';
      else if (calor) msg = fechaTxt+' · '+icon+' '+temp+' previstos '+h+'. Lleva agua, cúbrete la cabeza y busca sombra en las paradas.';
      else           msg = fechaTxt+' · '+icon+' '+temp+' previstos '+h+' — tiempo ideal para caminar. ¡Buen Camino, peregrino!';
    }
  }

  imgEl.style.animation = '_casc-pulse 2.4s ease-in-out infinite';
  var i = 0;
  function _renderMeteo() {
    var vis  = msg.slice(0, i);
    var hide = msg.slice(i);
    txtEl.innerHTML = (vis  ? '<span>' + vis.replace(/&/g,'&amp;').replace(/</g,'&lt;') + '</span>' : '')
                    + (hide ? '<span style="visibility:hidden">' + hide.replace(/&/g,'&amp;').replace(/</g,'&lt;') + '</span>' : '');
  }
  _renderMeteo();
  var iv = setInterval(function() {
    if (i < msg.length) {
      i++;
      _renderMeteo();
    } else {
      clearInterval(iv);
      txtEl.textContent = msg;
      imgEl.style.animation = 'none';
    }
  }, 22);
}



// Tags OSM para búsqueda por Overpass
var _OVERPASS_TAGS = {
  'farmacia':     '[amenity=pharmacy]',
  'pharmacy':     '[amenity=pharmacy]',
  'farmacias':    '[amenity=pharmacy]',
  'hospital':     '[amenity=hospital]',
  'hospitales':   '[amenity=hospital]',
  'urgencias':    '[amenity=hospital]',
  'médico':       '[amenity=doctors]',
  'medico':       '[amenity=doctors]',
  'albergue':     '[tourism=hostel]',
  'albergues':    '[tourism=hostel]',
  'hostel':       '[tourism=hostel]',
  'hotel':        '[tourism=hotel]',
  'hoteles':      '[tourism=hotel]',
  'pensión':      '[tourism=guest_house]',
  'pension':      '[tourism=guest_house]',
  'supermercado': '[shop=supermarket]',
  'supermercados':'[shop=supermarket]',
  'mercadona':    '[shop=supermarket]',
  'tienda':       '[shop]',
  'tiendas':      '[shop]',
  'cafetería':    '[amenity=cafe]',
  'cafeteria':    '[amenity=cafe]',
  'café':         '[amenity=cafe]',
  'cafe':         '[amenity=cafe]',
  'restaurante':  '[amenity=restaurant]',
  'restaurantes': '[amenity=restaurant]',
  'bar':          '[amenity=bar]',
  'bares':        '[amenity=bar]',
  'cajero':       '[amenity=atm]',
  'cajeros':      '[amenity=atm]',
  'atm':          '[amenity=atm]',
  'banco':        '[amenity=bank]',
  'bancos':       '[amenity=bank]',
  'gasolinera':   '[amenity=fuel]',
  'gasolineras':  '[amenity=fuel]',
  'parking':      '[amenity=parking]',
  'aparcamiento': '[amenity=parking]',
  'iglesia':      '[amenity=place_of_worship][religion=christian]',
  'iglesias':     '[amenity=place_of_worship][religion=christian]',
  'correos':      '[amenity=post_office]',
  'lavandería':   '[shop=laundry]',
  'lavanderia':   '[shop=laundry]',
  'agua':         '[amenity=drinking_water]',
  'fuente':       '[amenity=drinking_water]',
  'fuentes':      '[amenity=drinking_water]',
  'baños':        '[amenity=toilets]',
  'aseos':        '[amenity=toilets]',
  'wc':           '[amenity=toilets]',
  'veterinario':  '[amenity=veterinary]',
  'taxi':         '[amenity=taxi]',
  'panadería':    '[shop=bakery]',
  'panaderia':    '[shop=bakery]',
  'pan':          '[shop=bakery]',
  'frutería':     '[shop=greengrocer]',
  'fruteria':     '[shop=greengrocer]',
  'carnicería':   '[shop=butcher]',
  'carniceria':   '[shop=butcher]',
  'estanco':      '[shop=tobacco]',
  'tabaco':       '[shop=tobacco]',
  'quiosco':      '[shop=newsagent]',
  'librería':     '[shop=books]',
  'libreria':     '[shop=books]',
  'ferretería':   '[shop=hardware]',
  'ferreteria':   '[shop=hardware]',
  'camping':      '[tourism=camp_site]',
  'campings':     '[tourism=camp_site]',
  'tienda camping':'[shop=outdoor]',
  'dentista':     '[amenity=dentist]',
  'dentistas':    '[amenity=dentist]',
  'óptica':       '[shop=optician]',
  'optica':       '[shop=optician]',
  'peluquería':   '[shop=hairdresser]',
  'peluqueria':   '[shop=hairdresser]',
  'bicicleta':    '[shop=bicycle]',
  'bici':         '[shop=bicycle]',
  'bicicletas':   '[shop=bicycle]',
  'taller':       '[shop=bicycle]',
  'zapatería':    '[shop=shoes]',
  'zapateria':    '[shop=shoes]',
  'ropa':         '[shop=clothes]',
  'polideportivo':'[leisure=sports_centre]',
  'piscina':      '[leisure=swimming_pool]',
  'oficina turismo':'[tourism=information]',
  'turismo':      '[tourism=information]',
  'información':  '[tourism=information]',
  'wifi':         '[internet_access=wlan]',
  'monumento':    '[historic=monument]',
  'monumentos':   '[historic=monument]',
  'ruinas':       '[historic=ruins]',
};

function ejecutarBusquedaMapa() {
  var input = document.getElementById('buscar-mapa-strip-input');
  if (!input || !input.value.trim()) return;
  var q = input.value.trim().toLowerCase();
  searchMarkers.forEach(function(m){ mapa.removeLayer(m); }); searchMarkers = [];

  var refLat = userLat || mapa.getCenter().lat;
  var refLng = userLng || mapa.getCenter().lng;
  var osmTag = _OVERPASS_TAGS[q];

  // Función Nominatim compartida para ejecutarBusquedaMapa
  function _buscarNominatimMapa(termino) {
    var d2 = 0.03;
    var url2n = 'https://nominatim.openstreetmap.org/search?format=json&limit=8&q=' +
      encodeURIComponent(termino) + '&accept-language=es' +
      '&viewbox='+(refLng-d2)+','+(refLat+d2)+','+(refLng+d2)+','+(refLat-d2)+'&bounded=1';
    var xhr2n = new XMLHttpRequest();
    xhr2n.open('GET', url2n, true);
    xhr2n.onreadystatechange = function() {
      if (xhr2n.readyState !== 4) return;
      if (xhr2n.status === 200) {
        try {
          var res2n = JSON.parse(xhr2n.responseText);
          if (res2n && res2n.length > 0) {
            var bounds2n = [];
            res2n.forEach(function(r) {
              var lat = parseFloat(r.lat), lng = parseFloat(r.lon);
              var nombre = r.display_name.split(',')[0].trim();
              var dist = userLat ? ' · ' + formatDist(haversine(refLat,refLng,lat,lng)) : '';
              var sm = L.marker([lat,lng], {icon:iconoBusqueda}).addTo(mapa);
              sm.bindPopup('<div style="font-family:DM Sans,sans-serif;min-width:160px"><strong>'+nombre+dist+'</strong><br><div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap"><button onclick="_toggleBusquedaRuta(this,encodeURIComponent(\''+nombre+'\'),'+lat+','+lng+');" style="background:#E1F5EE;color:#0F6E56;border:1px solid rgba(29,158,117,0.4);padding:5px 12px;border-radius:12px;font-size:12px;font-weight:600;cursor:pointer;font-family:DM Sans,sans-serif">➕ Añadir a ruta</button><button onclick="irACoordenadasNav('+lat+','+lng+')" style="background:#1D9E75;color:#fff;border:none;padding:5px 12px;border-radius:12px;font-size:12px;cursor:pointer;font-family:DM Sans,sans-serif">🗺️ Cómo llegar</button></div></div>');
              searchMarkers.push(sm); bounds2n.push([lat,lng]);
            });
            if (searchMarkers.length > 0) searchMarkers[0].openPopup();
            var clearBtn2n = document.getElementById('buscar-clear'); if (clearBtn2n) clearBtn2n.style.display = 'flex';
            document.activeElement && document.activeElement.blur();
            mostrarToast('📍 '+searchMarkers.length+' resultado'+(searchMarkers.length!==1?'s':'')+' cerca');
          } else { mostrarToast('🔍 Sin resultados para "' + termino + '" cerca'); }
        } catch(e) { mostrarToast('⚠️ Error al buscar. Inténtalo de nuevo.'); }
      } else { mostrarToast('⚠️ Error de red.'); }
    };
    xhr2n.send();
  }

  if (osmTag) {
    // Búsqueda Overpass para servicios OSM — radio 3km
    var r = 3000;
    var query = '[out:json][timeout:10];(node'+osmTag+'(around:'+r+','+refLat+','+refLng+');way'+osmTag+'(around:'+r+','+refLat+','+refLng+'););out center 20;';
    var url = 'https://overpass-api.de/api/interpreter?data=' + encodeURIComponent(query);
    mostrarToast('🔍 Buscando ' + q + ' cerca...');
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.timeout = 12000;
    xhr.onreadystatechange = function() {
      if (xhr.readyState !== 4) return;
      if (xhr.status === 200) {
        try {
          var res = JSON.parse(xhr.responseText);
          var elementos = res.elements || [];
          if (elementos.length > 0) {
            // Ordenar por distancia
            elementos.forEach(function(el) {
              el._lat = el.lat || (el.center && el.center.lat);
              el._lng = el.lon || (el.center && el.center.lon);
              el._dist = haversine(refLat, refLng, el._lat, el._lng);
            });
            elementos.sort(function(a,b){ return a._dist - b._dist; });
            var bounds = [];
            elementos.slice(0,12).forEach(function(el) {
              if (!el._lat) return;
              var nombre = (el.tags && (el.tags.name || el.tags.brand)) || q;
              var dist = formatDist(el._dist);
              var sm = L.marker([el._lat, el._lng], {icon:iconoBusqueda}).addTo(mapa);
              var addr = el.tags ? (el.tags['addr:street'] ? el.tags['addr:street'] + (el.tags['addr:housenumber'] ? ' '+el.tags['addr:housenumber'] : '') : '') : '';
              var tel = el.tags && el.tags.phone ? '<br>📞 '+el.tags.phone : '';
              sm.bindPopup('<div style="font-family:DM Sans,sans-serif;min-width:160px"><strong>'+nombre+'</strong><br><span style="font-size:11px;color:#6b7280">📍 '+dist+(addr?' · '+addr:'')+'</span>'+tel+'<br><div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap"><button onclick="_toggleBusquedaRuta(this,encodeURIComponent(\''+nombre+'\'),'+el._lat+','+el._lng+');" style="background:#E1F5EE;color:#0F6E56;border:1px solid rgba(29,158,117,0.4);padding:5px 12px;border-radius:12px;font-size:12px;font-weight:600;cursor:pointer;font-family:DM Sans,sans-serif">➕ Añadir a ruta</button><button onclick="irACoordenadasNav('+el._lat+','+el._lng+')" style="background:#1D9E75;color:#fff;border:none;padding:5px 12px;border-radius:12px;font-size:12px;cursor:pointer;font-family:DM Sans,sans-serif">&#128506; Cómo llegar</button></div></div>');
              searchMarkers.push(sm); bounds.push([el._lat, el._lng]);
            });
            if (searchMarkers.length > 0) searchMarkers[0].openPopup();
            var clearBtn = document.getElementById('buscar-clear');
            if (clearBtn) clearBtn.style.display = 'flex';
            document.activeElement && document.activeElement.blur();
            mostrarToast('📍 '+searchMarkers.length+' '+q+' encontrado'+(searchMarkers.length!==1?'s':'')+' cerca');
          } else {
            // Overpass sin resultados → fallback Nominatim
            mostrarToast('🔍 Sin resultados Overpass, buscando en Nominatim…');
            _buscarNominatimMapa(q);
          }
        } catch(e) {
          // Error de parse → fallback Nominatim
          _buscarNominatimMapa(q);
        }
      } else {
        // Error HTTP o timeout → fallback Nominatim
        mostrarToast('⚠️ Overpass no disponible, intentando alternativa…');
        _buscarNominatimMapa(q);
      }
    };
    xhr.ontimeout = function() { mostrarToast('⚠️ Overpass tardó demasiado, intentando alternativa…'); _buscarNominatimMapa(q); };
    xhr.send();

  } else {
    // Nominatim para lugares por nombre — radio ~3km
    var d = 0.03;
    var url2 = 'https://nominatim.openstreetmap.org/search?format=json&limit=8&q=' +
      encodeURIComponent(q) + '&accept-language=es' +
      '&viewbox='+(refLng-d)+','+(refLat+d)+','+(refLng+d)+','+(refLat-d)+'&bounded=1';
    var xhr2 = new XMLHttpRequest();
    xhr2.open('GET', url2, true);
    xhr2.onreadystatechange = function() {
      if (xhr2.readyState !== 4) return;
      if (xhr2.status === 200) {
        try {
          var res2 = JSON.parse(xhr2.responseText);
          if (res2 && res2.length > 0) {
            var bounds2 = [];
            res2.forEach(function(r) {
              var lat = parseFloat(r.lat), lng = parseFloat(r.lon);
              var nombre = r.display_name.split(',')[0].trim();
              var dist = userLat ? ' · ' + formatDist(haversine(refLat,refLng,lat,lng)) : '';
              var sm = L.marker([lat,lng], {icon:iconoBusqueda}).addTo(mapa);
              sm.bindPopup('<div style="font-family:DM Sans,sans-serif;min-width:160px"><strong>'+nombre+dist+'</strong><br><div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap"><button onclick="_toggleBusquedaRuta(this,encodeURIComponent(\''+nombre+'\'),'+lat+','+lng+');" style="background:#E1F5EE;color:#0F6E56;border:1px solid rgba(29,158,117,0.4);padding:5px 12px;border-radius:12px;font-size:12px;font-weight:600;cursor:pointer;font-family:DM Sans,sans-serif">➕ Añadir a ruta</button><button onclick="irACoordenadasNav('+lat+','+lng+')" style="background:#1D9E75;color:#fff;border:none;padding:5px 12px;border-radius:12px;font-size:12px;cursor:pointer;font-family:DM Sans,sans-serif">&#128506; Cómo llegar</button></div></div>');
              searchMarkers.push(sm); bounds2.push([lat,lng]);
            });
            if (searchMarkers.length > 0) searchMarkers[0].openPopup();
            var clearBtn = document.getElementById('buscar-clear');
            if (clearBtn) clearBtn.style.display = 'flex';
            // sin zoom automático
            document.activeElement && document.activeElement.blur();
          } else {
            mostrarToast('🔍 Sin resultados para "' + q + '" cerca');
          }
        } catch(e) { mostrarToast('⚠️ Error al buscar. Inténtalo de nuevo.'); }
      }
    };
    xhr2.send();
  }
}


var PUNTOS_USUARIO = []; // POIs locales del usuario (localStorage)
var poiFormLat = null, poiFormLng = null;
var USER_POI_PREFIX = 'u_'; // prefijo para distinguir POIs de usuario

// ID único del dispositivo — se genera una vez y se guarda en localStorage
var DEVICE_ID = (function() {
  var id = localStorage.getItem('gcl_device_id');
  if (!id) {
    id = 'dev_' + Math.random().toString(36).substr(2,9) + '_' + Date.now();
    localStorage.setItem('gcl_device_id', id);
  }
  return id;
})();

// Cargar POIs del usuario desde localStorage
function cargarPOIsUsuario() {
  try {
    var stored = localStorage.getItem('poi_usuario');
    if (!stored) return;
    PUNTOS_USUARIO = JSON.parse(stored);
  if(PUNTOS_USUARIO.length>0){
    var chipU2=document.getElementById('chip-usuario-drawer');
    if(chipU2) chipU2.style.display='';
    var chipU2M=document.getElementById('chip-usuario-mapa');
    if(chipU2M) chipU2M.style.display='';
  }
    PUNTOS_USUARIO.forEach(function(p) {
      p.esUsuario = true;
      if (!valoraciones[p.id]) valoraciones[p.id] = {total:0, votos:0, miVoto:0};
      if (!opiniones[p.id]) opiniones[p.id] = [];
      if (!PUNTOS.find(function(x){return x.id===p.id;})) {
        PUNTOS.push(p);
      }
      if (typeof mapa !== 'undefined' && mapa) {
        añadirMarcadorUsuario(p);
      }
    });
    // Sincronizar con Firebase los que no llegaron
    sincronizarPOIsLocalesConFirebase();
  } catch(e) { console.warn('Error cargando POIs usuario:', e); }
}

// Sincroniza POIs del localStorage que no están en Firebase
function sincronizarPOIsLocalesConFirebase() {
  if (!PUNTOS_USUARIO.length) return;
  // Leer rama poi_usuarios completa para ver cuáles faltan
  db.ref('poi_usuarios').once('value', function(snap) {
    var enFirebase = snap.val() || {};
    var pendientesSincronizar = PUNTOS_USUARIO.filter(function(p) {
      return !enFirebase[p.id];
    });
    if (!pendientesSincronizar.length) return;
    pendientesSincronizar.forEach(function(p) {
      // Asegurar campos correctos antes de subir
      var poiFirebase = {
        id: p.id,
        nombre: p.nombre,
        descripcion: p.descripcion || '',
        categoria: p.categoria || '',
        lat: p.lat,
        lng: p.lng,
        emoji: p.emoji || '👤', _esUsuario: true,
        color: p.color || 'ambar',
        esUsuario: true,
        estado: p.estado || 'pendiente',
        ts: p.ts || Date.now()
      };
      db.ref('poi_usuarios/' + p.id).set(poiFirebase).then(function() {
      }, function(err) {
        console.warn('No se pudo sincronizar POI:', p.nombre, err.message);
      });
    });
  }, function(err) {
    console.warn('No se pudo leer Firebase para sincronizar:', err.message);
  });
}

// Cargar POIs aprobados de Firebase
function cargarPOIsFirebase() {
  db.ref('poi_usuarios').orderByChild('estado').equalTo('aprobado').on('value', function(snap) {
    var data = snap.val();
    if (!data) return;
    Object.keys(data).forEach(function(key) {
      var p = data[key];
      p.id = key;
      p.esUsuario = true;
      if (!PUNTOS.find(function(x){return x.id===p.id;})) {
        PUNTOS.push(p);
        if (typeof mapa !== 'undefined' && mapa) añadirMarcadorUsuario(p);
      }
    });
    if (typeof userLat !== 'undefined' && userLat) {
      PUNTOS.forEach(function(p){p.distancia=haversine(userLat,userLng,p.lat,p.lng);});
      PUNTOS.sort(function(a,b){return a.distancia-b.distancia;});
    }
    renderCarrusel(categoriaActiva);
  });

  // Cargar alertas activas en tiempo real (sin moderación, caducan 24h)
  // Cargar alertas activas en tiempo real — eventos quirúrgicos para evitar duplicados
  var chipAlerta = document.getElementById('chip-alertas');

  function _actualizarChipAlerta() {
    var hayVisibles = PUNTOS.some(function(p){ return p.esAlerta && !alertasOcultas[p.id]; });
    if (chipAlerta) chipAlerta.style.animation = hayVisibles ? 'chipAlertaPulse 1.2s ease-in-out infinite' : '';
    var chipAlertaMapa = document.getElementById('chip-alerta-mapa');
    if (chipAlertaMapa) chipAlertaMapa.style.display = hayVisibles ? '' : 'none';
    _sincronizarChipAlertasPOI();
  }

  db.ref('alertas').on('child_added', function(snap) {
    if (!window._alertasFirebaseOn) return;
    var key = snap.key;
    var a = snap.val();
    if (!a) return;
    a.id = key;
    a.esAlerta = true;
    a.esUsuario = true;
    // Ignorar si ya eliminada localmente
    if (window._alertasEliminadas && window._alertasEliminadas[key]) return;
    // Ignorar si caducada
    if (a.expiraTs && Date.now() > a.expiraTs) {
      db.ref('alertas/' + key).remove();
      return;
    }
    // Añadir solo si no existe ya
    if (!PUNTOS.find(function(x){ return x.id === key; })) {
      PUNTOS.push(a);
      if (typeof mapa !== 'undefined' && mapa && !alertasOcultas[key]) añadirMarcadorAlerta(a);
    }
    if (typeof userLat !== 'undefined' && userLat) {
      PUNTOS.forEach(function(p){ p.distancia = haversine(userLat, userLng, p.lat, p.lng); });
      PUNTOS.sort(function(a,b){ return a.distancia - b.distancia; });
    }
    renderCarrusel(categoriaActiva);
    _actualizarChipAlerta();
  });

  db.ref('alertas').on('child_removed', function(snap) {
    var key = snap.key;
    var poi = PUNTOS.find(function(p){ return p.id === key; });
    if (poi && poi._marker) mapa.removeLayer(poi._marker);
    PUNTOS = PUNTOS.filter(function(p){ return p.id !== key; });
    renderCarrusel(categoriaActiva);
    _actualizarChipAlerta();
  });

  db.ref('alertas').on('child_changed', function(snap) {
    var key = snap.key;
    var a = snap.val();
    if (!a) return;
    a.id = key;
    a.esAlerta = true;
    a.esUsuario = true;
    var idx = PUNTOS.findIndex(function(p){ return p.id === key; });
    if (idx !== -1) {
      if (PUNTOS[idx]._marker) mapa.removeLayer(PUNTOS[idx]._marker);
      PUNTOS[idx] = a;
      if (!alertasOcultas[key]) añadirMarcadorAlerta(a);
    }
  });
}

var _alertasFirebaseOn = true;

function _actualizarBtnAlertas() {
  var btn=document.getElementById('btn-alertas-toggle'); if(!btn)return;
  // notifActivadas también cuenta: false = desactivada o pendiente de permiso
  var todasOff=!_alertasFirebaseOn&&!_cromosNotifOn&&!notifActivadas;
  var alguOff=!_alertasFirebaseOn||!_cromosNotifOn||!notifActivadas;
  if(todasOff){
    btn.style.background='#fecaca';btn.style.border='1.5px solid #ef4444';
    btn.textContent='🔕';btn.title='Alertas y notificaciones desactivadas';
  } else if(alguOff){
    btn.style.background='rgba(249,115,22,0.55)';btn.style.border='1.5px solid rgba(234,96,0,0.7)';btn.style.backdropFilter='blur(4px)';btn.style.webkitBackdropFilter='blur(4px)';
    btn.innerHTML='<span style="position:relative;display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px"><span style="font-size:18px;line-height:1">🔔</span><svg style="position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none" viewBox="0 0 20 20"><line x1="3" y1="17" x2="17" y2="3" stroke="#dc2626" stroke-width="2.5" stroke-linecap="round"/></svg></span>';btn.title='Algunas notificaciones desactivadas';
  } else {
    btn.style.background='rgba(255,245,210,0.92)';btn.style.border='1.5px solid #a07828';
    btn.textContent='🔔';btn.title='Notificaciones activas';
  }
}

function toggleAlertasFirebase(){
  _alertasFirebaseOn=!_alertasFirebaseOn;
  _actualizarBtnAlertas();
}


function abrirHeroModal() {
  // Desbloquear / crear AudioContext en el mismo gesto del usuario (obligatorio en iOS/Safari)
  try {
    if (!window._cascoAudioCtx) {
      window._cascoAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (window._cascoAudioCtx.state === 'suspended') {
      window._cascoAudioCtx.resume();
    }
  } catch(e) {}
  var _t = (typeof T !== 'undefined' && T[idiomaActual]) ? T[idiomaActual] : T['es'];
  function _capital(txt) {
    if (!txt || typeof txt !== 'string') return txt;
    var m = txt.match(/^(<[^>]+>)(.+)/s);
    if (m) return m[1] + _capital(m[2]);
    var first = txt.charAt(0);
    if (first !== 'T') return txt;
    return txt;
  }
  function _capitalAll(txt) {
    if (!txt || typeof txt !== 'string') return txt;
    var m = txt.match(/^(<[^>]+>)(.+)/s);
    if (m) return m[1] + _capitalAll(m[2]);
    var first = txt.charAt(0);
    if (!first.match(/[A-Za-zÀ-ÿÁÉÍÓÚáéíóúÑñ]/)) return txt;
    return txt;
  }
  var viejo = document.getElementById('modal-hero-mobile');
  if (viejo) { viejo.remove(); return; }

  var overlay = document.createElement('div');
  overlay.id = 'modal-hero-mobile';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:99998;background:rgba(0,0,0,0.55);display:flex;align-items:flex-end;justify-content:center;-webkit-tap-highlight-color:transparent;font-family:DM Sans,sans-serif';

  var panel = document.createElement('div');
  panel.style.cssText = 'background:radial-gradient(ellipse at 20% 15%, rgba(90,50,0,0.18) 0%, transparent 55%),radial-gradient(ellipse at 80% 80%, rgba(60,30,0,0.22) 0%, transparent 50%),radial-gradient(ellipse at 60% 35%, rgba(180,130,40,0.12) 0%, transparent 40%),radial-gradient(ellipse at 10% 85%, rgba(80,40,0,0.15) 0%, transparent 45%),linear-gradient(180deg,#c9933a 0%,#b87d28 40%,#a86d18 100%);border-radius:20px 20px 0 0;padding:0;width:100%;max-width:480px;height:82vh;max-height:82vh;position:relative;box-sizing:border-box;transform:translateY(100%);transition:transform 0.32s cubic-bezier(0.32,0.72,0,1);overflow:hidden;border-top:3px solid #5a3008;box-shadow:0 -4px 32px rgba(0,0,0,0.5),inset 0 0 60px rgba(60,25,0,0.25),inset 0 0 15px rgba(40,15,0,0.3),inset 0 1px 0 rgba(255,220,120,0.15);display:flex;flex-direction:column';

  // Grid background
  var grid = document.createElement('div');
  grid.style.cssText = 'position:absolute;inset:0;background-image:repeating-linear-gradient(0deg,transparent,transparent 28px,rgba(139,105,20,0.07) 28px,rgba(139,105,20,0.07) 29px);pointer-events:none;opacity:0.7';
  panel.appendChild(grid);

  function cerrar() {
    panel.style.transform = 'translateY(100%)';
    setTimeout(function(){ overlay.remove(); }, 320);
  }

  // ✕
  var btnX = document.createElement('button');
  btnX.textContent = '✕';
  btnX.style.cssText = 'position:absolute;top:10px;right:10px;width:26px;height:26px;background:rgba(0,0,0,0.2);border:1.5px solid #7a5010;border-radius:50%;font-size:13px;cursor:pointer;z-index:2;display:flex;align-items:center;justify-content:center;color:#fff8e8;-webkit-appearance:none';
  btnX.addEventListener('click', cerrar);
  btnX.addEventListener('touchend', function(e){ e.preventDefault(); cerrar(); });
  panel.appendChild(btnX);

  // Handle bar — con su propio padding top
  var bar = document.createElement('div');
  bar.style.cssText = 'text-align:center;font-size:20px;color:#fff0c0;padding:20px 20px 0;position:relative;z-index:1;letter-spacing:4px;line-height:1;margin-bottom:16px;flex-shrink:0';
  panel.appendChild(bar);

  // Inner content
  var inner = document.createElement('div');
  inner.style.cssText = 'position:relative;z-index:1;flex:1;min-height:0;display:flex;flex-direction:column;padding:0 20px 40px;box-sizing:border-box';
  inner.className = 'pergamino-body';
  panel.appendChild(inner);

  // ── Sonido carga de casete (Web Audio API) ──────────────────
  // Silenciado de momento — para reactivarlo, cambia esto a false.
  window._casc_mute = true;
  // En vez de un bucle a ritmo fijo, el sonido se dispara por _cascoTick(),
  // que el typewriter llama una vez por cada carácter que aparece — así la
  // cadencia del sonido es siempre la misma que la de la escritura.
  var _cascoAudioCtx = null;
  var _cascoNodes = [];
  var _cascoActive = false;
  var _cascoStopTimer = null;

  // Portadoras estilo FSK de módem / carga de casete (Bell 103 / ZX Spectrum tape)
  // — tono grave, una octava por debajo del original
  var _cascoCarriers = [535, 635, 1012, 1112, 925, 490];

  function _cascoEnsureNoiseBuffer(ctx) {
    if (!window._cascoNoiseBuffer) {
      var len = Math.floor(ctx.sampleRate * 0.3);
      var buf = ctx.createBuffer(1, len, ctx.sampleRate);
      var d = buf.getChannelData(0);
      for (var ni = 0; ni < len; ni++) d[ni] = Math.random() * 2 - 1;
      window._cascoNoiseBuffer = buf;
    }
  }

  // Arma el sonido: se queda "activo" hasta que se llame a _cascoSonidoStop
  // (o hasta que pase `duracion`, como salvaguarda). No suena nada por sí solo:
  // cada bit se reproduce vía _cascoTick(), llamado por el typewriter.
  function _cascoSonido(duracion) {
    if (window._casc_mute) return;
    _cascoSonidoStop();
    try {
      var ctx = window._cascoAudioCtx;
      if (!ctx) return;
      if (ctx.state === 'suspended') { ctx.resume(); }
      _cascoEnsureNoiseBuffer(ctx);
      _cascoActive = true;
      if (duracion) _cascoStopTimer = setTimeout(_cascoSonidoStop, duracion * 1000);
    } catch(e) {}
  }

  function _cascoSonidoStop() {
    _cascoActive = false;
    if (_cascoStopTimer) { clearTimeout(_cascoStopTimer); _cascoStopTimer = null; }
    _cascoNodes.forEach(function(n){ try { n.stop(); } catch(e){} });
    _cascoNodes = [];
  }

  // Un único "bit" de sonido — pensado para llamarse una vez por carácter escrito.
  function _cascoTick() {
    if (!_cascoActive || window._casc_mute) return;
    try {
      var ctx = window._cascoAudioCtx;
      if (!ctx) return;
      var now = ctx.currentTime;

      // Bit de datos: tono cuadrado corto y seco
      var osc = ctx.createOscillator();
      var g   = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = _cascoCarriers[(Math.random() * _cascoCarriers.length) | 0];
      g.gain.setValueAtTime(0.0, now);
      g.gain.linearRampToValueAtTime(0.075, now + 0.004);
      g.gain.linearRampToValueAtTime(0.0, now + 0.032);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.035);
      _cascoNodes.push(osc);

      // Capa de ruido filtrado: el "siseo" de cinta/línea
      if (window._cascoNoiseBuffer) {
        var noise = ctx.createBufferSource();
        noise.buffer = window._cascoNoiseBuffer;
        var bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 1500 + Math.random() * 1400;
        bp.Q.value = 5;
        var ng = ctx.createGain();
        ng.gain.setValueAtTime(0.0, now);
        ng.gain.linearRampToValueAtTime(0.02, now + 0.004);
        ng.gain.linearRampToValueAtTime(0.0, now + 0.03);
        noise.connect(bp);
        bp.connect(ng);
        ng.connect(ctx.destination);
        noise.start(now);
        noise.stop(now + 0.035);
        _cascoNodes.push(noise);
      }
    } catch(e) {}
  }

  window._cascoSonido = _cascoSonido;
  window._cascoSonidoStop = _cascoSonidoStop;
  window._cascoTick = _cascoTick;

  // Calcula cuánto va a tardar el typewriter en escribir "texto" a "speed" ms/carácter,
  // para que el sonido dure exactamente lo mismo y no se desincronice.
  function _cascoDur(texto, speed) {
    var plano = String(texto || '').replace(/<[^>]+>/g, '');
    var ms = plano.length * (speed || 28);
    return Math.max(0.3, ms / 1000 + 0.1); // pequeño margen de cola
  }
  window._cascoDur = _cascoDur;

  // Helper: casco + typewriter reutilizable para todos los _render
  function _cascoTypewriter(container, texto, extraCss, speed, onDone) {
    var wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;align-items:flex-end;gap:10px;margin-bottom:10px' + (extraCss ? ';' + extraCss : '');
    var img = document.createElement('img');
    img.src = 'https://i.postimg.cc/hP2mT0LN/casc6.webp';
    img.style.cssText = 'width:36px;height:36px;object-fit:contain;flex-shrink:0;animation:_casc-pulse 2.4s ease-in-out infinite';
    var txt = document.createElement('div');
    txt.style.cssText = 'font-family:DM Sans,sans-serif;font-size:15px;font-weight:500;color:#1a0800;line-height:1;flex:1;margin-bottom:0';
    wrap.appendChild(img);
    wrap.appendChild(txt);
    container.appendChild(wrap);
    _cascoSonido(_cascoDur(texto, speed || 42));
    _typewriter(txt, texto, speed || 42, function() {
      img.style.animation = 'none';
      _cascoSonidoStop();
      if (onDone) onDone(img);
    });
    return { img: img, txt: txt, wrap: wrap };
  }

  // ── DESPEDIDA: mensaje de apoyo al cerrar ───────────────────────
  function _renderDespedida(fnDespues) {
    if (panel._sugerenciasWrap) { panel._sugerenciasWrap.remove(); panel._sugerenciasWrap = null; }
    inner.style.cssText = 'position:relative;z-index:1;flex:1;min-height:0;display:flex;flex-direction:column;padding:0 20px 40px;box-sizing:border-box';
    inner.innerHTML = '';

    var icono = document.createElement('div');
    icono.style.cssText = 'font-size:36px;text-align:center;margin-bottom:10px';
    icono.textContent = '🐚';
    inner.appendChild(icono);

    var msg = document.createElement('p');
    msg.style.cssText = 'font-size:15px;color:#1a0800;text-align:left;line-height:1.7;margin-bottom:16px';
    _cascoTypewriter(inner, _t.asistBienCamino||'¡Buen Camino, peregrino!', 'justify-content:center', 42, function(cascoImg) {
      _twSeq([[msg, _capital(_t.asistGratisMsg||'Esta guía es gratuita, sin publicidad y sin cookies. Solo el apoyo de peregrinos como tú hace posible que siga creciendo y libre para todos. 🙏'), 28, inner]], cascoImg);
    });

    var btnApoyo = document.createElement('button');
    btnApoyo.textContent = _t.asistApoyo||'💚 Apoyar la guía';
    btnApoyo.style.cssText = 'width:100%;background:linear-gradient(135deg,#7a1f1f,#5c1414);color:#f5e6c8;border:none;border-radius:8px;padding:12px;font-size:16px;font-weight:700;cursor:pointer;font-family:DM Sans,sans-serif;margin-bottom:8px;box-shadow:0 2px 8px rgba(122,31,31,0.4);letter-spacing:0.3px';
    btnApoyo.addEventListener('click', function() {
      cerrar();
      setTimeout(function(){ abrirDonacionesDrawer(); }, 340);
    });
    inner.appendChild(btnApoyo);

    var btnSalir = document.createElement('button');
    btnSalir.textContent = _t.asistSinApoyo||'Continuar sin apoyar';
    btnSalir.style.cssText = 'width:100%;background:transparent;color:rgba(255,248,232,0.6);border:none;padding:8px;font-size:14px;cursor:pointer;font-family:DM Sans,sans-serif';
    btnSalir.addEventListener('click', function(){ if(fnDespues) fnDespues(); else cerrar(); });
    inner.appendChild(btnSalir);
  }

  // ── DATOS CONTEXTUALES Y CURIOSIDADES ──────────────────────────
  var _curiosidades = _t.asistCuriosidades || [];

  function _curiosidadAleatoria() {
    return _curiosidades[Math.floor(Math.random() * _curiosidades.length)];
  }

  function _numCromosActuales() {
    if (window._albumVisitasSet) return Object.keys(window._albumVisitasSet).length;
    return 0;
  }

  function _saludoConContexto() {
    var hora = new Date().getHours();
    var dia = new Date().getDay(); // 0=dom, 6=sab
    var finde = (dia === 0 || dia === 6);

    var mañana = (_t.asistSaludoM)||['¡Buenos días, peregrino!','¡Ultreia! El Camino te espera.','¡Arriba, caminante! El alba es tuya.','Un nuevo día en el Camino. ¡Buen paso!','¡Que la jornada te sea leve, peregrino!'];
    var tarde = (_t.asistSaludoT)||['¡Buenas tardes, peregrino!','¿Cómo lleva el Camino la tarde de hoy?','¡Tarde de Camino! ¿Cuántos kilómetros hoy?','La tarde es buena hora para planificar.','¡Ultreia et suseia, peregrino!'];
    var noche = (_t.asistSaludoN)||['¡Buenas noches, peregrino!','El Camino descansa, pero tú planificas.','Noche de peregrino. ¿Mañana salimos?','¡Buenas noches! El alba trae nuevo Camino.','Hora de descansar las piernas... o de planificar.'];

    var pool = hora < 13 ? mañana : hora < 20 ? tarde : noche;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function _subtituloEtapaCercana(cb) {
    var lang = idiomaActual || 'es';
    // Buscar etapa más cercana a Santiago (más corta de llegar a SCQ)
    // Usamos la etapa del camino más próxima geográficamente al usuario
    if (typeof PUNTOS === 'undefined' || !userLat) {
      // Sin GPS: fallback a subtítulo contextual
      return _subtituloContextual(cb);
    }
    var etapas = PUNTOS.filter(function(p) { return p.categoria === 'etapa' && p.lat && p.lng; });
    if (!etapas.length) return _subtituloContextual(cb);

    // Distancia haversine en km
    function _hav(lat1, lng1, lat2, lng2) {
      var R = 6371, dLat = (lat2-lat1)*Math.PI/180, dLng = (lng2-lng1)*Math.PI/180;
      var a = Math.sin(dLat/2)*Math.sin(dLat/2) + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)*Math.sin(dLng/2);
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    }

    // Santiago de Compostela coords
    var SCQ_LAT = 42.8805, SCQ_LNG = -8.5457;

    // Para cada etapa calculamos su distancia al usuario
    var distUserSCQ = _hav(userLat, userLng, SCQ_LAT, SCQ_LNG);

    var conDist = etapas.map(function(p) {
      return { p: p, distUser: _hav(userLat, userLng, p.lat, p.lng), distSCQ: _hav(p.lat, p.lng, SCQ_LAT, SCQ_LNG) };
    });

    // Etapas que están más cerca de Santiago que el usuario (por delante en la ruta)
    var porDelante = conDist.filter(function(x) { return x.distSCQ < distUserSCQ; });

    var mejor;
    if (porDelante.length > 0) {
      // De las que quedan por delante, la más lejana de Santiago = la inmediatamente siguiente
      porDelante.sort(function(a, b) { return b.distSCQ - a.distSCQ; });
      mejor = porDelante[0];
    } else {
      // Ya más cerca de Santiago que cualquier etapa: mostrar la más cercana al usuario
      conDist.sort(function(a, b) { return a.distUser - b.distUser; });
      mejor = conDist[0];
    }

    var distKm = mejor.distUser;
    var _nombreCompleto = lang==='gl' && mejor.p.nombre_gl ? mejor.p.nombre_gl : lang==='en' && mejor.p.nombre_en ? mejor.p.nombre_en : mejor.p.nombre;
    // Extraer solo la ciudad de origen: texto entre "·" y "→"
    var _partes = _nombreCompleto.split('·');
    var nombre;
    if (_partes.length > 1) {
      var _dest = _partes[1].split('→')[0].trim();
      nombre = _dest || _nombreCompleto;
    } else {
      nombre = _nombreCompleto;
    }
    var distSCQ = Math.round(mejor.distSCQ);
    var distStr = distKm < 1 ? Math.round(distKm*1000)+' m' : distKm.toFixed(1)+' km';

    var msgs = {
      es: 'Tu siguiente meta es alcanzar '+nombre+', a '+distStr+'. Desde allí quedan aproximadamente '+distSCQ+' km hasta alcanzar Santiago de Compostela.',
      gl: 'O teu seguinte obxectivo é alcanzar '+nombre+', a '+distStr+'. Desde alí quedan aproximadamente '+distSCQ+' km para chegar a Santiago de Compostela.',
      en:  'Your next goal is to reach '+nombre+', '+distStr+' away. From there it is approximately '+distSCQ+' km to Santiago de Compostela.'
    };
    window._etapaProxima = mejor;
    if (cb) cb(msgs[lang] || msgs.es);
  }

  function _subtituloContextual(cb) {
    var now = new Date();
    var dias = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
    var diasGL = ['domingo','luns','martes','mércores','xoves','venres','sábado'];
    var diasEN = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    var meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
    var mesesGL = ['xaneiro','febreiro','marzo','abril','maio','xuño','xullo','agosto','setembro','outubro','novembro','decembro'];
    var mesesEN = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    var diaIdx = now.getDay();
    var diaMes = now.getDate();
    var mesIdx = now.getMonth();
    var diaNom = idiomaActual==='gl' ? diasGL[diaIdx] : idiomaActual==='en' ? diasEN[diaIdx] : dias[diaIdx];
    var mesNom = idiomaActual==='gl' ? mesesGL[mesIdx] : idiomaActual==='en' ? mesesEN[mesIdx] : meses[mesIdx];
    var fechaTxt = idiomaActual==='en'
      ? diaNom + ', ' + mesNom + ' ' + diaMes
      : diaNom + ' ' + diaMes + ' de ' + mesNom;

    function _construir(m) {
      var icon = m ? (m.icon || '🌡️') : null;
      var temp = m ? (m.temp + '°') : null;
      var lluvia = m && m.prob > 50;
      var frio = m && m.temp < 10;
      var calor = m && m.temp > 26;
      var horaStr = m && m.hora !== undefined ? m.hora + ':00h' : null;
      if (!m) {
        var sinMeteo = {
          es: ['¡Buen '+fechaTxt+'! El Camino te espera.','Feliz '+fechaTxt+'. ¿Damos el primer paso hoy?','¡Hoy es '+fechaTxt+'! Un buen día para explorar.'],
          gl: ['¡Bo '+fechaTxt+'! O Camiño agárdache.','Bo '+fechaTxt+'. ¿Damos o primeiro paso hoxe?','¡Hoxe é '+fechaTxt+'! Un bo día para explorar.'],
          en: ['Happy '+fechaTxt+'! The Way awaits.','Good '+fechaTxt+'. Shall we take the first step today?','Today is '+fechaTxt+'! A good day to explore.']
        };
        var arr = sinMeteo[idiomaActual] || sinMeteo.es;
        return arr[Math.floor(Math.random()*arr.length)];
      }
      var h = horaStr ? 'a las '+horaStr : 'en las próximas horas';
      var hEN = horaStr ? 'at '+horaStr : 'in the next few hours';
      var hGL = horaStr ? 'ás '+horaStr : 'nas próximas horas';
      if (idiomaActual === 'en') {
        if (lluvia)   return icon+' Forecast for '+hEN+': '+temp+' with '+m.prob+'% chance of rain. Pack your waterproof cape and watch your step on wet stone paths.';
        else if (frio) return icon+' '+temp+' expected '+hEN+'. Dress in layers and bring a windproof jacket — it will make a real difference on the route.';
        else if (calor) return icon+' '+temp+' forecast '+hEN+'. Keep water close, cover your head and plan your rest stops in the shade.';
        else           return icon+' '+temp+' forecast '+hEN+' — ideal walking weather. Enjoy the Camino, pilgrim!';
      } else if (idiomaActual === 'gl') {
        if (lluvia)   return icon+' Previsión '+hGL+': '+temp+' con '+m.prob+'% de choiva. Leva o chuvasqueiro e coidado cos camiños de pedra mollados.';
        else if (frio) return icon+' '+temp+' previstos '+hGL+'. Vai en capas e leva un cortalventos — notarase moito na ruta.';
        else if (calor) return icon+' '+temp+' previstos '+hGL+'. Leva auga, tapa a cabeza e para á sombra cando poidas.';
        else           return icon+' '+temp+' previstos '+hGL+' — tempo ideal para camiñar. ¡Bo Camiño, peregrino!';
      } else {
        if (lluvia)   return icon+' Previsión '+h+': '+temp+' con '+m.prob+'% de lluvia. Lleva el chubasquero y cuidado con los caminos de piedra mojados.';
        else if (frio) return icon+' '+temp+' previstos '+h+'. Abrígate en capas y lleva un cortavientos — lo notarás en el camino.';
        else if (calor) return icon+' '+temp+' previstos '+h+'. Lleva agua, cúbrete la cabeza y busca sombra en las paradas.';
        else           return icon+' '+temp+' previstos '+h+' — tiempo ideal para caminar. ¡Buen Camino, peregrino!';
      }
    }

    // Si ya tenemos datos meteo, devolvemos directo
    if (window._meteoActual) {
      var txt = _construir(window._meteoActual);
      if (cb) { cb(txt); return; }
      return txt;
    }

    // Usar coordenadas ya disponibles (GPS ya activo en la app)
    function _fetchMeteo(lat, lng) {
      var url = 'https://api.open-meteo.com/v1/forecast?latitude='+lat+'&longitude='+lng
        +'&hourly=temperature_2m,weathercode,precipitation_probability&timezone=Europe/Madrid&forecast_days=1';
      var xhr = new XMLHttpRequest(); xhr.open('GET', url, true);
      xhr.timeout = 3000;
      xhr.onreadystatechange = function() {
        if (xhr.readyState !== 4) return;
        if (xhr.status === 200) {
          try {
            var data = JSON.parse(xhr.responseText);
            var ha = new Date().getHours(); var haF = Math.min(ha + 2, 23); var ci = 0;
            for (var i=0; i<data.hourly.time.length; i++) { if (parseInt(data.hourly.time[i].split('T')[1])===haF){ci=i;break;} }
            window._meteoActual = {
              temp: Math.round(data.hourly.temperature_2m[ci]),
              code: data.hourly.weathercode[ci],
              prob: data.hourly.precipitation_probability[ci],
              hora: haF,
              icon: (typeof WMO_ICONS!=='undefined'&&WMO_ICONS[data.hourly.weathercode[ci]])?WMO_ICONS[data.hourly.weathercode[ci]]:'🌡️'
            };
          } catch(e) {}
        }
        cb(_construir(window._meteoActual || null));
      };
      xhr.ontimeout = function() { cb(_construir(null)); };
      xhr.send();
    }

    if (typeof userLat !== 'undefined' && userLat) {
      // Coordenadas GPS ya disponibles — fetch directo sin pedir permiso
      _fetchMeteo(userLat, userLng);
    } else if (cb && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        function(pos) { _fetchMeteo(pos.coords.latitude, pos.coords.longitude); },
        function() { cb(_construir(null)); },
        {timeout:3000, maximumAge:60000}
      );
    } else {
      var res = _construir(null);
      if (cb) { cb(res); return; }
      return res;
    }
  }

  // Inserta un bloque de curiosidad con estilo discreto
  function _appendCuriosidad(container) {
    // Siempre mostrar
    var wrap = document.createElement('div');
    wrap.style.cssText = 'background:rgba(0,0,0,0.15);border-left:3px solid #7a5010;border-radius:0 8px 8px 0;padding:10px 12px;margin-top:16px;margin-bottom:4px';
    var label = document.createElement('div');
    label.style.cssText = 'font-size:12px;color:#fff0c0;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;font-weight:600;font-family:DM Sans,sans-serif';
    label.textContent = _t.asistSabias||'📜 Sabías que…';
    var txt = document.createElement('p');
    txt.style.cssText = 'font-size:14px;color:#fff8e8;line-height:1.6;margin:0';
    txt.innerHTML = _capitalAll(_curiosidadAleatoria());
    wrap.appendChild(label);
    wrap.appendChild(txt);
    container.appendChild(wrap);
  }

  // Typewriter helper
  function _typewriter(el, html, speed, onDone) {
    var text = html.replace(/<[^>]+>/g, '');
    var i = 0;
    // Technique: render full text in-flow from start.
    // Visible chars = normal color, remaining = transparent.
    // No position:absolute, no layout shifts, wrapping is always correct.
    function _render() {
      var vis  = text.slice(0, i);
      var hide = text.slice(i);
      el.innerHTML = (vis ? '<span>' + vis.replace(/&/g,'&amp;').replace(/</g,'&lt;') + '</span>' : '')
                   + (hide ? '<span style="visibility:hidden">' + hide.replace(/&/g,'&amp;').replace(/</g,'&lt;') + '</span>' : '');
    }
    _render();
    var cursor = setInterval(function() {
      if (i < text.length) {
        i++;
        _render();
        if (text[i-1] !== ' ' && window._cascoTick) window._cascoTick();
      } else {
        clearInterval(cursor);
        el.innerHTML = html;
        if (onDone) onDone();
      }
    }, speed || 28);
    return cursor;
  }

  // Encadena typewriters activando/parando el casco en cada párrafo.
  // pares: [[el, texto, speed?, contenedor?], ...]
  // cascoImg: la imagen del casco a animar (opcional)
  // onDone: callback al terminar todos
  function _twSeq(pares, cascoImg, onDone) {
    if (!pares || pares.length === 0) {
      if (cascoImg) cascoImg.style.animation = 'none';
      _cascoSonidoStop();
      if (onDone) onDone();
      return;
    }
    var par = pares[0];
    var rest = pares.slice(1);
    var el = par[0], html = par[1], speed = par[2] || 32, cont = par[3];
    // Insertar el elemento justo antes de escribirlo
    if (cont && el.parentNode !== cont) cont.appendChild(el);
    // Activar casco
    if (cascoImg) cascoImg.style.animation = '_casc-pulse 2.4s ease-in-out infinite';
    _cascoSonido(_cascoDur(html, speed));
    _typewriter(el, html, speed, function() {
      // Parar casco al terminar este párrafo
      if (cascoImg) cascoImg.style.animation = 'none';
      _cascoSonidoStop();
      // Pequeña pausa antes del siguiente
      setTimeout(function() { _twSeq(rest, cascoImg, onDone); }, 120);
    });
  }

  // ── PASO 1: Saludo + bifurcación según estado de ruta ───────────
  function _renderPaso1() {
    if (panel._sugerenciasWrap) { panel._sugerenciasWrap.remove(); panel._sugerenciasWrap = null; }
    inner.style.cssText = 'position:relative;z-index:1;flex:1;min-height:0;display:flex;flex-direction:column;padding:0 20px 40px;box-sizing:border-box';
    inner.innerHTML = '';

    // A más de 200 km del Camino oficial no tiene sentido el flujo de etapa /
    // lugares cercanos (daría distancias absurdas). Mostramos una vista propia
    // con solo acciones que NO dependen de la ruta.
    if (typeof _lejosDelCamino === 'function' && _lejosDelCamino()) { _renderLejos(); return; }

    // Casco solo, centrado, con pulso suave
    var cascoWrap = document.createElement('div');
    cascoWrap.style.cssText = 'display:flex;align-items:flex-end;gap:10px;margin-bottom:10px';
    var cascoImg = document.createElement('img');
    cascoImg.src = 'https://i.postimg.cc/hP2mT0LN/casc6.webp';
    cascoImg.style.cssText = 'width:38px;height:38px;object-fit:contain;flex-shrink:0;animation:_casc-pulse 2.4s ease-in-out infinite';
    if (!document.getElementById('_casc-pulse-style')) {
      var st = document.createElement('style');
      st.id = '_casc-pulse-style';
      st.textContent = '@keyframes _casc-pulse{0%,100%{transform:scale(1) rotate(-3deg)}50%{transform:scale(1.08) rotate(3deg)}} @keyframes _spin-pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.5;transform:scale(0.85)}} @keyframes _input-blink{0%,100%{opacity:1}50%{opacity:0.4}}';
      document.head.appendChild(st);
    }
    cascoWrap.appendChild(cascoImg);

    // Texto del saludo con typewriter — sin icono, fuente conversacional
    var saludoEl = document.createElement('div');
    saludoEl.style.cssText = 'font-family:DM Sans,sans-serif;font-size:15px;font-weight:500;color:#1a0800;line-height:1;flex:1;margin-bottom:0';
    cascoWrap.appendChild(saludoEl);
    inner.appendChild(cascoWrap);

    // Subtítulo (aparece tras el saludo)
    var subCtx = document.createElement('p');
    subCtx.style.cssText = 'font-size:15px;color:#1a0800;margin-bottom:12px;line-height:1.6;min-height:5em;word-break:break-word;overflow-wrap:break-word;width:100%;box-sizing:border-box';
    inner.appendChild(subCtx);

    // Preparar elementos y botones de las tres ramas (sin insertar aún los párrafos)
    var _hayRuta = typeof rutaPuntos !== 'undefined' && rutaPuntos.length > 0;

    // Calcular cercanos
    var cercanos = [];
    if (!_hayRuta && typeof PUNTOS !== 'undefined' && typeof userLat !== 'undefined' && userLat) {
      var todos = PUNTOS.filter(function(p) {
        return !p.esUsuario && !p.esAlerta && p.categoria !== 'etapa' && p.categoria !== 'busqueda' && !(p.id && p.id.indexOf('u_') === 0);
      });
      todos.forEach(function(p) {
        var d = haversine(userLat, userLng, p.lat, p.lng) * 1000;
        cercanos.push({poi: p, dist: d});
      });
      cercanos.sort(function(a,b){ return a.dist - b.dist; });
      cercanos = cercanos.slice(0, 5);
    }

    var saludoTexto = _saludoConContexto();

    // Typewriter saludo
    _cascoSonido(_cascoDur(saludoTexto, 45));
    _typewriter(saludoEl, saludoTexto, 45, function() {
      cascoImg.style.animation = 'none';
      _cascoSonidoStop();

      if (_hayRuta) {
        // ── Rama ruta activa: sin subtítulo de etapa, directo al mensaje ──
        subCtx.style.display = 'none';
        var sub = document.createElement('p');
        sub.style.cssText = 'font-size:15px;color:#1a0800;line-height:1.6;margin-bottom:16px';
        var btnSi = document.createElement('button');
        btnSi.textContent = _t.asistSiVerRuta||'Sí, ver ruta';
        btnSi.style.cssText = 'width:100%;background:linear-gradient(135deg,#2d4a1e,#1e3212);color:#f5e6c8;border:none;border-radius:8px;padding:13px;font-size:14px;font-weight:700;cursor:pointer;font-family:DM Sans,sans-serif;box-shadow:0 2px 8px rgba(45,74,30,0.4);margin-bottom:8px';
        btnSi.addEventListener('click', function(){ _renderRevision(); });
        var btnVolver = document.createElement('button');
        btnVolver.textContent = _t.asistNoVolver||'No, volver al mapa';
        btnVolver.style.cssText = 'width:100%;background:rgba(80,40,0,0.18);color:#fff8e8;border:1.5px solid #7a5010;border-radius:8px;padding:13px;font-size:14px;font-weight:600;cursor:pointer;font-family:DM Sans,sans-serif;margin-bottom:8px';
        btnVolver.addEventListener('click', function(){ _renderDespedida(); });
        var btnOtras = document.createElement('button');
        btnOtras.textContent = _t.asistOtrasOpc||'☰ Otras opciones';
        btnOtras.style.cssText = 'width:100%;background:rgba(80,40,0,0.10);color:#5a3008;border:1px solid #b07030;border-radius:8px;padding:11px;font-size:14px;font-weight:600;cursor:pointer;font-family:DM Sans,sans-serif';
        btnOtras.addEventListener('click', function(){ _renderMenuPrincipal(); });
        setTimeout(function() {
          cascoImg.style.animation = '_casc-pulse 2.4s ease-in-out infinite';
          _cascoSonido(_cascoDur((_t.asistTieneRuta||'Tienes una ruta seleccionada con ') + rutaPuntos.length + (rutaPuntos.length !== 1 ? (_t.asistTieneRutaSufP||' lugares. ¿Quieres revisarla o modificarla?') : (_t.asistTieneRutaSuf||' lugar. ¿Quieres revisarla o modificarla?')), 32));
          _twSeq([[sub, (_t.asistTieneRuta||'Tienes una ruta seleccionada con ') + rutaPuntos.length + (rutaPuntos.length !== 1 ? (_t.asistTieneRutaSufP||' lugares. ¿Quieres revisarla o modificarla?') : (_t.asistTieneRutaSuf||' lugar. ¿Quieres revisarla o modificarla?')), 32, inner]], cascoImg, function() {
            inner.appendChild(btnSi);
            inner.appendChild(btnVolver);
            inner.appendChild(btnOtras);
          });
        }, 120);
        return;
      }

      // ── Sin ruta: subtítulo etapa cercana → resto del flujo ──
      _subtituloEtapaCercana(function(subTexto) {
        setTimeout(function() {
          cascoImg.style.animation = '_casc-pulse 2.4s ease-in-out infinite';
          _cascoSonido(_cascoDur(subTexto, 35));
          _typewriter(subCtx, subTexto, 35, function() {
            cascoImg.style.animation = 'none';
            _cascoSonidoStop();

          // Botón marcar ruta a próxima etapa (se añade más abajo, justo encima de los botones de acción)
          var btnEtapa = null;
          if (window._etapaProxima) {
            btnEtapa = document.createElement('button');
            var _ep = window._etapaProxima;
            var _epNombreCompleto = (idiomaActual==='gl'&&_ep.p.nombre_gl)?_ep.p.nombre_gl:(idiomaActual==='en'&&_ep.p.nombre_en)?_ep.p.nombre_en:_ep.p.nombre;
            var _epPartes = _epNombreCompleto.split('·');
            var _epNombreCorto = _epPartes.length>1 ? _epPartes[1].split('→')[0].trim() : _epNombreCompleto;
            btnEtapa.textContent = (_t.asistMarcarRuta||'🗺️ Marcar etapa hacia') + ' ' + _epNombreCorto + ' →';
            btnEtapa.style.cssText = 'width:100%;background:linear-gradient(135deg,#2d4a1e,#1e3212);color:#f5e6c8;border:none;border-radius:8px;padding:12px 16px;font-size:14px;font-weight:700;cursor:pointer;font-family:DM Sans,sans-serif;box-shadow:0 2px 8px rgba(45,74,30,0.4);margin-bottom:10px;display:flex;align-items:center;gap:8px';
            btnEtapa.addEventListener('click', function() {
              addToRoute(_ep.p.id);
              cerrar();
              setTimeout(function() {
                if (mapa && _ep.p.lat && _ep.p.lng) mapa.setView([_ep.p.lat, _ep.p.lng], 13);
              }, 350);
            });
          }

          if (false) { // placeholder — rama ruta ya gestionada arriba
            void 0;
          } else if (cercanos.length === 0) {
            // Rama sin GPS
            var noGps = document.createElement('p');
            noGps.style.cssText = 'font-size:15px;color:rgba(255,255,255,0.8);line-height:1.6;margin-bottom:20px';
            var btnCerrar = document.createElement('button');
            btnCerrar.textContent = _t.asistCerrar||'Cerrar';
            btnCerrar.style.cssText = 'width:100%;background:rgba(255,255,255,0.2);color:#fff;border:1px solid rgba(255,255,255,0.3);border-radius:12px;padding:12px;font-size:16px;font-weight:600;cursor:pointer;font-family:DM Sans,sans-serif';
            btnCerrar.addEventListener('click', function(){ _renderDespedida(); });
            _twSeq([[noGps, _capital(_t.asistSinGps||'Activa el GPS para ver los lugares del Camino más cercanos a ti.'), 32, inner]], cascoImg, function() {
              if (btnEtapa) inner.appendChild(btnEtapa);
              inner.appendChild(btnCerrar);
            });

          } else {
            // Rama cercanos
            var primero = cercanos[0];
            var distTexto = primero.dist < 1000 ? Math.round(primero.dist) + ' m' : (primero.dist/1000).toFixed(1) + ' km';
            var sub = document.createElement('p');
            sub.style.cssText = 'font-size:15px;color:rgba(255,255,255,0.85);line-height:1.6;margin-bottom:6px';
            var sub2 = document.createElement('p');
            sub2.style.cssText = 'font-size:15px;color:#1a0800;line-height:1.5;margin-bottom:12px';
            var btnRow = document.createElement('div');
            btnRow.style.cssText = 'display:flex;gap:10px';
            var btnSi = document.createElement('button');
            btnSi.textContent = _t.asistSiVerLugares||'Ver lugares cercanos';
            btnSi.style.cssText = 'flex:1;background:#fff;color:#0F6E56;border:none;border-radius:12px;padding:13px;font-size:14px;font-weight:700;cursor:pointer;font-family:DM Sans,sans-serif';
            btnSi.addEventListener('click', function(){ _renderPaso2(cercanos); });
            var btnNo = document.createElement('button');
            btnNo.textContent = _t.asistAhoraNno||'Otras opciones';
            btnNo.style.cssText = 'flex:1;background:rgba(255,255,255,0.15);color:#fff;border:1px solid rgba(255,255,255,0.3);border-radius:12px;padding:13px;font-size:14px;font-weight:600;cursor:pointer;font-family:DM Sans,sans-serif';
            btnNo.addEventListener('click', function(){ _renderMenuPrincipal(); });
            btnRow.appendChild(btnSi);
            btnRow.appendChild(btnNo);
            _twSeq([
              [sub, (_t.asistCercanosPre||'Además tienes') + ' ' + cercanos.length + ' ' + (cercanos.length !== 1 ? (_t.asistCercanosLugares||'lugares') : (_t.asistCercanosLugar||'lugar')) + ' ' + (_t.asistCercanosDe||'interesantes cerca de ti. El más próximo es') + ' ' + primero.poi.nombre + ', ' + (_t.asistCercanosA||'a') + ' ' + distTexto + '.', 30, inner],
              [sub2, _t.asistPreguntaVisitar||'¿Cómo quieres proceder?', 35, inner]
            ], cascoImg, function() {
              if (btnEtapa) inner.appendChild(btnEtapa);
              inner.appendChild(btnRow);
              
            });
          } // fin else cercanos
          }); // fin _typewriter subCtx
        }, 120); // fin setTimeout
      }); // fin _subtituloContextual callback
    }); // fin _typewriter saludo
  }

  // ── SUGERENCIAS: cuando el usuario dice "ahora no" ───────────────
  // Catálogo de opciones con descripción extendida
  var _opcionesCatalogo = [
    {
      emoji: '🆘',
      titulo: _t.asistOp5Tit||'Emergencias y seguridad',
      desc: _t.asistOp5Desc||'Teléfonos útiles y recursos para el Camino.',
      detalle: _t.asistOp5Det||[
        'Un panel de recursos esenciales pensado para cuando el Camino se complica: teléfonos de emergencia, contactos de la Guardia Civil, Cruz Roja y servicios sanitarios en las principales etapas.',
        'También encontrarás consejos básicos de seguridad para peregrinos: qué hacer si te pierdes, cómo gestionar una lesión en ruta y cómo activar tu localización de emergencia desde el móvil.',
        '📞 Teléfonos de emergencia · 🏥 Servicios sanitarios · 🧭 Protocolos de seguridad · 🆘 Localización GPS'
      ],
      abrir: function() {
        cerrar();
        setTimeout(function(){ _irAlMapa(); setTimeout(abrirSOSDrawer, 400); }, 340);
      }
    },
    {
      emoji: '🧭',
      titulo: _t.asistBtnBrujula||'Usar la brújula',
      desc: _t.asistBtnBrujulaDesc||'Oriéntate con la brújula digital del Camino',
      directo: true,
      detalle: [],
      abrir: function() {
        _renderBrujulaModal();
      }
    },
    {
      emoji: '🎲',
      titulo: _t.asistOp3Tit||'Juego del Tablero de la Oca',
      desc: _t.asistOp3Desc||'63 casillas jacobeas. Desbloquéalas visitando lugares reales.',
      detalle: _t.asistOp3Det||[
        'Una versión jacobea del clásico juego de la oca con 63 casillas inspiradas en el Camino. Cada casilla tiene su nombre en latín, su mecánica especial y su simbolismo peregrino.',
        'Las casillas se desbloquean automáticamente cuando visitas los lugares reales del Camino con el GPS activado. Casillas especiales como la Muerte, el Laberinto o la Cárcel tienen mecánicas únicas que condicionan tu avance.',
        '🎲 63 casillas · 📍 Desbloqueo por GPS · ⚔️ Casillas especiales · 🏆 Progresión real en el Camino'
      ],
      abrir: function() {
        cerrar();
        setTimeout(function(){ _irAlMapa(); setTimeout(function(){ abrirAlbumPanel(); setTimeout(abrirTableroDrawer, 300); }, 400); }, 340);
      }
    },
    {
      emoji: '🏅',
      titulo: _t.asistOp4Tit||'Álbum del Peregrino',
      desc: _t.asistOp4Desc||'Tu colección de cromos desbloqueados en el Camino.',
      detalle: _t.asistOp4Det||[
        'El Álbum registra cada lugar que visitas a lo largo del Camino. Cuando te acercas a menos de 25 metros de un punto de interés con el GPS activo, desbloqueas automáticamente su cromo coleccionable.',
        'Cada cromo tiene diseño de postal barroca con iconografía jacobea, el nombre del lugar, su descripción histórica y tu fecha de visita. Cuantos más reúnas, mayor será tu rango de peregrino: desde Aspirante hasta Ultreia 🏆.',
        '🐚 Cromos coleccionables · 📍 GPS automático · 🏆 Sistema de rangos · 📅 Historial de visitas'
      ],
      abrir: function() {
        cerrar();
        setTimeout(function(){ _irAlMapa(); setTimeout(abrirAlbumPanel, 400); }, 340);
      }
    }
  ];

  // ── MODAL BÚSQUEDA PRÓXIMA ────────────────────────────────────────
  function _abrirBusquedaProxima() {
    var old = document.getElementById('wizard-busqueda-modal');
    if (old) old.remove();

    var overlay = document.createElement('div');
    overlay.id = 'wizard-busqueda-modal';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:999999;background:rgba(0,0,0,0.72);display:flex;align-items:flex-end;justify-content:center;font-family:DM Sans,sans-serif';

    var box = document.createElement('div');
    box.style.cssText = 'background:radial-gradient(ellipse at 15% 20%, rgba(90,50,0,0.18) 0%, transparent 55%),radial-gradient(ellipse at 85% 75%, rgba(60,30,0,0.20) 0%, transparent 50%),radial-gradient(ellipse at 55% 40%, rgba(180,130,40,0.10) 0%, transparent 40%),linear-gradient(180deg,#c9933a 0%,#b87d28 40%,#a86d18 100%);border-radius:20px 20px 0 0;padding:20px 20px 44px;width:100%;max-width:480px;box-sizing:border-box;position:relative;transform:translateY(100%);transition:transform 0.3s cubic-bezier(0.32,0.72,0,1);border-top:3px solid #5a3008;box-shadow:0 -4px 32px rgba(0,0,0,0.5),inset 0 0 60px rgba(60,25,0,0.25),inset 0 0 15px rgba(40,15,0,0.3),inset 0 1px 0 rgba(255,220,120,0.15)';

    function cerrarModal() {
      box.style.transform = 'translateY(100%)';
      setTimeout(function(){ overlay.remove(); }, 300);
    }

    // Handle
    var handle = document.createElement('div');
    handle.style.cssText = 'width:40px;height:4px;background:rgba(139,105,20,0.4);border-radius:2px;margin:0 auto 16px';
    box.appendChild(handle);

    // Botón X
    var btnX = document.createElement('button');
    btnX.textContent = '✕';
    btnX.style.cssText = 'position:absolute;top:12px;right:12px;width:32px;height:32px;background:rgba(0,0,0,0.2);border:1.5px solid #7a5010;border-radius:50%;color:#fff8e8;font-size:15px;cursor:pointer;display:flex;align-items:center;justify-content:center;-webkit-appearance:none;z-index:10';
    btnX.addEventListener('click', cerrarModal);
    box.appendChild(btnX);

    // Título
    var tit = document.createElement('div');
    tit.style.cssText = 'font-family:DM Sans,sans-serif;font-size:17px;font-weight:400;color:#1a0800;margin-bottom:6px;padding-right:36px;line-height:1.3';
    tit.innerHTML = _t.asistBuscarTit||'🔍 Buscar algo próximo a ti';
    box.appendChild(tit);

    var sub = document.createElement('p');
    sub.style.cssText = 'font-size:14px;color:#1a0800;margin-bottom:14px;line-height:1.5';
    sub.innerHTML = _capital(_t.asistBuscarSub||'Escribe lo que necesitas. Los resultados aparecerán en el mapa en un radio de 1 km.');
    box.appendChild(sub);

    // Campo de búsqueda
    var inputWrap = document.createElement('div');
    inputWrap.style.cssText = 'display:flex;gap:8px;margin-bottom:12px';
    var inputCont = document.createElement('div');
    inputCont.style.cssText = 'flex:1;position:relative;display:flex;align-items:center';
    var input = document.createElement('input');
    input.type = 'text';
    input.placeholder = _t.asistBuscarPh||'albergue, farmacia, fuente, café…';
    input.style.cssText = 'width:100%;background:rgba(255,240,200,0.6);border:1.5px solid #7a5010;border-radius:8px;padding:10px 36px 10px 14px;font-size:16px;color:#1a0e00;font-family:DM Sans,sans-serif;outline:none;-webkit-appearance:none;box-sizing:border-box';
    input.className='busc-input';
    input.setAttribute('autocomplete','off');
    inputCont.appendChild(input);
    var btnBuscar = document.createElement('button');
    btnBuscar.textContent = _t.asistBuscarBtn||'Buscar';
    btnBuscar.style.cssText = 'background:linear-gradient(135deg,#2d4a1e,#1e3212);color:#f5e6c8;border:none;border-radius:8px;padding:10px 16px;font-size:16px;font-weight:700;cursor:pointer;font-family:DM Sans,sans-serif;white-space:nowrap;flex-shrink:0';
    inputWrap.appendChild(inputCont);
    inputWrap.appendChild(btnBuscar);
    box.appendChild(inputWrap);

    // Sugerencias rápidas
    var sugs = ['albergue','farmacia','supermercado','restaurante','café','fuente','iglesia','hospital','banco','gasolinera'];
    var sugWrap = document.createElement('div');
    sugWrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px';
    sugs.forEach(function(s) {
      var chip = document.createElement('button');
      chip.textContent = s;
      chip.style.cssText = 'background:rgba(255,220,140,0.35);color:#1a0e00;border:1px solid #7a5010;border-radius:20px;padding:5px 12px;font-size:14px;cursor:pointer;font-family:DM Sans,sans-serif;-webkit-appearance:none';
      chip.addEventListener('click', function(){ input.value = s; ejecutarBusqueda(s); });
      sugWrap.appendChild(chip);
    });
    box.appendChild(sugWrap);

    // Estado (spinner / mensaje)
    var estado = document.createElement('div');
    estado.style.cssText = 'font-size:14px;color:#1a0800;text-align:center;padding:8px 0;display:none';
    box.appendChild(estado);

    // Área de resultados
    var resultados = document.createElement('div');
    resultados.style.cssText = 'max-height:32vh;overflow-y:auto;display:flex;flex-direction:column;gap:6px;overscroll-behavior:contain';
    box.appendChild(resultados);

    overlay.appendChild(box);
    document.body.appendChild(overlay);
    setTimeout(function(){ box.style.transform = 'translateY(0)'; }, 20);
    setTimeout(function(){ input.focus(); }, 360);
    overlay.addEventListener('click', function(e){ if (e.target === overlay) cerrarModal(); });

    function ejecutarBusqueda(q) {
      if (!q || !q.trim()) return;
      q = q.trim();
      resultados.innerHTML = '';
      estado.style.display = 'none';
      input.style.borderColor = '#a07828';
      input.style.animation = '_input-blink 0.9s ease-in-out infinite';
      input.setAttribute('placeholder', '⏳ Buscando ' + q + '…');
      input.value = '';
      input.disabled = true;

      var refLat = (typeof userLat !== 'undefined' && userLat) ? userLat : (typeof mapa !== 'undefined' ? mapa.getCenter().lat : null);
      var refLng = (typeof userLng !== 'undefined' && userLng) ? userLng : (typeof mapa !== 'undefined' ? mapa.getCenter().lng : null);
      if (!refLat || !refLng) {
        input.style.borderColor = '#7a5010'; input.style.animation = ''; input.disabled = false;
        input.setAttribute('placeholder', _t.asistBuscarPh||'albergue, farmacia, fuente, café…');
        estado.style.display = 'block';
        estado.textContent = _t.asistBuscandoGps||'📍 Activa el GPS para buscar cerca de ti.';
        return;
      }

      var radio = 1000;
      var osmTag = (typeof _OVERPASS_TAGS !== 'undefined') ? _OVERPASS_TAGS[q] : null;

      function _mostrarResultados(items) {
        estado.style.display = 'none';
        resultados.innerHTML = '';
        if (!items || items.length === 0) {
          input.style.borderColor = '#7a5010'; input.style.animation = ''; input.disabled = false; input.setAttribute('placeholder', _t.asistBuscarPh||'albergue, farmacia, fuente, café…');
          estado.style.display = 'block';
          estado.textContent = '🔍 Sin resultados para "' + q + '" en 1 km.';
          return;
        }
        if (!window._wizSearchMarkers) window._wizSearchMarkers = [];
        // Limpiar marcadores anteriores y sus puntos de la ruta
        var _busqIds = window._wizSearchMarkers.map(function(m){ return m._busqId; }).filter(Boolean);
        window._wizSearchMarkers.forEach(function(m){ try{ mapa.removeLayer(m); }catch(e){} });
        window._wizSearchMarkers = [];
        if (_busqIds.length > 0) {
          var _teniaRutaBusq = rutaPuntos.some(function(p){ return _busqIds.indexOf(p.id) !== -1; });
          rutaPuntos = rutaPuntos.filter(function(p){ return _busqIds.indexOf(p.id) === -1; });
          PUNTOS = PUNTOS.filter(function(p){ return _busqIds.indexOf(p.id) === -1; });
          if (_teniaRutaBusq) actualizarRuta();
        }

        var iconoBusc = (typeof iconoBusqueda !== 'undefined') ? iconoBusqueda
          : L.divIcon({ html:'<div style="background:#DC2626;color:#fff;width:32px;height:32px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.25)"><span style="transform:rotate(45deg);font-size:16px">🔍</span></div>', className:'', iconSize:[32,32], iconAnchor:[16,32], popupAnchor:[0,-32] });

        var bounds = [];
        items.forEach(function(it) {
          var lat = it.lat, lng = it.lng, nombre = it.nombre, dist = it.dist;
          var tmpId_mk = '_busq_' + lat.toString().replace('.','') + '_' + lng.toString().replace('.','');
          var mk = L.marker([lat, lng], { icon: iconoBusc }).addTo(mapa);
          mk._busqId = tmpId_mk;
          var popupEl = document.createElement('div');
          popupEl.style.cssText = 'font-family:DM Sans,sans-serif;min-width:160px';
          popupEl.innerHTML = '<strong>' + nombre + '</strong><br><span style="font-size:11px;color:#6b7280">📍 ' + (typeof formatDist==='function'?formatDist(dist):Math.round(dist)+'m') + '</span>' + (it.tel ? '<br>📞 ' + it.tel : '');
          var btnDiv = document.createElement('div');
          btnDiv.style.cssText = 'display:flex;gap:6px;margin-top:8px;flex-wrap:wrap';
          var btnAdd = document.createElement('button');
          btnAdd.textContent = '➕ Añadir a ruta';
          btnAdd.style.cssText = 'background:#E1F5EE;color:#0F6E56;border:1px solid rgba(29,158,117,0.4);padding:5px 12px;border-radius:12px;font-size:12px;font-weight:600;cursor:pointer;font-family:DM Sans,sans-serif';
          (function(la,lo,no,b){ b.addEventListener('click', function(){ _toggleBusquedaRuta(b,encodeURIComponent(no),la,lo); }); })(lat,lng,nombre,btnAdd);
          var btnNav = document.createElement('button');
          btnNav.textContent = '🗺️ Cómo llegar';
          btnNav.style.cssText = 'background:#1D9E75;color:#fff;border:none;padding:5px 12px;border-radius:12px;font-size:12px;cursor:pointer;font-family:DM Sans,sans-serif';
          (function(la,lo){ btnNav.addEventListener('click', function(){ irACoordenadasNav(la,lo); }); })(lat,lng);
          btnDiv.appendChild(btnAdd); btnDiv.appendChild(btnNav);
          popupEl.appendChild(btnDiv);
          mk.bindPopup(popupEl);
          window._wizSearchMarkers.push(mk);
          bounds.push([lat, lng]);
        });

        // Cerrar cajón y mostrar resultados en el mapa
        input.style.borderColor = '#7a5010'; input.style.animation = ''; input.disabled = false;
        _actualizarBtnLimpiar();
        cerrarModal();

                if (bounds.length === 1) mapa.setView(bounds[0], 17);
        else if (bounds.length > 1) mapa.fitBounds(bounds, { padding:[50,50] });

        setTimeout(function(){ var el=document.getElementById('map'); if(el){ var rect=el.getBoundingClientRect(); window.scrollTo({top:Math.max(0,window.pageYOffset+rect.top-(window.innerHeight/2)+(rect.height/2)),behavior:'smooth'}); } }, 600);
      }

      if (osmTag) {
        var query = '[out:json][timeout:10];(node' + osmTag + '(around:' + radio + ',' + refLat + ',' + refLng + ');way' + osmTag + '(around:' + radio + ',' + refLat + ',' + refLng + '););out center 15;';
        var xhr = new XMLHttpRequest();
        xhr.open('GET', 'https://overpass-api.de/api/interpreter?data=' + encodeURIComponent(query), true);
        xhr.timeout = 12000;
        function _fallbackNominatim() {
          estado.textContent = '⏳ Buscando en fuente alternativa…';
          var d = 0.009;
          var xhr2 = new XMLHttpRequest();
          xhr2.open('GET', 'https://nominatim.openstreetmap.org/search?format=json&limit=10&q=' + encodeURIComponent(q) + '&accept-language=es&viewbox=' + (refLng-d) + ',' + (refLat+d) + ',' + (refLng+d) + ',' + (refLat-d) + '&bounded=1', true);
          xhr2.onreadystatechange = function() {
            if (xhr2.readyState !== 4) return;
            if (xhr2.status === 200) {
              try {
                var res2 = JSON.parse(xhr2.responseText);
                var items2 = (res2||[]).map(function(r){
                  var la=parseFloat(r.lat), lo=parseFloat(r.lon);
                  return { lat:la, lng:lo, nombre:r.display_name.split(',')[0].trim(), dist:haversine(refLat,refLng,la,lo), tel:'' };
                }).filter(function(x){ return x.dist<=radio; });
                items2.sort(function(a,b){ return a.dist-b.dist; });
                _mostrarResultados(items2.slice(0,12));
              } catch(e){ estado.style.display='block'; estado.textContent='⚠️ Error al buscar. Inténtalo de nuevo.'; }
            } else { estado.style.display='block'; estado.textContent='⚠️ Error de red.'; }
          };
          xhr2.send();
        }
        xhr.onreadystatechange = function() {
          if (xhr.readyState !== 4) return;
          if (xhr.status === 200) {
            try {
              var res = JSON.parse(xhr.responseText);
              var items = (res.elements||[]).map(function(el){
                var la=el.lat||(el.center&&el.center.lat), lo=el.lon||(el.center&&el.center.lon);
                return { lat:la, lng:lo, nombre:(el.tags&&(el.tags.name||el.tags.brand))||q, dist:haversine(refLat,refLng,la,lo), tel:(el.tags&&el.tags.phone)||'' };
              }).filter(function(x){ return x.lat&&x.lng&&x.dist<=radio; });
              items.sort(function(a,b){ return a.dist-b.dist; });
              if (items.length > 0) {
                _mostrarResultados(items.slice(0,12));
              } else {
                // Sin resultados en Overpass → fallback Nominatim
                _fallbackNominatim();
              }
            } catch(e){ _fallbackNominatim(); }
          } else { _fallbackNominatim(); }
        };
        xhr.ontimeout = function() { _fallbackNominatim(); };
        xhr.send();
      } else {
        var d = 0.009;
        var xhr2 = new XMLHttpRequest();
        xhr2.open('GET', 'https://nominatim.openstreetmap.org/search?format=json&limit=10&q=' + encodeURIComponent(q) + '&accept-language=es&viewbox=' + (refLng-d) + ',' + (refLat+d) + ',' + (refLng+d) + ',' + (refLat-d) + '&bounded=1', true);
        xhr2.onreadystatechange = function() {
          if (xhr2.readyState !== 4) return;
          if (xhr2.status === 200) {
            try {
              var res2 = JSON.parse(xhr2.responseText);
              var items2 = (res2||[]).map(function(r){
                var la=parseFloat(r.lat), lo=parseFloat(r.lon);
                return { lat:la, lng:lo, nombre:r.display_name.split(',')[0].trim(), dist:haversine(refLat,refLng,la,lo), tel:'' };
              }).filter(function(x){ return x.dist<=radio; });
              items2.sort(function(a,b){ return a.dist-b.dist; });
              _mostrarResultados(items2.slice(0,12));
            } catch(e){ estado.style.display='block'; estado.textContent='⚠️ Error al buscar. Inténtalo de nuevo.'; }
          } else { estado.style.display='block'; estado.textContent='⚠️ Error de red.'; }
        };
        xhr2.send();
      }
    }

    btnBuscar.addEventListener('click', function(){ ejecutarBusqueda(input.value); });
    input.addEventListener('keydown', function(e){ if (e.key === 'Enter') ejecutarBusqueda(input.value); });
  }

  function _renderBrujulaModal() {
    inner.innerHTML = '';

    var tit = document.createElement('div');
    tit.style.cssText = 'font-family:DM Sans,sans-serif;font-size:20px;color:#1a0800;margin-bottom:14px;line-height:1.3;text-align:center';
    tit.textContent = _t.asistBrujulaTit || '🧭 La Brújula del Peregrino';
    inner.appendChild(tit);

    var p1 = document.createElement('p');
    p1.style.cssText = 'font-size:15px;color:#1a0800;line-height:1.7;margin-bottom:10px';
    p1.innerHTML = _capitalAll(_t.asistBrujulaP1 || 'La brújula te ayuda a orientarte en el Camino. Muestra el norte magnético y la dirección hacia Santiago de Compostela desde tu posición actual.');
    inner.appendChild(p1);

    var p2 = document.createElement('p');
    p2.style.cssText = 'font-size:15px;color:#1a0800;line-height:1.7;margin-bottom:16px';
    p2.innerHTML = _capitalAll(_t.asistBrujulaP2 || 'Para que funcione con precisión, mantén el móvil en posición horizontal y alejado de objetos metálicos o superficies que puedan interferir con el sensor.');
    inner.appendChild(p2);

    var sep = document.createElement('div');
    sep.style.cssText = 'text-align:center;color:#8b6914;letter-spacing:6px;margin-bottom:14px;font-size:16px';
    sep.textContent = '✦ ✦ ✦';
    inner.appendChild(sep);

    var btnAbrir = document.createElement('button');
    btnAbrir.textContent = _t.asistBrujulaBtn || 'Abrir la brújula →';
    btnAbrir.style.cssText = 'width:100%;background:linear-gradient(135deg,#2d4a1e,#1e3212);color:#f5e6c8;border:none;border-radius:8px;padding:13px;font-size:16px;font-weight:700;cursor:pointer;font-family:DM Sans,sans-serif;box-shadow:0 2px 8px rgba(45,74,30,0.4);margin-bottom:8px';
    btnAbrir.addEventListener('click', function() {
      cerrar();
      setTimeout(function(){ _irAlMapa(); setTimeout(abrirBrujulaDrawer, 400); }, 340);
    });
    inner.appendChild(btnAbrir);

    var btnAtras = document.createElement('button');
    btnAtras.textContent = _t.asistAtras || '← Volver';
    btnAtras.style.cssText = 'width:100%;background:rgba(0,0,0,0.2);color:#fff8e8;border:1px solid #7a5010;border-radius:8px;padding:11px;font-size:15px;font-weight:600;cursor:pointer;font-family:DM Sans,sans-serif;margin-bottom:8px;flex-shrink:0';
    btnAtras.addEventListener('click', function(){ _renderPaso1(); });
    inner.appendChild(btnAtras);
  }

  // ── VISTA "LEJOS DEL CAMINO" ───────────────────────────────────
  // Se muestra cuando el usuario está a >200 km del Camino oficial. En vez
  // del flujo de etapa/cercanos (distancias absurdas), ofrece solo acciones
  // que no dependen de la ruta: brújula, historia, añadir punto, emergencias.
  function _renderLejos() {
    if (panel._sugerenciasWrap) { panel._sugerenciasWrap.remove(); panel._sugerenciasWrap = null; }
    inner.style.cssText = 'position:relative;z-index:1;flex:1;min-height:0;display:flex;flex-direction:column;padding:0 20px 40px;box-sizing:border-box';
    inner.innerHTML = '';

    var header = document.createElement('div');
    header.style.cssText = 'flex-shrink:0';
    _cascoTypewriter(header, _t.asistLejosTit || 'Estás lejos del Camino');

    var msg = document.createElement('p');
    msg.style.cssText = 'font-size:14px;color:#3d1f00;line-height:1.5;margin:8px 0 14px;opacity:0.9';
    msg.textContent = _t.asistLejosMsg || 'Esta guía cubre las rutas de Galicia y el norte de Portugal. Aún puedes usar estas funciones:';
    header.appendChild(msg);
    inner.appendChild(header);

    var lista = document.createElement('div');
    lista.style.cssText = 'display:flex;flex-direction:column;gap:8px;margin-bottom:14px;flex:1;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:4px 2px;overscroll-behavior:contain';

    var opciones = [
      { emoji:'🧪', tit:_t.asistSimTit||'Simular recorrido',        desc:_t.asistSimDesc||'Coloca una posición ficticia sobre el Camino y pruébalo todo.', accion:function(){ cerrar(); setTimeout(function(){ _irAlMapa(); setTimeout(function(){ if (typeof _iniciarSimulacion==='function') _iniciarSimulacion(); }, 400); }, 340); } },
      { emoji:'🧭', tit:_t.asistBtnBrujula||'Usar la brújula',        desc:_t.asistBtnBrujulaDesc||'Oriéntate con la brújula digital del Camino', accion:function(){ _renderBrujulaModal(); } },
      { emoji:'🐚', tit:_t.asistOp2Tit||'Historia Compostelana',       desc:_t.asistOp2Desc||'El Camino, los templarios, las rutas históricas…', accion:function(){ cerrar(); setTimeout(function(){ _irAlMapa(); setTimeout(abrirHistoriaDrawer, 400); }, 340); } },
      { emoji:'📍', tit:_t.asistBtnAnadirPunto||'Añadir punto o alerta', desc:_t.asistBtnAnadirDesc||'Recomienda un lugar, añade una alerta o un punto de interés', accion:function(){ cerrar(); setTimeout(function(){ _irAlMapa(); setTimeout(abrirFormPOI, 400); }, 340); } },
      { emoji:'🆘', tit:_t.asistOp5Tit||'Emergencias y seguridad',     desc:_t.asistOp5Desc||'Teléfonos útiles y recursos para el Camino.', accion:function(){ cerrar(); setTimeout(function(){ _irAlMapa(); setTimeout(abrirSOSDrawer, 400); }, 340); } }
    ];

    opciones.forEach(function(op) {
      var fila = document.createElement('button');
      fila.style.cssText = 'display:flex;align-items:center;gap:12px;background:rgba(0,0,0,0.2);border:1.5px solid #7a5010;border-radius:10px;padding:13px 14px;cursor:pointer;transition:background 0.15s;width:100%;box-sizing:border-box;text-align:left;flex-shrink:0';
      fila.addEventListener('click', op.accion);

      var em = document.createElement('div');
      em.style.cssText = 'font-size:26px;flex-shrink:0;width:34px;text-align:center';
      em.textContent = op.emoji;
      fila.appendChild(em);

      var info = document.createElement('div');
      info.style.cssText = 'flex:1;min-width:0';
      var titEl = document.createElement('div');
      titEl.style.cssText = 'font-family:DM Sans,sans-serif;font-size:15px;color:#1a0800;margin-bottom:2px;line-height:1.3';
      titEl.textContent = op.tit.replace(/^[\u{1F000}-\u{1FFFF}\u{2600}-\u{27FF}\uFE0F\s]+/u, '').trim();
      var descEl = document.createElement('div');
      descEl.style.cssText = 'font-size:13px;color:#3d1f00;line-height:1.3;opacity:0.85';
      descEl.textContent = op.desc;
      info.appendChild(titEl);
      info.appendChild(descEl);
      fila.appendChild(info);

      var arr = document.createElement('div');
      arr.style.cssText = 'color:#7a5010;font-size:20px;flex-shrink:0';
      arr.textContent = '›';
      fila.appendChild(arr);

      lista.appendChild(fila);
    });
    inner.appendChild(lista);

    var btnCerrar = document.createElement('button');
    btnCerrar.textContent = _t.asistCerrar||'Cerrar';
    btnCerrar.style.cssText = 'width:100%;background:rgba(0,0,0,0.2);color:#fff8e8;border:1px solid #7a5010;border-radius:8px;padding:11px;font-size:15px;font-weight:600;cursor:pointer;font-family:DM Sans,sans-serif;flex-shrink:0';
    btnCerrar.addEventListener('click', function(){ _renderDespedida(); });
    inner.appendChild(btnCerrar);
  }

  function _renderMenuPrincipal() {
    inner.innerHTML = '';

    // ── Header fijo (título + adorno) ──────────────────────────────
    var header = document.createElement('div');
    header.style.cssText = 'flex-shrink:0';

    _cascoTypewriter(header, _t.asistMenuTit||'¿Qué te apetece explorar?');

    var orn = document.createElement('div');
    orn.style.cssText = 'text-align:center;color:#8b6914;letter-spacing:6px;margin:8px 0 14px;font-size:15px';
    orn.textContent = '✦ ✦ ✦';
    header.appendChild(orn);

    inner.appendChild(header);

    // ── Zona scrollable con las opciones ───────────────────────────
    var lista = document.createElement('div');
    lista.style.cssText = 'display:flex;flex-direction:column;gap:8px;margin-bottom:14px;flex:1;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:4px 2px;overscroll-behavior:contain';

    var opciones = [
      { emoji:'🔍', tit:_t.asistBtnBuscar||'🔍 Buscar algo próximo',          desc:_t.asistBuscarSub||'Busca cualquier lugar o servicio en un radio de 1 km.',       accion:function(){ _abrirBusquedaProxima(); } },
      { emoji:'🧪', tit:_t.asistSimTit||'Simular recorrido',                   desc:_t.asistSimDesc||'Coloca una posición ficticia sobre el Camino y pruébalo todo.', accion:function(){ cerrar(); setTimeout(function(){ _irAlMapa(); setTimeout(function(){ if (typeof _iniciarSimulacion==='function') _iniciarSimulacion(); }, 400); }, 340); } },
      { emoji:'🐚', tit:_t.asistOp2Tit||'Historia Compostelana',               desc:_t.asistOp2Desc||'El Camino, los templarios, las rutas históricas…',              accion:function(){ cerrar(); setTimeout(function(){ _irAlMapa(); setTimeout(abrirHistoriaDrawer, 400); }, 340); } },
      { emoji:'🗺️', tit:_t.rofTutBtn||'Mapa de trazados oficiales',             desc:_t.rofTutSub||'Cómo ver los Caminos y usar el modo Ruta Oficial',          accion:function(){ cerrar(); setTimeout(function(){ _irAlMapa(); setTimeout(function(){ if(window.abrirTutorialRutaOficial) window.abrirTutorialRutaOficial(); }, 400); }, 340); } },
      { emoji:'📍', tit:_t.asistBtnAnadirPunto||'📍 Añadir punto o alerta',    desc:_t.asistBtnAnadirDesc||'Recomienda un lugar, añade una alerta o un punto de interés', accion:function(){ cerrar(); setTimeout(function(){ _irAlMapa(); setTimeout(abrirFormPOI, 400); }, 340); } },
      { emoji:'✨', tit:_t.asistBtnMasOpc||'✨ Más opciones interesantes',      desc:_t.asistBtnMasOpcDesc||'Historia, álbum, juego de la oca, emergencias…',             accion:function(){ _renderSugerencias(); } }
    ];

    opciones.forEach(function(op) {
      var fila = document.createElement('button');
      fila.style.cssText = 'display:flex;align-items:center;gap:12px;background:rgba(0,0,0,0.2);border:1.5px solid #7a5010;border-radius:10px;padding:13px 14px;cursor:pointer;transition:background 0.15s;width:100%;box-sizing:border-box;text-align:left;flex-shrink:0';
      fila.addEventListener('click', op.accion);

      var em = document.createElement('div');
      em.style.cssText = 'font-size:26px;flex-shrink:0;width:34px;text-align:center';
      em.textContent = op.emoji;
      fila.appendChild(em);

      var info = document.createElement('div');
      info.style.cssText = 'flex:1;min-width:0';
      var titEl = document.createElement('div');
      titEl.style.cssText = 'font-family:DM Sans,sans-serif;font-size:15px;color:#1a0800;margin-bottom:2px;line-height:1.3';
      titEl.textContent = op.tit.replace(/^[\u{1F000}-\u{1FFFF}\u{2600}-\u{27FF}\uFE0F\s]+/u, '').trim();
      var descEl = document.createElement('div');
      descEl.style.cssText = 'font-size:13px;color:#3d1f00;line-height:1.3;opacity:0.85';
      descEl.textContent = op.desc;
      info.appendChild(titEl);
      info.appendChild(descEl);
      fila.appendChild(info);

      var arr = document.createElement('div');
      arr.style.cssText = 'color:#7a5010;font-size:20px;flex-shrink:0';
      arr.textContent = '›';
      fila.appendChild(arr);

      lista.appendChild(fila);
    });

    inner.appendChild(lista);

    // ── Pie fijo ──────────────────────────────────────────────────
    var btnAtras = document.createElement('button');
    btnAtras.textContent = _t.asistAtras||'← Volver';
    btnAtras.style.cssText = 'width:100%;background:rgba(0,0,0,0.2);color:#fff8e8;border:1px solid #7a5010;border-radius:8px;padding:11px;font-size:15px;font-weight:600;cursor:pointer;font-family:DM Sans,sans-serif;margin-bottom:8px;flex-shrink:0';
    btnAtras.addEventListener('click', function(){ _renderPaso1(); });
    inner.appendChild(btnAtras);

    var btnCerrar = document.createElement('button');
    btnCerrar.textContent = _t.asistQuizas||'Quizás más tarde';
    btnCerrar.style.cssText = 'width:100%;background:transparent;color:rgba(26,8,0,0.4);border:none;padding:8px;font-size:14px;cursor:pointer;font-family:DM Sans,sans-serif;flex-shrink:0';
    btnCerrar.addEventListener('click', function(){ _renderDespedida(); });
    inner.appendChild(btnCerrar);
  }

  function _renderSugerencias() {
    // Limpiar wrap de versiones anteriores si existe
    if (panel._sugerenciasWrap) { panel._sugerenciasWrap.remove(); panel._sugerenciasWrap = null; }
    inner.style.cssText = 'position:relative;z-index:1;flex:1;min-height:0;display:flex;flex-direction:column;padding:0 20px 40px;box-sizing:border-box';
    inner.innerHTML = '';

    var adorno = document.createElement('div');
    adorno.style.cssText = 'text-align:center;color:rgba(90,48,0,0.45);font-size:13px;letter-spacing:4px;margin-bottom:8px';
    adorno.textContent = '✦ ✦ ✦';
    inner.appendChild(adorno);

    var hint = document.createElement('p');
    hint.style.cssText = 'font-size:14px;color:#8b6914;margin-bottom:14px;font-style:italic';
    _cascoTypewriter(inner, _t.asistSugTit||'Aquí tienes otras funciones que quizás te gustarán', null, 42, function(cascoImg) {
      _twSeq([[hint, _capital(_t.asistMasCosa||'Hay mucho más en la guía. Elige algo que te llame la atención:'), 30, inner]], cascoImg);
    });

    // Lista con max-height fijo y scroll — igual que _renderPaso2
    var lista = document.createElement('div');
    lista.style.cssText = 'display:flex;flex-direction:column;gap:8px;margin-bottom:18px;max-height:40vh;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:4px 2px';

    _opcionesCatalogo.forEach(function(op) {
      var fila = document.createElement('div');
      fila.style.cssText = 'display:flex;align-items:center;gap:12px;background:rgba(0,0,0,0.12);border:1.5px solid #b8935a;border-radius:10px;padding:10px 12px;cursor:pointer;transition:all 0.15s';
      fila.addEventListener('click', function(){ if (op.directo) { op.abrir(); } else { _renderDetalle(op); } });

      var em = document.createElement('div');
      em.style.cssText = 'font-size:24px;flex-shrink:0;width:32px;text-align:center';
      em.textContent = op.emoji;
      fila.appendChild(em);

      var info = document.createElement('div');
      info.style.cssText = 'flex:1;min-width:0';
      info.innerHTML = '<div style="font-family:DM Sans,sans-serif;font-size:16px;color:#1a0800;margin-bottom:2px">' + op.titulo + '</div>'
        + '<div style="font-size:13px;color:#5c3d1e;line-height:1.4;opacity:0.85">' + op.desc + '</div>';
      fila.appendChild(info);

      var arr = document.createElement('div');
      arr.style.cssText = 'color:#7a5010;font-size:20px;flex-shrink:0';
      arr.textContent = '›';
      fila.appendChild(arr);

      lista.appendChild(fila);
    });
    inner.appendChild(lista);

    var btnAtras = document.createElement('button');
    btnAtras.textContent = _t.asistAtras||'← Volver';
    btnAtras.style.cssText = 'width:100%;background:rgba(0,0,0,0.2);color:#fff8e8;border:1px solid #7a5010;border-radius:8px;padding:11px;font-size:15px;font-weight:600;cursor:pointer;font-family:DM Sans,sans-serif;margin-bottom:8px;flex-shrink:0';
    btnAtras.addEventListener('click', function(){ _renderMenuPrincipal(); });
    inner.appendChild(btnAtras);

    var btnCerrar = document.createElement('button');
    btnCerrar.textContent = _t.asistQuizas||'Quizás más tarde';
    btnCerrar.style.cssText = 'width:100%;background:transparent;color:rgba(26,8,0,0.4);border:none;padding:8px;font-size:14px;cursor:pointer;font-family:DM Sans,sans-serif;flex-shrink:0';
    btnCerrar.addEventListener('click', function(){ _renderDespedida(); });
    inner.appendChild(btnCerrar);
  }
  // ── DETALLE de opción + pregunta ¿ver otra? ──────────────────────
  function _renderDetalle(op) {
    inner.innerHTML = '';

    // Cabecera
    var cab = document.createElement('div');
    cab.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:12px';
    var cabEmoji = document.createElement('div');
    cabEmoji.style.cssText = 'font-size:32px;flex-shrink:0';
    cabEmoji.textContent = op.emoji;
    cab.appendChild(cabEmoji);
    inner.appendChild(cab);
    _cascoTypewriter(cab, op.titulo, null, 42, function(cascoImg) {
      // Párrafos descriptivos con typewriter encadenado
      var textos = document.createElement('div');
      textos.style.cssText = 'max-height:38vh;overflow-y:auto;margin-bottom:14px;padding-right:4px';
      inner.appendChild(textos);
      var _detPairs = [];
      op.detalle.forEach(function(parrafo, i) {
        var p = document.createElement('p');
        p.style.cssText = 'font-size:15px;color:' + (i === op.detalle.length - 1 ? 'rgba(26,8,0,0.78)' : '#1a0800') + ';line-height:1.7;margin-bottom:8px';
        _detPairs.push([p, parrafo, 26, textos]);
      });

      // Botón abrir panel
      var btnAbrir = document.createElement('button');
      btnAbrir.textContent = (_t.asistAbrir||'Abrir ') + op.titulo + ' →';
      btnAbrir.style.cssText = 'width:100%;background:linear-gradient(135deg,#2d4a1e,#1e3212);color:#f5e6c8;border:none;border-radius:8px;padding:12px;font-size:16px;font-weight:700;cursor:pointer;font-family:DM Sans,sans-serif;margin-bottom:10px;box-shadow:0 2px 8px rgba(45,74,30,0.4)';
      btnAbrir.addEventListener('click', op.abrir);

      // Separador
      var sep = document.createElement('div');
      sep.style.cssText = 'border-top:1px solid rgba(122,80,16,0.3);margin-bottom:10px';

      // ¿Ver otra opción?
      var pregunta = document.createElement('p');
      pregunta.style.cssText = 'font-size:15px;color:#1a0800;text-align:center;margin-bottom:10px';

      var btnRow = document.createElement('div');
      btnRow.style.cssText = 'display:flex;gap:8px';
      var btnSi = document.createElement('button');
      btnSi.textContent = _t.asistVerMas||'Sí, ver más';
      btnSi.style.cssText = 'flex:1;background:rgba(0,0,0,0.15);color:#1a0800;border:1.5px solid #7a5010;border-radius:8px;padding:10px;font-size:15px;font-weight:600;cursor:pointer;font-family:DM Sans,sans-serif';
      btnSi.addEventListener('click', function(){ _renderSugerencias(); });
      var btnNo = document.createElement('button');
      btnNo.textContent = _t.asistNoCerrar||'No, cerrar';
      btnNo.style.cssText = 'flex:1;background:transparent;color:rgba(26,8,0,0.45);border:1px solid rgba(122,80,16,0.3);border-radius:8px;padding:10px;font-size:15px;cursor:pointer;font-family:DM Sans,sans-serif';
      btnNo.addEventListener('click', function(){ _renderDespedida(); });
      btnRow.appendChild(btnSi);
      btnRow.appendChild(btnNo);

      _twSeq(_detPairs, cascoImg, function() {
        inner.appendChild(btnAbrir);
        inner.appendChild(sep);
        _twSeq([[pregunta, _t.asistDetallePreg||'¿Quieres ver otra opción?', 35, inner]], cascoImg, function() {
          inner.appendChild(btnRow);
        });
      });
    });
  }

  // ── REVISIÓN: lista de POIs en ruta con opción a quitar ─────────
  function _renderRevision() {
    inner.innerHTML = '';

    _cascoTypewriter(inner, _t.asistRevTit||'Tu ruta actual');

    var hint = document.createElement('p');
    hint.style.cssText = 'font-size:14px;color:#fff0c0;margin-bottom:14px';
    hint.textContent = _t.asistPulsaX||'Pulsa la ✕ para quitar un lugar de la ruta.';
    inner.appendChild(hint);

    var lista = document.createElement('div');
    lista.style.cssText = 'display:flex;flex-direction:column;gap:8px;margin-bottom:18px;max-height:45vh;overflow-y:auto';

    function _renderItems() {
      lista.innerHTML = '';
      if (rutaPuntos.length === 0) {
        lista.innerHTML = '<div style="font-size:15px;color:rgba(255,255,255,0.5);padding:12px 0;text-align:center">La ruta está vacía.</div>';
        return;
      }
      rutaPuntos.forEach(function(p, idx) {
        var fila = document.createElement('div');
        fila.style.cssText = 'display:flex;align-items:center;gap:10px;background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.15);border-radius:12px;padding:10px 12px';

        var num = document.createElement('div');
        num.style.cssText = 'width:22px;height:22px;border-radius:50%;background:rgba(255,255,255,0.25);color:#fff;font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0';
        num.textContent = idx + 1;
        fila.appendChild(num);

        var nombre = document.createElement('div');
        nombre.style.cssText = 'flex:1;font-size:15px;font-weight:600;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis';
        nombre.textContent = p.nombre;
        fila.appendChild(nombre);

        var btnDel = document.createElement('button');
        btnDel.textContent = '✕';
        btnDel.style.cssText = 'width:28px;height:28px;border-radius:50%;background:rgba(220,38,38,0.35);border:1px solid rgba(220,38,38,0.5);color:#fff;font-size:15px;cursor:pointer;flex-shrink:0;display:flex;align-items:center;justify-content:center;-webkit-appearance:none';
        btnDel.addEventListener('click', function() {
          try { quitarDeRuta(p.id); } catch(e) {
            rutaPuntos = rutaPuntos.filter(function(x){ return x.id !== p.id; });
            try { actualizarRuta(); } catch(e2){}
          }
          _renderItems();
        });
        fila.appendChild(btnDel);
        lista.appendChild(fila);
      });
    }

    _renderItems();
    inner.appendChild(lista);

    var btnVolver = document.createElement('button');
    btnVolver.textContent = _t.asistRegresarMapa||'← Regresar al mapa';
    btnVolver.style.cssText = 'width:100%;background:linear-gradient(135deg,#2d4a1e,#1e3212);color:#f5e6c8;border:none;border-radius:8px;padding:13px;font-size:16px;font-weight:700;cursor:pointer;font-family:DM Sans,sans-serif;box-shadow:0 2px 8px rgba(45,74,30,0.4)';
    btnVolver.addEventListener('click', function(){ _renderDespedida(); });
    inner.appendChild(btnVolver);
  }

  // ── PASO 2: Lista de 5 POIs para seleccionar ────────────────────
  function _renderPaso2(cercanos) {
    inner.innerHTML = '';
    var seleccionados = {};

    var adornoPaso2 = document.createElement('div');
    adornoPaso2.style.cssText = 'text-align:center;color:#8b6914;letter-spacing:6px;margin:4px 0 10px;font-size:15px;flex-shrink:0';
    adornoPaso2.textContent = '✦ ✦ ✦';
    inner.appendChild(adornoPaso2);
    var hint = document.createElement('p');
    hint.style.cssText = 'font-size:15px;color:#1a0800;margin-bottom:14px;font-style:italic';
    _cascoTypewriter(inner, _t.asistPaso2Tit||'Selecciona qué te gustaría visitar', null, 42, function(cascoImg) {
      _twSeq([[hint, _t.asistEligeUno||'Puedes elegir uno o varios lugares.', 32, inner]], cascoImg);
    });

    // Lista de POIs
    var lista = document.createElement('div');
    lista.style.cssText = 'display:flex;flex-direction:column;gap:8px;margin-bottom:18px;max-height:40vh;overflow-y:auto;padding:4px 2px';

    cercanos.forEach(function(item) {
      var p = item.poi;
      var distTexto = item.dist < 1000 ? Math.round(item.dist) + ' m' : (item.dist/1000).toFixed(1) + ' km';
      var fila = document.createElement('div');
      fila.className = 'wizard-poi-fila';
      fila.dataset.poiId = p.id;
      fila.style.cssText = 'display:flex;align-items:center;gap:10px;background:rgba(0,0,0,0.12);border:1.5px solid #b8935a;border-radius:10px;padding:10px 12px;cursor:pointer;transition:all 0.15s';

      var check = document.createElement('div');
      check.className = 'wizard-poi-check';
      check.style.cssText = 'width:22px;height:22px;border-radius:6px;border:2px solid #7a5010;background:rgba(255,255,255,0.15);flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:15px;color:#1a0800;transition:all 0.15s';
      fila.appendChild(check);

      var emoji = document.createElement('span');
      emoji.textContent = p.emoji || '📍';
      emoji.style.cssText = 'font-size:20px;flex-shrink:0';
      fila.appendChild(emoji);

      var info = document.createElement('div');
      info.style.cssText = 'flex:1;min-width:0';
      var _visitadoWiz = window._albumVisitasSet && window._albumVisitasSet[p.id];
      var _visitBadge = _visitadoWiz
        ? '<span style="display:inline-flex;align-items:center;gap:3px;background:rgba(45,74,30,0.85);color:#d4f0b0;border:1px solid #2d4a1e;border-radius:10px;font-size:12px;font-weight:600;padding:1px 7px;margin-left:6px;font-family:DM Sans,sans-serif">✓ Visitado</span>'
        : '<span style="display:inline-flex;align-items:center;gap:3px;background:rgba(122,31,31,0.75);color:#ffd0d0;border:1px solid #7a1f1f;border-radius:10px;font-size:12px;font-weight:500;padding:1px 7px;margin-left:6px;font-family:DM Sans,sans-serif">🔒 Sin visitar</span>';
      info.innerHTML = '<div style="font-family:IM Fell English,serif;font-size:16px;color:#1a0800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + p.nombre + '</div>'
        + '<div style="font-size:13px;color:#5c3d1e;margin-top:2px;display:flex;align-items:center;flex-wrap:wrap;gap:2px">📍 ' + distTexto + _visitBadge + '</div>';
      fila.appendChild(info);

      // Botón ⓘ info ampliada del POI
      (function(poi) {
        var btnInfo = document.createElement('button');
        btnInfo.textContent = 'ⓘ';
        btnInfo.title = 'Más información';
        btnInfo.style.cssText = 'width:28px;height:28px;border-radius:50%;background:rgba(29,78,216,0.15);border:1.5px solid #3b82f6;color:#1d4ed8;font-size:16px;cursor:pointer;flex-shrink:0;display:flex;align-items:center;justify-content:center;-webkit-appearance:none;font-family:DM Sans,sans-serif;line-height:1';
        btnInfo.addEventListener('click', function(e) {
          e.stopPropagation();
          // Modal de información del POI
          var oldM = document.getElementById('wizard-poi-info-modal');
          if (oldM) oldM.remove();
          var mOverlay = document.createElement('div');
          mOverlay.id = 'wizard-poi-info-modal';
          mOverlay.style.cssText = 'position:fixed;inset:0;z-index:999999;background:rgba(0,0,0,0.7);display:flex;align-items:flex-end;justify-content:center;font-family:DM Sans,sans-serif';
          var mBox = document.createElement('div');
          mBox.style.cssText = 'background:linear-gradient(160deg,#0F4033 0%,#0d2d1e 100%);border-radius:20px 20px 0 0;padding:20px 20px 40px;width:100%;max-width:480px;box-sizing:border-box;max-height:85vh;overflow-y:auto;position:relative;transform:translateY(100%);transition:transform 0.3s cubic-bezier(0.32,0.72,0,1)';
          function cerrarModal() { mBox.style.transform='translateY(100%)'; setTimeout(function(){ mOverlay.remove(); }, 300); }
          // Handle bar
          var mBar = document.createElement('div');
          mBar.style.cssText = 'width:40px;height:4px;background:rgba(255,255,255,0.3);border-radius:2px;margin:0 auto 16px';
          mBox.appendChild(mBar);
          // Cerrar — posición absoluta respecto al mBox, z-index alto
          var mBtnX = document.createElement('button');
          mBtnX.textContent = '✕';
          mBtnX.style.cssText = 'position:absolute;top:12px;right:12px;width:32px;height:32px;background:rgba(0,0,0,0.5);border:1px solid rgba(255,255,255,0.25);border-radius:50%;color:#fff;font-size:15px;cursor:pointer;display:flex;align-items:center;justify-content:center;-webkit-appearance:none;z-index:10;backdrop-filter:blur(4px)';
          mBtnX.addEventListener('click', cerrarModal);
          mBox.appendChild(mBtnX);
          // Emoji + nombre
          var mHead = document.createElement('div');
          mHead.style.cssText = 'display:flex;align-items:center;gap:10px;margin-bottom:8px';
          mHead.innerHTML = '<span style="font-size:28px">' + (poi.emoji||'📍') + '</span>'
            + '<div style="font-family:Playfair Display,serif;font-size:20px;font-weight:600;color:#fff;line-height:1.2">' + poi.nombre + '</div>';
          mBox.appendChild(mHead);
          // Categoría
          if (poi.categoria) {
            var mCat = document.createElement('div');
            mCat.style.cssText = 'font-size:12px;text-transform:uppercase;letter-spacing:1.5px;color:rgba(255,255,255,0.45);margin-bottom:10px;font-weight:600';
            mCat.textContent = poi.categoria;
            mBox.appendChild(mCat);
          }
          // Subtítulo
          var _t2 = (typeof T !== 'undefined' && typeof idiomaActual !== 'undefined') ? null : null;
          var _lang = (typeof idiomaActual !== 'undefined') ? idiomaActual : 'es';
          var subTxt = poi['subtitulo_'+_lang] || poi.subtitulo;
          if (subTxt) {
            var mSub = document.createElement('p');
            mSub.style.cssText = 'font-size:15px;color:rgba(255,255,255,0.6);font-style:italic;margin-bottom:10px;line-height:1.5';
            mSub.textContent = subTxt;
            mBox.appendChild(mSub);
          }
          // Descripción completa
          var descTxt = poi['descripcion_'+_lang] || poi.descripcion;
          if (descTxt) {
            var sep = document.createElement('div');
            sep.style.cssText = 'width:40px;height:2px;background:rgba(255,255,255,0.25);border-radius:2px;margin-bottom:12px';
            mBox.appendChild(sep);
            var mDesc = document.createElement('p');
            mDesc.style.cssText = 'font-size:15px;color:rgba(255,255,255,0.82);line-height:1.75;margin-bottom:16px';
            mDesc.textContent = descTxt;
            mBox.appendChild(mDesc);
          }
          // Botones inferiores: volver + añadir a ruta
          var mBtnRow = document.createElement('div');
          mBtnRow.style.cssText = 'display:flex;gap:8px;margin-top:4px';
          var mBtnClose = document.createElement('button');
          mBtnClose.textContent = '← Volver';
          mBtnClose.style.cssText = 'flex:1;background:rgba(255,255,255,0.15);color:#fff;border:1px solid rgba(255,255,255,0.25);border-radius:12px;padding:12px;font-size:16px;font-weight:600;cursor:pointer;font-family:DM Sans,sans-serif';
          mBtnClose.addEventListener('click', cerrarModal);
          mBtnRow.appendChild(mBtnClose);
          var mBtnAdd = document.createElement('button');
          var _yaEnRuta = (typeof rutaPuntos !== 'undefined') && rutaPuntos.some(function(x){ return x.id === poi.id; });
          mBtnAdd.textContent = _yaEnRuta ? '✓ En ruta' : '+ Añadir a ruta';
          mBtnAdd.style.cssText = 'flex:1;background:' + (_yaEnRuta ? 'rgba(29,158,117,0.6)' : '#fff') + ';color:' + (_yaEnRuta ? '#fff' : '#0F6E56') + ';border:none;border-radius:12px;padding:12px;font-size:16px;font-weight:700;cursor:pointer;font-family:DM Sans,sans-serif;transition:all 0.15s';
          mBtnAdd.addEventListener('click', function() {
            if (typeof rutaPuntos === 'undefined') return;
            var yaEsta = rutaPuntos.some(function(x){ return x.id === poi.id; });
            if (!yaEsta) {
              if(_bloquearSiLejos())return;
              rutaPuntos.push({id: poi.id, nombre: poi.nombre, lat: poi.lat, lng: poi.lng});
              try { actualizarRuta(); } catch(e){}
              // Marcar el check en la fila de la lista de selección
              if (typeof seleccionados !== 'undefined') {
                seleccionados[poi.id] = poi;
                // Buscar la fila correspondiente en la lista por data-poi-id o por el nombre
                var filas = document.querySelectorAll('#wizard-poi-info-modal') ;
                // La fila está en el panel madre (overlay padre del modal actual)
                // Buscamos por el DOM: el overlay padre tiene z-index menor
                var listaFilas = document.querySelectorAll('.wizard-poi-fila');
                listaFilas.forEach(function(fila) {
                  if (fila.dataset.poiId === poi.id) {
                    fila.style.background = 'rgba(45,74,30,0.35)';
                    fila.style.borderColor = '#2d4a1e';
                    var chk = fila.querySelector('.wizard-poi-check');
                    if (chk) {
                      chk.style.background = '#2d4a1e';
                      chk.style.borderColor = '#2d4a1e';
                      chk.textContent = '✓';
                      chk.style.color = '#d4f0b0';
                    }
                  }
                });
                // Actualizar botón confirmar
                if (typeof btnConfirmar !== 'undefined') {
                  btnConfirmar.disabled = Object.keys(seleccionados).length === 0;
                  btnConfirmar.style.opacity = btnConfirmar.disabled ? '0.4' : '1';
                }
              }
              // Cerrar modal y volver al panel de lista automáticamente
              cerrarModal();
            } else {
              // Ya estaba — también cerrar y volver
              cerrarModal();
            }
          });
          mBtnRow.appendChild(mBtnAdd);
          mBox.appendChild(mBtnRow);
          mOverlay.appendChild(mBox);
          document.body.appendChild(mOverlay);
          mOverlay.addEventListener('click', function(ev){ if(ev.target===mOverlay) cerrarModal(); });
          requestAnimationFrame(function(){ requestAnimationFrame(function(){ mBox.style.transform='translateY(0)'; }); });
        });
        fila.appendChild(btnInfo);
      })(p);

      function toggle() {
        if (seleccionados[p.id]) {
          delete seleccionados[p.id];
          fila.style.background = 'rgba(0,0,0,0.12)';
          fila.style.borderColor = '#b8935a';
          check.style.background = 'rgba(255,255,255,0.15)';
          check.style.borderColor = '#7a5010';
          check.textContent = '';
        } else {
          seleccionados[p.id] = p;
          fila.style.background = 'rgba(45,74,30,0.35)';
          fila.style.borderColor = '#2d4a1e';
          check.style.background = '#2d4a1e';
          check.style.borderColor = '#2d4a1e';
          check.textContent = '✓';
          check.style.color = '#d4f0b0';
        }
        btnConfirmar.disabled = Object.keys(seleccionados).length === 0;
        btnConfirmar.style.opacity = btnConfirmar.disabled ? '0.4' : '1';
      }

      fila.addEventListener('click', toggle);
      lista.appendChild(fila);
    });
    inner.appendChild(lista);

    // Botón confirmar
    var btnConfirmar = document.createElement('button');
    btnConfirmar.textContent = _t.asistConfirmar||'Confirmar selección';
    btnConfirmar.disabled = true;
    btnConfirmar.style.cssText = 'width:100%;background:linear-gradient(135deg,#7a1f1f,#5c1414);color:#f5e6c8;border:none;border-radius:8px;padding:13px;font-size:16px;font-weight:700;cursor:pointer;font-family:Playfair Display,serif;opacity:0.4;margin-bottom:8px;transition:opacity 0.2s;box-shadow:0 2px 8px rgba(122,31,31,0.4)';
    btnConfirmar.addEventListener('click', function() {
      var ids = Object.keys(seleccionados);
      if (ids.length === 0) return;
      // Añadir a ruta
      ids.forEach(function(id) {
        var yaEsta = rutaPuntos.find(function(x){ return x.id === id; });
        if (!yaEsta) {
          var p = seleccionados[id];
          rutaPuntos.push({id: p.id, nombre: p.nombre, lat: p.lat, lng: p.lng});
        }
      });
      try { actualizarRuta(); } catch(e){}
      _renderPaso3(ids.length, seleccionados);
    });
    inner.appendChild(btnConfirmar);

    var btnVolver = document.createElement('button');
    btnVolver.textContent = _t.asistAtras||'← Volver';
    btnVolver.style.cssText = 'width:100%;background:rgba(0,0,0,0.2);color:#fff8e8;border:1px solid #7a5010;border-radius:8px;padding:11px;font-size:15px;font-weight:600;cursor:pointer;font-family:DM Sans,sans-serif;margin-bottom:8px;flex-shrink:0';
    btnVolver.addEventListener('click', function(){ _renderPaso1(); });
    inner.appendChild(btnVolver);
  }

  // ── PASO 3: Resumen de ruta + ¿Comenzar navegación? ────────────
  function _renderPaso3(num, seleccionados) {
    inner.innerHTML = '';

    _cascoTypewriter(inner, num === 1 ? (_t.asistPaso3Uno||'¡Lugar añadido a tu ruta!') : (_t.asistPaso3Multi||'¡{n} lugares añadidos a tu ruta!').replace('{n}',num), 'justify-content:center');

    // ── Resumen de la ruta ───────────────────────────────────────
    if (seleccionados && Object.keys(seleccionados).length > 0) {
      var pois = Object.values(seleccionados);

      // Calcular distancia total aproximada entre puntos (orden actual)
      var distTotal = 0;
      for (var i = 0; i < pois.length - 1; i++) {
        distTotal += haversine(pois[i].lat, pois[i].lng, pois[i+1].lat, pois[i+1].lng);
      }
      // Añadir distancia desde usuario al primer punto si hay GPS
      if (typeof userLat !== 'undefined' && userLat && pois.length > 0) {
        distTotal += haversine(userLat, userLng, pois[0].lat, pois[0].lng);
      }
      var distTxt = distTotal < 1 ? Math.round(distTotal * 1000) + ' m' : distTotal.toFixed(1) + ' km';

      // Bloque resumen visual
      var resumen = document.createElement('div');
      resumen.style.cssText = 'background:rgba(0,0,0,0.15);border:1.5px solid #7a5010;border-radius:8px;padding:12px 14px;margin-bottom:12px';

      // Línea de distancia
      var distLine = document.createElement('div');
      distLine.style.cssText = 'font-size:14px;color:#fff8e8;margin-bottom:8px;display:flex;align-items:center;gap:6px';
      distLine.innerHTML = '📍 Distancia estimada: <strong style="color:#fff">' + distTxt + '</strong>';
      resumen.appendChild(distLine);

      // Carrusel vertical de paradas (scroll si hay muchas)
      var listaParadas = document.createElement('div');
      listaParadas.style.cssText = 'display:flex;flex-direction:column;max-height:32vh;overflow-y:auto;padding-right:2px';

      pois.forEach(function(p, i) {
        var fila = document.createElement('div');
        fila.style.cssText = 'display:flex;align-items:center;gap:8px;' + (i < pois.length - 1 ? 'margin-bottom:6px' : '');

        // Conector vertical
        var col = document.createElement('div');
        col.style.cssText = 'display:flex;flex-direction:column;align-items:center;flex-shrink:0;width:16px';
        var dot = document.createElement('div');
        dot.style.cssText = 'width:10px;height:10px;border-radius:50%;background:' + (i === 0 ? '#7EE8C0' : i === pois.length-1 ? '#F5C800' : 'rgba(255,255,255,0.5)') + ';flex-shrink:0';
        col.appendChild(dot);
        if (i < pois.length - 1) {
          var line = document.createElement('div');
          line.style.cssText = 'width:2px;height:14px;background:rgba(255,255,255,0.2);margin-top:2px';
          col.appendChild(line);
        }
        fila.appendChild(col);

        var info = document.createElement('div');
        info.style.cssText = 'flex:1;min-width:0';
        var emoji = p.emoji || '📍';
        info.innerHTML = '<span style="font-size:14px;color:rgba(255,255,255,0.9);font-weight:600">' + emoji + ' ' + p.nombre + '</span>'
          + (p.subtitulo ? '<div style="font-size:13px;color:rgba(255,255,255,0.45);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + p.subtitulo + '</div>' : '');
        fila.appendChild(info);
        listaParadas.appendChild(fila);
      });

      resumen.appendChild(listaParadas);
      inner.appendChild(resumen);
    }

    var sub = document.createElement('p');
    sub.style.cssText = 'font-size:15px;color:#1a0800;text-align:center;line-height:1.6;margin-bottom:14px';
    sub.textContent = _t.asistNavegacionPregunta||'¿Quieres comenzar la navegación ahora?';
    inner.appendChild(sub);

    var btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:10px;margin-bottom:10px';

    var btnSi = document.createElement('button');
    btnSi.textContent = _t.asistNavSi||'🧭 Sí, navegar';
    btnSi.style.cssText = 'flex:1;background:#fff;color:#0F6E56;border:none;border-radius:10px;padding:10px;font-size:14px;font-weight:700;cursor:pointer;font-family:DM Sans,sans-serif';
    btnSi.addEventListener('click', function() {
      cerrar();
      setTimeout(function() {
        // Ir al mapa interno y arrancar modo navegación
        try { _irAlMapa(); } catch(e){}
        var mapBlock = document.getElementById('map-block');
        if (mapBlock) mapBlock.scrollIntoView({behavior:'smooth', block:'start'});
        setTimeout(function() {
          // Activar modo navegación interno de la app
          try { activarNavegacionVoz(); } catch(e1) {
            try { iniciarRuta(); } catch(e2) {
              // Fallback: pulsar el botón IR del panel de ruta
              var btnIr = document.getElementById('ruta-nav-btn');
              if (btnIr) btnIr.click();
            }
          }
        }, 500);
      }, 340);
    });

    var btnNo = document.createElement('button');
    btnNo.textContent = _t.asistNavNo||'No, ver en mapa';
    btnNo.style.cssText = 'flex:1;background:rgba(255,255,255,0.15);color:#fff;border:1px solid rgba(255,255,255,0.3);border-radius:10px;padding:10px;font-size:14px;font-weight:600;cursor:pointer;font-family:DM Sans,sans-serif';
    btnNo.addEventListener('click', function() {
      cerrar();
      setTimeout(function() {
        // Mostrar ruta en mapa y toast informativo
        var mapBlock = document.getElementById('map-block');
        if (mapBlock) mapBlock.scrollIntoView({behavior:'smooth', block:'start'});
        try {
          if (typeof dibujarLineaEstática === 'function') dibujarLineaEstática();
        } catch(e){}
        mostrarToast(_t.asistToastRuta||'🗺️ Tu ruta queda guardada en el mapa');
      }, 340);
    });

    btnRow.appendChild(btnSi);
    btnRow.appendChild(btnNo);
    inner.appendChild(btnRow);

    var btnRevisar = document.createElement('button');
    btnRevisar.textContent = _t.asistRevisarRuta||'📋 Revisar ruta';
    btnRevisar.style.cssText = 'width:100%;background:rgba(0,0,0,0.12);color:#1a0800;border:1px solid #7a5010;border-radius:10px;padding:10px;font-size:14px;font-weight:600;cursor:pointer;font-family:DM Sans,sans-serif';
    btnRevisar.addEventListener('click', function(){ _renderRevision(); });
    inner.appendChild(btnRevisar);
  }

  // Arrancar en paso 1
  _renderPaso1();

  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  requestAnimationFrame(function(){
    requestAnimationFrame(function(){ panel.style.transform = 'translateY(0)'; });
  });

  overlay.addEventListener('click', function(e){ if (e.target === overlay) cerrar(); });
  overlay.addEventListener('touchend', function(e){ if (e.target === overlay){ e.preventDefault(); cerrar(); } });

  // Exponer búsqueda próxima globalmente para el botón lupa del mapa
  window._abrirBusquedaProxima = _abrirBusquedaProxima;
}
function abrirBuscadorAsistente() {
  var old = document.getElementById('lupa-busqueda-modal');
  if (old) { old.remove(); return; }

  var _t = (typeof T !== 'undefined' && T[idiomaActual]) ? T[idiomaActual] : T['es'];

  var overlay = document.createElement('div');
  overlay.id = 'lupa-busqueda-modal';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:999999;background:rgba(0,0,0,0.72);display:flex;align-items:flex-end;justify-content:center;font-family:DM Sans,sans-serif';

  var box = document.createElement('div');
  box.style.cssText = 'background:radial-gradient(ellipse at 15% 20%, rgba(90,50,0,0.18) 0%, transparent 55%),radial-gradient(ellipse at 85% 75%, rgba(60,30,0,0.20) 0%, transparent 50%),radial-gradient(ellipse at 55% 40%, rgba(180,130,40,0.10) 0%, transparent 40%),linear-gradient(180deg,#c9933a 0%,#b87d28 40%,#a86d18 100%);border-radius:20px 20px 0 0;padding:20px 20px 44px;width:100%;max-width:480px;box-sizing:border-box;position:relative;transform:translateY(100%);transition:transform 0.3s cubic-bezier(0.32,0.72,0,1);border-top:3px solid #5a3008;box-shadow:0 -4px 32px rgba(0,0,0,0.5),inset 0 0 60px rgba(60,25,0,0.25),inset 0 0 15px rgba(40,15,0,0.3),inset 0 1px 0 rgba(255,220,120,0.15)';

  function cerrarModal() {
    box.style.transform = 'translateY(100%)';
    setTimeout(function(){ overlay.remove(); }, 300);
  }

  // Handle
  var handle = document.createElement('div');
  handle.style.cssText = 'width:40px;height:4px;background:rgba(139,105,20,0.4);border-radius:2px;margin:0 auto 16px';
  box.appendChild(handle);

  // Botón X
  var btnX = document.createElement('button');
  btnX.textContent = '✕';
  btnX.style.cssText = 'position:absolute;top:12px;right:12px;width:32px;height:32px;background:rgba(0,0,0,0.2);border:1.5px solid #7a5010;border-radius:50%;color:#fff8e8;font-size:15px;cursor:pointer;display:flex;align-items:center;justify-content:center;-webkit-appearance:none;z-index:10';
  btnX.addEventListener('click', cerrarModal);
  box.appendChild(btnX);

  // Título
  var tit = document.createElement('div');
  tit.style.cssText = 'font-family:IM Fell English,serif;font-size:17px;font-weight:400;color:#1a0800;margin-bottom:6px;padding-right:36px;line-height:1.3';
  tit.innerHTML = _t.asistBuscarTit || '🔍 Buscar algo próximo a ti';
  box.appendChild(tit);

  var sub = document.createElement('p');
  sub.style.cssText = 'font-size:14px;color:#1a0800;margin-bottom:14px;line-height:1.5';
  sub.textContent = _t.asistBuscarSub || 'Escribe lo que necesitas. Los resultados aparecerán en el mapa en un radio de 1 km.';
  box.appendChild(sub);

  // Input + botón buscar
  var inputWrap = document.createElement('div');
  inputWrap.style.cssText = 'display:flex;gap:8px;margin-bottom:12px';
  var inputCont = document.createElement('div');
  inputCont.style.cssText = 'flex:1;position:relative;display:flex;align-items:center';
  var input = document.createElement('input');
  input.type = 'text';
  input.placeholder = _t.asistBuscarPh || 'albergue, farmacia, fuente, café…';
  input.style.cssText = 'width:100%;background:rgba(255,240,200,0.6);border:1.5px solid #7a5010;border-radius:8px;padding:10px 36px 10px 14px;font-size:16px;color:#1a0e00;font-family:DM Sans,sans-serif;outline:none;-webkit-appearance:none;box-sizing:border-box';
    input.className='busc-input';
  input.setAttribute('autocomplete', 'off');
  inputCont.appendChild(input);
  var btnBuscar = document.createElement('button');
  btnBuscar.textContent = _t.asistBuscarBtn || 'Buscar';
  btnBuscar.style.cssText = 'background:linear-gradient(135deg,#2d4a1e,#1e3212);color:#f5e6c8;border:none;border-radius:8px;padding:10px 16px;font-size:16px;font-weight:700;cursor:pointer;font-family:Playfair Display,serif;white-space:nowrap;flex-shrink:0';
  inputWrap.appendChild(inputCont);
  inputWrap.appendChild(btnBuscar);
  box.appendChild(inputWrap);

  // Chips de sugerencias rápidas
  var sugs = ['albergue','farmacia','supermercado','restaurante','café','fuente','iglesia','hospital','banco','gasolinera'];
  var sugWrap = document.createElement('div');
  sugWrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px';
  sugs.forEach(function(s) {
    var chip = document.createElement('button');
    chip.textContent = s;
    chip.style.cssText = 'background:rgba(255,220,140,0.35);color:#1a0e00;border:1px solid #7a5010;border-radius:20px;padding:5px 12px;font-size:14px;cursor:pointer;font-family:DM Sans,sans-serif;-webkit-appearance:none';
    chip.addEventListener('click', function(){ input.value = s; ejecutarBusqueda(s); });
    sugWrap.appendChild(chip);
  });
  box.appendChild(sugWrap);

  // Estado
  var estado = document.createElement('div');
  estado.style.cssText = 'font-size:14px;color:#1a0800;text-align:center;padding:8px 0;display:none';
  box.appendChild(estado);

  // Resultados
  var resultados = document.createElement('div');
  resultados.style.cssText = 'max-height:32vh;overflow-y:auto;display:flex;flex-direction:column;gap:6px;overscroll-behavior:contain';
  box.appendChild(resultados);

  overlay.appendChild(box);
  document.body.appendChild(overlay);
  setTimeout(function(){ box.style.transform = 'translateY(0)'; }, 20);
  setTimeout(function(){ input.focus(); }, 360);
  overlay.addEventListener('click', function(e){ if (e.target === overlay) cerrarModal(); });

  function ejecutarBusqueda(q) {
    if (!q || !q.trim()) return;
    q = q.trim();
    resultados.innerHTML = '';
    estado.style.display = 'none';
    input.style.borderColor = '#a07828';
    input.style.animation = '_input-blink 0.9s ease-in-out infinite';
    input.setAttribute('placeholder', '⏳ Buscando ' + q + '…');
    input.value = '';
    input.disabled = true;

    var refLat = (typeof userLat !== 'undefined' && userLat) ? userLat : (typeof mapa !== 'undefined' ? mapa.getCenter().lat : null);
    var refLng = (typeof userLng !== 'undefined' && userLng) ? userLng : (typeof mapa !== 'undefined' ? mapa.getCenter().lng : null);
    if (!refLat || !refLng) {
      estado.textContent = _t.asistBuscandoGps || '📍 Activa el GPS para buscar cerca de ti.';
      return;
    }

    var radio = 1000;
    var osmTag = (typeof _OVERPASS_TAGS !== 'undefined') ? _OVERPASS_TAGS[q.toLowerCase()] : null;


    function _mostrarResultados(items) {
      input.style.borderColor = '#7a5010'; input.style.animation = ''; input.disabled = false;
      input.setAttribute('placeholder', _t.asistBuscarPh||'albergue, farmacia, fuente, café…');
      resultados.innerHTML = '';
      if (!items || items.length === 0) {
        estado.style.display = 'block';
        estado.textContent = '🔍 Sin resultados para "' + q + '" en 1 km.';
        return;
      }
      if (!window._wizSearchMarkers) window._wizSearchMarkers = [];
      // Limpiar marcadores anteriores y sus puntos de la ruta
      var _busqIds = window._wizSearchMarkers.map(function(m){ return m._busqId; }).filter(Boolean);
      window._wizSearchMarkers.forEach(function(m){ try{ mapa.removeLayer(m); }catch(e){} });
      window._wizSearchMarkers = [];
      if (_busqIds.length > 0) {
        var _teniaRutaBusq = rutaPuntos.some(function(p){ return _busqIds.indexOf(p.id) !== -1; });
        rutaPuntos = rutaPuntos.filter(function(p){ return _busqIds.indexOf(p.id) === -1; });
        PUNTOS = PUNTOS.filter(function(p){ return _busqIds.indexOf(p.id) === -1; });
        if (_teniaRutaBusq) actualizarRuta();
      }

      var iconoBusc = (typeof iconoBusqueda !== 'undefined') ? iconoBusqueda
        : L.divIcon({ html:'<div style="background:#DC2626;color:#fff;width:32px;height:32px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;border:2px solid #fff"><span style="transform:rotate(45deg);font-size:16px">🔍</span></div>', className:'', iconSize:[32,32], iconAnchor:[16,32], popupAnchor:[0,-32] });

      var bounds = [];
      items.forEach(function(it) {
        var lat = it.lat, lng = it.lng, nombre = it.nombre, dist = it.dist;
        var tmpId_mk = '_busq_' + lat.toString().replace('.','') + '_' + lng.toString().replace('.','');
        var mk = L.marker([lat, lng], { icon: iconoBusc }).addTo(mapa);
        mk._busqId = tmpId_mk;
        var popupEl = document.createElement('div');
        popupEl.style.cssText = 'font-family:DM Sans,sans-serif;min-width:160px';
        popupEl.innerHTML = '<strong>' + nombre + '</strong><br><span style="font-size:11px;color:#6b7280">📍 ' + (typeof formatDist==='function'?formatDist(dist):Math.round(dist)+'m') + '</span>' + (it.tel ? '<br>📞 ' + it.tel : '');
        var btnDiv = document.createElement('div');
        btnDiv.style.cssText = 'display:flex;gap:6px;margin-top:8px;flex-wrap:wrap';
        var btnAdd = document.createElement('button');
        btnAdd.textContent = '➕ Añadir a ruta';
        btnAdd.style.cssText = 'background:#E1F5EE;color:#0F6E56;border:1px solid rgba(29,158,117,0.4);padding:5px 12px;border-radius:12px;font-size:12px;font-weight:600;cursor:pointer;font-family:DM Sans,sans-serif';
        (function(la,lo,no,b){ b.addEventListener('click', function(){ _toggleBusquedaRuta(b,encodeURIComponent(no),la,lo); }); })(lat,lng,nombre,btnAdd);
        var btnNav = document.createElement('button');
        btnNav.textContent = '🗺️ Cómo llegar';
        btnNav.style.cssText = 'background:#1D9E75;color:#fff;border:none;padding:5px 12px;border-radius:12px;font-size:12px;cursor:pointer;font-family:DM Sans,sans-serif';
        (function(la,lo){ btnNav.addEventListener('click', function(){ irACoordenadasNav(la,lo); }); })(lat,lng);
        btnDiv.appendChild(btnAdd); btnDiv.appendChild(btnNav);
        popupEl.appendChild(btnDiv);
        mk.bindPopup(popupEl);
        window._wizSearchMarkers.push(mk);
        bounds.push([lat, lng]);
      });

      // Cerrar cajetin y mostrar resultados en el mapa
      _actualizarBtnLimpiar();
      cerrarModal();

      if (bounds.length === 1) mapa.setView(bounds[0], 17);
      else if (bounds.length > 1) mapa.fitBounds(bounds, { padding:[50,50] });

      setTimeout(function(){
        var el = document.getElementById('map');
        if (el) {
          var rect = el.getBoundingClientRect();
          window.scrollTo({ top: Math.max(0, window.pageYOffset + rect.top - (window.innerHeight/2) + (rect.height/2)), behavior:'smooth' });
        }
      }, 600);
    }

    if (osmTag) {
      var query = '[out:json][timeout:10];(node' + osmTag + '(around:' + radio + ',' + refLat + ',' + refLng + ');way' + osmTag + '(around:' + radio + ',' + refLat + ',' + refLng + '););out center 15;';
      var xhr = new XMLHttpRequest();
      xhr.open('GET', 'https://overpass-api.de/api/interpreter?data=' + encodeURIComponent(query), true);
      xhr.timeout = 12000;
      function _fallbackNominatimLupa() {
        estado.textContent = '⏳ Buscando en fuente alternativa…';
        var d = 0.009;
        var xhr2 = new XMLHttpRequest();
        xhr2.open('GET', 'https://nominatim.openstreetmap.org/search?format=json&limit=10&q=' + encodeURIComponent(q) + '&accept-language=es&viewbox=' + (refLng-d) + ',' + (refLat+d) + ',' + (refLng+d) + ',' + (refLat-d) + '&bounded=1', true);
        xhr2.onreadystatechange = function() {
          if (xhr2.readyState !== 4) return;
          if (xhr2.status === 200) {
            try {
              var res2 = JSON.parse(xhr2.responseText);
              var items2 = (res2||[]).map(function(r){
                var la = parseFloat(r.lat), lo = parseFloat(r.lon);
                return { lat:la, lng:lo, nombre:r.display_name.split(',')[0].trim(), dist:haversine(refLat,refLng,la,lo), tel:'' };
              }).filter(function(x){ return x.dist<=radio; });
              items2.sort(function(a,b){ return a.dist-b.dist; });
              _mostrarResultados(items2.slice(0,12));
            } catch(e){ estado.style.display='block'; estado.textContent='⚠️ Error al buscar. Inténtalo de nuevo.'; }
          } else { estado.style.display='block'; estado.textContent='⚠️ Error de red.'; }
        };
        xhr2.send();
      }
      xhr.onreadystatechange = function() {
        if (xhr.readyState !== 4) return;
        if (xhr.status === 200) {
          try {
            var res = JSON.parse(xhr.responseText);
            var items = (res.elements||[]).map(function(el){
              var la = el.lat||(el.center&&el.center.lat), lo = el.lon||(el.center&&el.center.lon);
              return { lat:la, lng:lo, nombre:(el.tags&&(el.tags.name||el.tags.brand))||q, dist:haversine(refLat,refLng,la,lo), tel:(el.tags&&el.tags.phone)||'' };
            }).filter(function(x){ return x.lat&&x.lng&&x.dist<=radio; });
            items.sort(function(a,b){ return a.dist-b.dist; });
            if (items.length > 0) {
              _mostrarResultados(items.slice(0,12));
            } else {
              _fallbackNominatimLupa();
            }
          } catch(e){ _fallbackNominatimLupa(); }
        } else { _fallbackNominatimLupa(); }
      };
      xhr.ontimeout = function() { _fallbackNominatimLupa(); };
      xhr.send();
    } else {
      var d = 0.009;
      var xhr2 = new XMLHttpRequest();
      xhr2.open('GET', 'https://nominatim.openstreetmap.org/search?format=json&limit=10&q=' + encodeURIComponent(q) + '&accept-language=es&viewbox=' + (refLng-d) + ',' + (refLat+d) + ',' + (refLng+d) + ',' + (refLat-d) + '&bounded=1', true);
      xhr2.onreadystatechange = function() {
        if (xhr2.readyState !== 4) return;
        if (xhr2.status === 200) {
          try {
            var res2 = JSON.parse(xhr2.responseText);
            var items2 = (res2||[]).map(function(r){
              var la = parseFloat(r.lat), lo = parseFloat(r.lon);
              return { lat:la, lng:lo, nombre:r.display_name.split(',')[0].trim(), dist:haversine(refLat,refLng,la,lo), tel:'' };
            }).filter(function(x){ return x.dist<=radio; });
            items2.sort(function(a,b){ return a.dist-b.dist; });
            _mostrarResultados(items2.slice(0,12));
          } catch(e){ estado.style.display='block'; estado.textContent='⚠️ Error al buscar. Inténtalo de nuevo.'; }
        } else { estado.style.display='block'; estado.textContent='⚠️ Error de red.'; }
      };
      xhr2.send();
    }
  }

  btnBuscar.addEventListener('click', function(){ ejecutarBusqueda(input.value); });
  input.addEventListener('keydown', function(e){ if (e.key === 'Enter') ejecutarBusqueda(input.value); });
}
function abrirModalNotificaciones(){
  var existing=document.getElementById('modal-notif-opciones');
  if(existing){existing.remove();return;}
  var overlay=document.createElement('div');
  overlay.id='modal-notif-opciones';
  overlay.style.cssText='position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;font-family:DM Sans,sans-serif;padding:1rem;box-sizing:border-box';
  var box=document.createElement('div');
  box.style.cssText='background:#fff;border-radius:16px;padding:1.25rem;max-width:85vw;width:280px;box-shadow:0 8px 32px rgba(0,0,0,0.2)';
  function renderBox(){
    var a=_alertasFirebaseOn,n=_cromosNotifOn,l=notifActivadas;
    var permDenied=(typeof Notification!=='undefined'&&Notification.permission==='denied');
    var lBg=l?'#1D9E75':(permDenied?'#ef4444':'#ef4444');
    var lLeft=l?'21px':'3px';
    var esMovil=window.innerWidth<=768;
    var _t=(T[idiomaActual]||T.es);
    box.innerHTML=
      '<div style="font-size:15px;font-weight:700;color:#1a1a1a;margin-bottom:14px">'+_t.notifModalTitulo+'</div>'
      +'<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid #f0f0f0">'
      +'<div><div style="font-size:15px;font-weight:600;color:#1a1a1a">'+_t.notifAlertasCamino+'</div>'
      +'<div style="font-size:13px;color:#6b7280">'+_t.notifAlertasSub+'</div></div>'
      +'<button id="notif-toggle-alertas" style="width:44px;height:26px;border-radius:13px;border:none;cursor:pointer;background:'+(a?'#1D9E75':'#d1d5db')+';position:relative;flex-shrink:0">'
      +'<span style="position:absolute;top:3px;width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,0.2);left:'+(a?'21px':'3px')+'"></span>'
      +'</button></div>'
      +'<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid #f0f0f0">'
      +'<div><div style="font-size:15px;font-weight:600;color:#1a1a1a">'+_t.notifCromos+'</div>'
      +'<div style="font-size:13px;color:#6b7280">'+_t.notifCromosSub+'</div></div>'
      +'<button id="notif-toggle-cromos" style="width:44px;height:26px;border-radius:13px;border:none;cursor:pointer;background:'+(n?'#1D9E75':'#d1d5db')+';position:relative;flex-shrink:0">'
      +'<span style="position:absolute;top:3px;width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,0.2);left:'+(n?'21px':'3px')+'"></span>'
      +'</button></div>'
      +(esMovil?
        '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid #f0f0f0">'
        +'<div><div style="font-size:15px;font-weight:600;color:#1a1a1a">'+_t.notifApp+'</div>'
        +'<div style="font-size:13px;color:#6b7280">'+(l?_t.notifAppActiva:(permDenied?_t.notifAppBloqueada:_t.notifAppPermiso))+'</div></div>'
        +'<button id="notif-toggle-loc" style="width:44px;height:26px;border-radius:13px;border:none;cursor:pointer;background:'+lBg+';position:relative;flex-shrink:0">'
        +'<span style="position:absolute;top:3px;width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,0.2);left:'+lLeft+'"></span>'
        +'</button></div>'
      :'')
      +'<button id="notif-cerrar" style="width:100%;margin-top:14px;background:#f3f4f6;color:#374151;border:none;border-radius:10px;padding:9px;font-size:15px;font-weight:600;cursor:pointer;font-family:DM Sans,sans-serif">'+_t.notifCerrar+'</button>';
    box.querySelector('#notif-toggle-alertas').addEventListener('click',function(){
      _alertasFirebaseOn=!_alertasFirebaseOn;_actualizarBtnAlertas();renderBox();
    });
    box.querySelector('#notif-toggle-cromos').addEventListener('click',function(){
      _cromosNotifOn=!_cromosNotifOn;
      try{localStorage.setItem('cromosNotifOn',_cromosNotifOn?'1':'0');}catch(e){}
      _actualizarBtnAlertas();renderBox();
    });
    var locBtn=box.querySelector('#notif-toggle-loc');if(locBtn)locBtn.addEventListener('click',function(){
      if(notifActivadas){
        // Desactivar
        desactivarNotificaciones();
        _actualizarBtnAlertas();
        renderBox();
      } else {
        // Activar: pedir permisos
        if(!("Notification" in window)){
          mostrarToastNotif('noSoportado');
          return;
        }
        if(Notification.permission==='denied'){
          mostrarToastNotif('bloqueadas');
          _actualizarBtnAlertas();
          renderBox();
          return;
        }
        Notification.requestPermission().then(function(perm){
          if(perm==='granted'){
            notifActivadas=true;
            actualizarBtnPrincipal();
            iniciarProximidad();
          }
          _actualizarBtnAlertas();
          renderBox();
        });
      }
    });
    box.querySelector('#notif-cerrar').addEventListener('click',function(){overlay.remove();});
  }
  renderBox();
  overlay.appendChild(box);document.body.appendChild(overlay);
  overlay.addEventListener('click',function(e){if(e.target===overlay)overlay.remove();});
}

var _modoSeguimiento = false;

function refrescarUbicacion() {
  mapa.closePopup();
  // Siempre: apagar seguimiento y brújula
  desactivarSeguimientoYBrujula();
  // Ocultar ruta del mapa
  if (_rutaLinea) { mapa.removeLayer(_rutaLinea); _rutaLinea = null; }
  _verRutaMapa = false;
  var btnVer = document.getElementById('ruta-bar-btn-ver');
  if (btnVer) { btnVer.style.background='#1D9E75'; btnVer.style.opacity='0.55'; btnVer.style.border='none'; }
  // Volver a punto azul
  if (window._userMarker) window._userMarker.setIcon(crearIconoUsuario(null));
  limpiarBusqueda();
  var btn = document.getElementById('btn-alertas-toggle');
  var statusTxt = document.getElementById('map-status-text');
  if (btn) { btn.style.opacity = '0.5'; btn.style.pointerEvents = 'none'; }
  if (statusTxt) statusTxt.textContent = '📍 Actualizando ubicación...';
  navigator.geolocation.getCurrentPosition(function(pos) {
    userLat = pos.coords.latitude;
    userLng = pos.coords.longitude;
    // Mover o crear el marcador de usuario
    if (window._userMarker) {
      window._userMarker.setLatLng([userLat, userLng]);
      // Actualizar icono según estado actual
      window._userMarker.setIcon(crearIconoUsuario(_modoSeguimiento ? _userHeading : null));
    } else {
      window._userMarker = L.marker([userLat,userLng],{icon:crearIconoUsuario(null),zIndexOffset:1000}).addTo(mapa).bindPopup('<strong>'+(T[idiomaActual]||T.es).tuUbicacion+'</strong>');
    }
    // Siempre volver a radio 1km
    radioKm = 1;
    _aplicarEstadoRadioBtns(1);
    aplicarRadio(1);
    // Recalcular distancias y reordenar
    PUNTOS.forEach(function(p){ p.distancia = haversine(userLat,userLng,p.lat,p.lng); });
    PUNTOS.sort(function(a,b){ return a.distancia - b.distancia; });
    renderCarrusel(categoriaActiva);
    if (statusTxt) statusTxt.textContent = '📍 Ubicación actualizada';
    setTimeout(function() {
      if (statusTxt) statusTxt.textContent = '';
      if (btn) { btn.style.opacity = '1'; btn.style.pointerEvents = ''; }
    }, 2000);
  }, function() {
    if (statusTxt) statusTxt.textContent = '⚠️ No se pudo obtener la ubicación';
    if (btn) { btn.style.opacity = '1'; btn.style.pointerEvents = ''; }
    setTimeout(function() { if (statusTxt) statusTxt.textContent = ''; }, 3000);
  }, { enableHighAccuracy:true, timeout:8000 });
}

// ── SISTEMA DE ALERTAS ──────────────────────────────────────────────────────

function añadirMarcadorAlerta(a) {
  var tiempoRestante = a.expiraTs ? Math.max(0, Math.round((a.expiraTs - Date.now()) / 3600000)) : 24;
  var iconAlerta = L.divIcon({
    className: '',
    html: '<div style="background:#dc2626;color:#fff;width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:3px solid #fff;box-shadow:0 2px 8px rgba(220,38,38,0.6);animation:pulseAlerta 1.5s infinite">' +
          '<span style="font-size:20px">🚨</span></div>',
    iconSize:[36,36], iconAnchor:[18,18], popupAnchor:[0,-20]
  });
  var m = L.marker([a.lat, a.lng], { icon: iconAlerta, zIndexOffset: 500 }).addTo(mapa);
  a._marker = m;
  m.on('click', (function(alerta) {
    return function() {
      if (window._navBloqPopups || window._simEsperandoUbicacion) return;
      mapa.openPopup(L.popup({ className:'poi-popup', maxWidth:260 })
        .setLatLng([alerta.lat, alerta.lng])
        .setContent(buildAlertaPopup(alerta)));
    };
  })(a));
}

function buildAlertaPopup(a) {
  var tiempoRestante = a.expiraTs ? Math.max(0, Math.round((a.expiraTs - Date.now()) / 3600000)) : 24;
  var yaReporte = alertasReportadas[a.id];
  var esMia = a.deviceId === DEVICE_ID;
  var yaOculta = alertasOcultas[a.id];
  return '<div style="font-family:DM Sans,sans-serif;min-width:210px">' +
    '<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">' +
    '<span style="font-size:24px">🚨</span>' +
    '<strong style="font-size:16px;color:#dc2626">' + esc(a.nombre) + '</strong></div>' +
    (a.descripcion ? '<p style="font-size:15px;margin:0 0 6px;color:#374151">' + esc(a.descripcion) + '</p>' : '') +
    '<div style="font-size:13px;color:#9ca3af;margin-bottom:8px">⏱ Caduca en ~' + tiempoRestante + 'h · ' + (a.reportes||1) + ' reporte(s)</div>' +
    (yaReporte
      ? '<div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;padding:7px;font-size:14px;color:#dc2626;text-align:center;margin-bottom:6px">✓ Ya has confirmado esta alerta</div>'
      : '<button onclick="reportarAlerta(\'' + a.id + '\')" style="width:100%;background:#dc2626;color:#fff;border:none;border-radius:8px;padding:8px;font-size:15px;font-weight:600;cursor:pointer;font-family:DM Sans,sans-serif;margin-bottom:6px">🚨 Confirmar alerta (+24h)</button>'
    ) +
    (esMia
      ? '<button onclick="eliminarAlerta(\'' + a.id + '\')" style="width:100%;background:#fff2f2;color:#ef4444;border:1.5px solid #ef4444;border-radius:8px;padding:7px;font-size:14px;font-weight:600;cursor:pointer;font-family:DM Sans,sans-serif">🗑️ Eliminar para todos</button>'
      : (yaOculta
          ? '<div style="font-size:14px;color:#9ca3af;text-align:center;margin-top:2px">👁 Alerta oculta en el mapa</div>'
          : '<button onclick="ocultarAlerta(\'' + a.id + '\')" style="width:100%;background:#f3f4f6;color:#6b7280;border:1px solid #d1d5db;border-radius:8px;padding:7px;font-size:14px;font-weight:500;cursor:pointer;font-family:DM Sans,sans-serif;margin-top:2px">👁 Ocultar del mapa</button>'
        )
    ) +
    '</div>';
}

var alertasReportadas = {};
try { alertasReportadas = JSON.parse(localStorage.getItem('alertasReportadas')||'{}'); } catch(e) {}

// Alertas ocultas localmente (solo afectan al mapa, no a la tarjeta del carrusel)
var alertasOcultas = {};
try { alertasOcultas = JSON.parse(localStorage.getItem('alertasOcultas')||'{}'); } catch(e) {}

function eliminarAlerta(id) {
  var _doEliminarAlerta = function() {
    var alerta = PUNTOS.find(function(p){ return p.id === id; });
    if (alerta && alerta._marker) mapa.removeLayer(alerta._marker);
    PUNTOS = PUNTOS.filter(function(p){ return p.id !== id; });
    PUNTOS_USUARIO = PUNTOS_USUARIO.filter(function(p){ return p.id !== id; });
    try { localStorage.setItem('poi_usuario', JSON.stringify(PUNTOS_USUARIO)); } catch(e) {}
    if (!window._alertasEliminadas) window._alertasEliminadas = {};
    window._alertasEliminadas[id] = true;
    db.ref('alertas/' + id).remove();
    mapa.closePopup();
    var card = document.querySelector('[data-poi-id="'+id+'"]');
    if (card) card.remove();
    mostrarToast('🗑️ Alerta eliminada para todos');
    _irAlMapa();
  };
  var overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:19999;display:flex;align-items:center;justify-content:center';
  overlay.innerHTML =
    '<div style="background:#fff;border-radius:14px;padding:1.5rem 1.5rem 1.25rem;max-width:300px;width:88%;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,0.18)">' +
    '<div style="font-size:32px;margin-bottom:10px">🚨</div>' +
    '<p style="font-family:DM Sans,sans-serif;font-size:15px;font-weight:600;color:#1a1a1a;margin:0 0 6px">¿Eliminar esta alerta?</p>' +
    '<p style="font-family:DM Sans,sans-serif;font-size:15px;color:#6b7280;margin:0 0 20px">Se eliminará para todos los usuarios.</p>' +
    '<div style="display:flex;gap:10px;justify-content:center">' +
    '<button id="confirm-alerta-cancel" style="flex:1;background:#f3f4f6;border:none;border-radius:10px;padding:10px 0;font-size:16px;font-weight:500;cursor:pointer;font-family:DM Sans,sans-serif;color:#374151">Cancelar</button>' +
    '<button id="confirm-alerta-ok" style="flex:1;background:#dc2626;border:none;border-radius:10px;padding:10px 0;font-size:16px;font-weight:600;cursor:pointer;font-family:DM Sans,sans-serif;color:#fff">Eliminar</button>' +
    '</div></div>';
  document.body.appendChild(overlay);
  overlay.addEventListener('click', function(e){ if(e.target===overlay) overlay.remove(); });
  document.getElementById('confirm-alerta-cancel').addEventListener('click', function(){ overlay.remove(); });
  document.getElementById('confirm-alerta-ok').addEventListener('click', function(){ overlay.remove(); _doEliminarAlerta(); });
}

function ocultarAlerta(id) {
  var alerta = PUNTOS.find(function(p){ return p.id === id; });
  if (alerta && alerta._marker) { mapa.removeLayer(alerta._marker); alerta._marker = null; }
  alertasOcultas[id] = true;
  try { localStorage.setItem('alertasOcultas', JSON.stringify(alertasOcultas)); } catch(e) {}
  mapa.closePopup();
  _actualizarBtnOcultarAlerta(id, true);
  // Si todas las alertas están ocultas, apagar parpadeo del chip
  var hayVisibles = PUNTOS.some(function(p){ return p.esAlerta && !alertasOcultas[p.id]; });
  var chipAlerta = document.getElementById('chip-alertas');
  if (chipAlerta) chipAlerta.style.animation = hayVisibles ? 'chipAlertaPulse 1.2s ease-in-out infinite' : '';
  mostrarToast('👁 Alerta ocultada del mapa');
  _sincronizarChipAlertasPOI();
  _irAlMapa();
}

function mostrarAlerta(id) {
  delete alertasOcultas[id];
  try { localStorage.setItem('alertasOcultas', JSON.stringify(alertasOcultas)); } catch(e) {}
  var alerta = PUNTOS.find(function(p){ return p.id === id; });
  if (alerta && !alerta._marker) añadirMarcadorAlerta(alerta);
  _actualizarBtnOcultarAlerta(id, false);
  // Encender parpadeo del chip al volver a mostrar
  var chipAlerta = document.getElementById('chip-alertas');
  if (chipAlerta && !chipAlerta.classList.contains('active')) {
    chipAlerta.style.animation = 'chipAlertaPulse 1.2s ease-in-out infinite';
  }
  mostrarToast('👁 Alerta visible en el mapa');
  _sincronizarChipAlertasPOI();
  _irAlMapa();
}


function _centrarMapa() { return; // salto desactivado
  var mapEl = document.getElementById('map');
  if (!mapEl) return;
  var rect = mapEl.getBoundingClientRect();
  var mapCenterY = window.pageYOffset + rect.top + rect.height / 2;
  var targetY = mapCenterY - window.innerHeight / 2;
  window.scrollTo({ top: targetY, behavior: 'smooth' });
  setTimeout(function() {
    if (typeof mapa !== 'undefined' && mapa) {
      mapa.invalidateSize();
      mapa.panTo(mapa.getCenter(), { animate: false });
    }
  }, 400);
}
function _irAlMapa() {
  setTimeout(_centrarMapa, 150);
}

function _actualizarBtnOcultarAlerta(id, oculta) {
  var card = document.querySelector('[data-poi-id="'+id+'"]');
  if (!card) return;
  var btn = card.querySelector('[data-alerta-toggle]');
  if (!btn) return;
  if (oculta) {
    btn.textContent = '👁 Mostrar en el mapa';
    btn.style.background = '#f0fdf4';
    btn.style.color = '#15803d';
    btn.style.border = '1px solid #86efac';
    btn.setAttribute('onclick', "mostrarAlerta('"+id+"')");
  } else {
    btn.textContent = '👁 Ocultar del mapa';
    btn.style.background = '#f3f4f6';
    btn.style.color = '#6b7280';
    btn.style.border = '1px solid #d1d5db';
    btn.setAttribute('onclick', "ocultarAlerta('"+id+"')");
  }
}

// Contador diario de reportes — se resetea al cambiar de día
var _alertasHoy = {};
try {
  var _alertasHoyStored = JSON.parse(localStorage.getItem('alertasHoy')||'{}');
  var _hoyKey = new Date().toISOString().slice(0,10); // 'YYYY-MM-DD'
  _alertasHoy = (_alertasHoyStored.fecha === _hoyKey) ? _alertasHoyStored : { fecha: _hoyKey, count: 0 };
} catch(e) { _alertasHoy = { fecha: new Date().toISOString().slice(0,10), count: 0 }; }

var LIMITE_REPORTES_DIA = 30;

function reportarAlerta(id) {
  if (alertasReportadas[id]) return;
  // Comprobar límite diario
  var hoyKey = new Date().toISOString().slice(0,10);
  if (_alertasHoy.fecha !== hoyKey) { _alertasHoy = { fecha: hoyKey, count: 0 }; } // nuevo día
  if (_alertasHoy.count >= LIMITE_REPORTES_DIA) {
    mostrarToast('⚠️ Límite diario de confirmaciones alcanzado (30/día)');
    return;
  }
  var alerta = PUNTOS.find(function(p){ return p.id === id; });
  if (!alerta) return;
  var nuevaExpira = Date.now() + 24*60*60*1000;
  var nuevosReportes = (alerta.reportes || 1) + 1;
  db.ref('alertas/' + id).update({ expiraTs: nuevaExpira, reportes: nuevosReportes });
  alerta.expiraTs = nuevaExpira;
  alerta.reportes = nuevosReportes;
  // Registrar reporte y actualizar contador diario
  alertasReportadas[id] = true;
  _alertasHoy.count++;
  try {
    localStorage.setItem('alertasReportadas', JSON.stringify(alertasReportadas));
    localStorage.setItem('alertasHoy', JSON.stringify(_alertasHoy));
  } catch(e) {}
  mapa.closePopup();
  mostrarToast('🚨 Alerta confirmada · se extiende 24h más');
}

// CSS animación pulso para alertas
(function(){
  var s = document.createElement('style');
  s.textContent = '@keyframes pulseAlerta{0%,100%{box-shadow:0 0 0 0 rgba(220,38,38,0.5)}50%{box-shadow:0 0 0 8px rgba(220,38,38,0)}}@keyframes chipAlertaPulse{0%,100%{background:#dc2626;color:#fff;border-color:#dc2626}50%{background:#fff;color:#dc2626;border-color:#dc2626}}';
  document.head.appendChild(s);
})();

// ── FIN SISTEMA DE ALERTAS ───────────────────────────────────────────────────

function añadirMarcadorUsuario(p) {
  if (p.esAlerta) { añadirMarcadorAlerta(p); return; }
  var iconPersona = L.divIcon({
    className: '',
    html: '<div style="background:#f59e0b;color:#fff;width:34px;height:34px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3)"><span style="transform:rotate(45deg);font-size:15px">👤</span></div>',
    iconSize:[34,34], iconAnchor:[17,34], popupAnchor:[0,-34]
  });
  var m = L.marker([p.lat, p.lng], { icon: iconPersona }).addTo(mapa);
  // Guardar referencia al marcador para poder eliminarlo del mapa
  p._marker = m;
  m.on('click', (function(punto) {
    return function() {
      if (window._navBloqPopups || window._simEsperandoUbicacion) return;
      var popupId = 'popup-del-' + punto.id;
      var esMiPunto = punto.deviceId === DEVICE_ID ||
        PUNTOS_USUARIO.find(function(x){ return x.id === punto.id; });
      var enRuta = rutaPuntos.find(function(x){ return x.id === punto.id; });
      var t2 = T[idiomaActual]||T.es;
      var btnRutaLabel = enRuta
        ? '✓ ' + (t2.enRuta||'En ruta').replace('✓ ','')
        : '+ ' + (t2.añadirRuta||'Añadir a ruta');
      var btnRutaStyle = enRuta
        ? 'margin-top:8px;width:100%;background:#1D9E75;color:#fff;border:none;border-radius:8px;padding:7px;font-size:14px;font-weight:600;cursor:pointer;font-family:DM Sans,sans-serif'
        : 'margin-top:8px;width:100%;background:#E1F5EE;color:#0F6E56;border:1px solid #1D9E75;border-radius:8px;padding:7px;font-size:14px;font-weight:600;cursor:pointer;font-family:DM Sans,sans-serif';
      var content = '<div style="font-family:DM Sans,sans-serif;min-width:200px;max-width:260px">' +
        '<strong style="font-size:16px">👤 ' + esc(punto.nombre) + '</strong><br>' +
        '<small style="color:#6b7280;font-size:13px">Punto añadido por usuario' +
        '</small>' +
        (punto.descripcion ? '<p style="font-size:15px;margin:6px 0 4px;color:#374151">' + esc(punto.descripcion) + '</p>' : '') +
        '<button onclick="addToRoute(\'' + punto.id + '\');mapa.closePopup();" style="' + btnRutaStyle + '">' + btnRutaLabel + '</button>' +
        (esMiPunto ? '<button onclick="eliminarPOIUsuario(\'' + punto.id + '\')" style="margin-top:6px;width:100%;background:#fff2f2;color:#ef4444;border:1.5px solid #ef4444;border-radius:8px;padding:7px;font-size:14px;font-weight:600;cursor:pointer;font-family:DM Sans,sans-serif">🗑️ Eliminar este punto</button>' : '') +
        '</div>';
      mapa.openPopup(L.popup({ className:'poi-popup', maxWidth:240 }).setLatLng([punto.lat,punto.lng]).setContent(content));
    };
  })(p));
}



// Abrir/cerrar formulario
// ============================================================
// VOLVER A LA RUTA OFICIAL (automático): coloca el punto más cercano del
// trazado, dibuja la línea con las flechas de color y ofrece "Comenzar".
// ============================================================
function volverARuta(){
  var lat = (typeof userLat!=='undefined' && userLat) ? userLat : null;
  var lng = (typeof userLng!=='undefined' && userLng) ? userLng : null;
  if (lat==null || lng==null){
    if (typeof mostrarToast==='function') mostrarToast('Necesito tu ubicación GPS para guiarte');
    return;
  }
  if(_bloquearSiLejos())return;
  if (!window.Desvio || !window.Desvio.puntoMasCercano){
    if (typeof mostrarToast==='function') mostrarToast('No hay trazado oficial cargado todavía');
    return;
  }
  var pc = window.Desvio.puntoMasCercano(lat, lng);
  if (pc){
    // Caso normal: ya hay un track cargado (estabas cerca). Guiar directo.
    _volverARutaCon(pc);
    return;
  }
  // Caso "muy lejos": no hay track cargado en el motor. Buscar en TODO el índice
  // la etapa más cercana sin límite de distancia, cargarla y guiar hasta ella.
  if (window.Selector && window.Selector.forzarDeteccion){
    if (typeof mostrarToast==='function') mostrarToast('Buscando el Camino más cercano…');
    window.Selector.forzarDeteccion(lat, lng).then(function(res){
      if (!res || res.lat==null){
        if (typeof mostrarToast==='function') mostrarToast('No detecto ningún Camino cercano');
        return;
      }
      _volverARutaCon({ lat:res.lat, lng:res.lng, distancia:res.distancia });
    }).catch(function(){
      if (typeof mostrarToast==='function') mostrarToast('No detecto ningún Camino cercano');
    });
    return;
  }
  if (typeof mostrarToast==='function') mostrarToast('No detecto un trazado oficial cercano');
}

// Inserta el punto de retorno como destino y arranca el ayudante de navegación.
function _volverARutaCon(pc){
  if (window.Desvio && window.Desvio.cerrarModal) window.Desvio.cerrarModal();
  // Insertar el punto de retorno como destino (sin duplicar) al principio.
  rutaPuntos = rutaPuntos.filter(function(p){ return p.id !== '_volver_ruta'; });
  rutaPuntos.unshift({ id:'_volver_ruta', nombre:'Volver a la ruta oficial', lat:pc.lat, lng:pc.lng, categoria:'volver' });
  if (typeof actualizarRuta==='function') actualizarRuta();   // dibuja línea+flechas, muestra ▶ Ir
  if (typeof _irAlMapa==='function') _irAlMapa();
  setTimeout(function(){
    if (typeof dibujarLineaEstática==='function') dibujarLineaEstática();
    _ponerMarkerVolver(pc.lat, pc.lng);
    _mostrarBtnComenzarNav();
  }, 450);
  if (typeof hablar==='function'){ try{ hablar(((typeof T!=='undefined'&&T[idiomaActual])?T[idiomaActual]:(typeof T!=='undefined'?T.es:{})).rofVolverVoz||'He marcado el punto más cercano de la ruta. Pulsa comenzar para que te guíe.'); }catch(e){} }
}

function _mostrarBtnComenzarNav(){
  var b = document.getElementById('btn-comenzar-nav');
  if (!b){
    b = document.createElement('button');
    b.id = 'btn-comenzar-nav';
    b.type = 'button';
    b.style.cssText =
      'position:fixed;left:50%;transform:translateX(-50%);bottom:90px;z-index:9997;'+
      'background:#1D9E75;color:#fff;border:none;border-radius:24px;padding:13px 22px;'+
      'font-size:15px;font-weight:700;font-family:DM Sans,sans-serif;cursor:pointer;'+
      'box-shadow:0 6px 22px rgba(0,0,0,0.32);display:flex;align-items:center;gap:8px';
    b.innerHTML = '<span style="font-size:17px;line-height:1">▶</span> Comenzar navegación';
    b.addEventListener('click', function(){
      _ocultarBtnComenzarNav();
      if (typeof activarNavegacionVoz==='function') activarNavegacionVoz();
    });
    document.body.appendChild(b);
  }
  b.style.display = 'flex';
}
function _ocultarBtnComenzarNav(){
  var b = document.getElementById('btn-comenzar-nav');
  if (b) b.style.display = 'none';
}

function _quitarMarkerVolver(){
  if (window._volverMarker && typeof mapa!=='undefined' && mapa){
    try{ mapa.removeLayer(window._volverMarker); }catch(e){}
  }
  window._volverMarker = null;
}
function _ponerMarkerVolver(lat, lng){
  _quitarMarkerVolver();
  if (typeof mapa==='undefined' || !mapa || !window.L) return;
  var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="42" viewBox="0 0 32 42">'+
    '<path d="M16 1C8 1 2 7 2 15c0 9 14 26 14 26s14-17 14-26C30 7 24 1 16 1z" fill="#a84f98" stroke="#fffdf7" stroke-width="2"/>'+
    '<circle cx="16" cy="15" r="5.5" fill="#fffdf7"/></svg>';
  window._volverMarker = L.marker([lat,lng], {
    icon: L.divIcon({
      className:'',
      html:'<div style="filter:drop-shadow(0 2px 4px rgba(0,0,0,0.45))">'+svg+'</div>',
      iconSize:[32,42], iconAnchor:[16,42], popupAnchor:[0,-38]
    }),
    zIndexOffset: 1000
  }).addTo(mapa);
  try{ window._volverMarker.bindPopup('Pulsa aquí para volver al trazado amarillo'); }catch(e){}
}

// Borra el ayudante "volver a la ruta": botón Comenzar, chincheta y, si existe,
// el punto de retorno sintético (con lo que su línea/flechas dejan de dibujarse).
// No toca el resto de la ruta del usuario.
function _limpiarVolverRuta(){
  _ocultarBtnComenzarNav();
  _quitarMarkerVolver();
  // Cancelar cualquier redibujo de línea pendiente (evita que un OSRM tardío
  // repinte la ruta al punto de retorno justo después de limpiarla).
  if (window._navRestoreTimeout) { clearTimeout(window._navRestoreTimeout); window._navRestoreTimeout = null; }
  if (typeof rutaPuntos !== 'undefined'){
    var antes = rutaPuntos.length;
    rutaPuntos = rutaPuntos.filter(function(p){ return p.id !== '_volver_ruta'; });
    var cambiado = (rutaPuntos.length !== antes);
    if (rutaPuntos.length === 0){
      // No queda ningún punto real: borrar trazado amarillo y flechas del mapa.
      if (typeof _rutaLinea !== 'undefined' && _rutaLinea && typeof mapa!=='undefined' && mapa){
        try{ mapa.removeLayer(_rutaLinea); }catch(e){}
        _rutaLinea = null;
      }
      if (window._rutaFlechas && typeof mapa!=='undefined' && mapa){
        window._rutaFlechas.forEach(function(m){ try{ mapa.removeLayer(m); }catch(e){} });
        window._rutaFlechas = [];
      }
    }
    // Redibujar/actualizar el panel y, si quedan puntos reales, su trazado.
    if (cambiado && typeof actualizarRuta === 'function') actualizarRuta();
  }
}

function abrirFormPOI() {
  poiFormLat = null; poiFormLng = null;
  document.getElementById('poi-input-nombre').value = '';
  document.getElementById('poi-input-desc').value = '';
  var modal = document.getElementById('modal-add-poi');
  if (modal) modal._nombreGuardado = '';
  var nombreBlock = document.getElementById('poi-nombre-block');
  var descBlock   = document.getElementById('poi-desc-block');
  var tiposBlock  = document.getElementById('poi-alerta-tipos');
  if (nombreBlock) nombreBlock.style.display = 'none';
  if (descBlock)   descBlock.style.display   = 'none';
  if (tiposBlock)  tiposBlock.style.display  = 'none';
  var indicador = document.getElementById('poi-alerta-indicador');
  if (indicador) indicador.style.display = 'none';
  var tipoBtns = document.querySelectorAll('#poi-alerta-tipos [data-tipo]');
  tipoBtns.forEach(function(b){ b.style.background='rgba(255,255,255,0.06)'; b.style.border='1px solid rgba(255,255,255,0.12)'; b.style.color='rgba(255,255,255,0.75)'; });
  document.getElementById('poi-input-cat').value = '';
  document.getElementById('poi-coords-display').textContent = '';
  document.getElementById('poi-form-msg').textContent = '';
  resetAllPoiCatBtns();
  var lbl = document.getElementById('poi-cat-seleccionada');
  if (lbl) lbl.style.display = 'none';
  cerrarSubcatDrawer();
  _abrirSlide('modal-add-poi');
}

function selPoiCat(btn, cat) {
  resetAllPoiCatBtns();
  btn.setAttribute('data-selected','1');
  aplicarEstiloSeleccionado(btn);
  document.getElementById('poi-input-cat').value = cat;
  document.getElementById('poi-form-msg').textContent = '';
  var lbl = document.getElementById('poi-cat-seleccionada');
  if (lbl) lbl.style.display = 'none';
  var nombreBlock = document.getElementById('poi-nombre-block');
  var descBlock   = document.getElementById('poi-desc-block');
  var tiposBlock  = document.getElementById('poi-alerta-tipos');
  var inputNombre = document.getElementById('poi-input-nombre');
  var nombreActual = inputNombre ? inputNombre.value : '';
  var tiposAlerta = ['⚠️ Vía cortada','🪨 Mal estado','⛺ Albergue cerrado'];
  var esAlerta = (cat === 'alerta');
  if (esAlerta) {
    // Guardar nombre escrito por el usuario antes de ocultar
    if (nombreActual && tiposAlerta.indexOf(nombreActual) === -1) {
      document.getElementById('modal-add-poi')._nombreGuardado = nombreActual;
    }
    if (nombreBlock) nombreBlock.style.display = 'none';
    if (descBlock)   descBlock.style.display   = 'none';
    if (tiposBlock)  tiposBlock.style.display  = '';
    var indicador = document.getElementById('poi-alerta-indicador');
    if (indicador) indicador.style.display = 'none';
    // Cerrar submenú de recomendar
    var recBlock = document.getElementById('poi-recomendar-tipos');
    if (recBlock) recBlock.style.display = 'none';
    var recInd = document.getElementById('poi-recomendar-indicador');
    if (recInd) recInd.style.display = 'none';
  } else {
    // Restaurar nombre guardado si venía de alerta
    if (tiposAlerta.indexOf(nombreActual) !== -1) {
      var guardado = document.getElementById('modal-add-poi')._nombreGuardado || '';
      if (inputNombre) inputNombre.value = guardado;
      document.getElementById('modal-add-poi')._nombreGuardado = '';
    }
    if (nombreBlock) nombreBlock.style.display = '';
    if (descBlock)   descBlock.style.display   = '';
    if (tiposBlock)  tiposBlock.style.display  = 'none';
    var indicador = document.getElementById('poi-alerta-indicador');
    if (indicador) indicador.style.display = 'none';
    var tipoBtns = document.querySelectorAll('#poi-alerta-tipos [data-tipo]');
    tipoBtns.forEach(function(b){ b.style.background='rgba(255,255,255,0.06)'; b.style.border='1px solid rgba(255,255,255,0.12)'; b.style.color='rgba(255,255,255,0.75)'; });
    // Ocultar también el bloque de recomendar
    var recBlock = document.getElementById('poi-recomendar-tipos');
    if (recBlock) recBlock.style.display = 'none';
    var recInd = document.getElementById('poi-recomendar-indicador');
    if (recInd) recInd.style.display = 'none';
  }
}

function selAlertaTipo(btn, tipo) {
  var tipoBtns = document.querySelectorAll('#poi-alerta-tipos [data-tipo]');
  tipoBtns.forEach(function(b){
    b.style.background = 'rgba(255,255,255,0.06)';
    b.style.border = '1px solid rgba(255,255,255,0.12)';
    b.style.color = 'rgba(255,255,255,0.75)';
  });
  btn.style.background = 'rgba(220,38,38,0.35)';
  btn.style.border = '1.5px solid rgba(252,165,165,0.7)';
  btn.style.color = '#fff';
  document.getElementById('poi-input-nombre').value = tipo;
  document.getElementById('poi-form-msg').textContent = '';
  // Cerrar selector y mostrar indicador
  var partes = tipo.split(' ');
  var emoji = partes[0];
  var texto = partes.slice(1).join(' ');
  document.getElementById('poi-alerta-tipos').style.display = 'none';
  var indicador = document.getElementById('poi-alerta-indicador');
  document.getElementById('poi-alerta-indicador-emoji').textContent = emoji;
  document.getElementById('poi-alerta-indicador-texto').textContent = texto;
  if (indicador) indicador.style.display = '';
}

function cambiarRecomendar() {
  document.getElementById('poi-recomendar-tipos').style.display = '';
  var ind = document.getElementById('poi-recomendar-indicador'); if (ind) ind.style.display = 'none';
  document.getElementById('poi-nombre-block').style.display = 'none';
  document.getElementById('poi-desc-block').style.display = 'none';
  document.getElementById('poi-input-cat').value = '';
}

function cambiarAlertaTipo() {
  document.getElementById('poi-alerta-tipos').style.display = '';
  var indicador = document.getElementById('poi-alerta-indicador');
  if (indicador) indicador.style.display = 'none';
  document.getElementById('poi-input-nombre').value = '';
}

function resetAllPoiCatBtns() {
  var btns = document.querySelectorAll('#modal-add-poi [data-cat]');
  btns.forEach(function(b){
    b.removeAttribute('data-selected');
    var cat = b.getAttribute('data-cat');
    // Restaurar estilos originales según categoría
    if (cat === 'alerta') {
      b.style.background = '#fff3f3'; b.style.border = '2px solid #fca5a5'; b.style.color = '#dc2626';
    } else if (cat === 'punto de control') {
      b.style.background = '#eff6ff'; b.style.border = '2px solid #93c5fd'; b.style.color = '#1d4ed8';
    } else {
      b.style.background = '#f0fdf4'; b.style.border = '2px solid #86efac'; b.style.color = '#15803d';
    }
    b.style.opacity = '1';
  });
}

function aplicarEstiloSeleccionado(btn) {
  var cat = btn.getAttribute('data-cat');
  if (cat === 'alerta') {
    btn.style.background = '#dc2626'; btn.style.border = '2px solid #dc2626'; btn.style.color = '#fff';
  } else if (cat === 'punto de control') {
    btn.style.background = '#1d4ed8'; btn.style.border = '2px solid #1d4ed8'; btn.style.color = '#fff';
  } else {
    btn.style.background = '#15803d'; btn.style.border = '2px solid #15803d'; btn.style.color = '#fff';
  }
}

function abrirSubcatDrawer() {
  var btn = document.getElementById('btn-recomendar-poi');
  if (btn) { resetAllPoiCatBtns(); btn.setAttribute('data-selected','1'); aplicarEstiloSeleccionado(btn); }
  document.getElementById('poi-input-cat').value = '';
  var lbl = document.getElementById('poi-cat-seleccionada'); if (lbl) lbl.style.display = 'none';
  document.getElementById('poi-alerta-tipos').style.display = 'none';
  var ind = document.getElementById('poi-alerta-indicador'); if (ind) ind.style.display = 'none';
  document.getElementById('poi-nombre-block').style.display = 'none';
  document.getElementById('poi-desc-block').style.display = 'none';
  document.getElementById('poi-recomendar-tipos').style.display = '';
  var ri = document.getElementById('poi-recomendar-indicador'); if (ri) ri.style.display = 'none';
  var tipoBtns = document.querySelectorAll('#poi-recomendar-tipos button');
  tipoBtns.forEach(function(b){ b.style.background='rgba(255,255,255,0.06)'; b.style.border='1px solid rgba(255,255,255,0.12)'; b.style.color='rgba(255,255,255,0.75)'; });
}

function cerrarSubcatDrawer() {
  document.getElementById('subcats-drawer-bg').style.display = 'none';
  document.getElementById('subcats-drawer').style.display = 'none';
}

function selSubcat(cat, emoji, texto) {
  var tipoBtns = document.querySelectorAll('#poi-recomendar-tipos button');
  tipoBtns.forEach(function(b){ b.style.background='rgba(255,255,255,0.06)'; b.style.border='1px solid rgba(255,255,255,0.12)'; b.style.color='rgba(255,255,255,0.75)'; });
  // Resaltar el botón pulsado
  event.currentTarget.style.background = 'rgba(29,158,117,0.35)';
  event.currentTarget.style.border = '1.5px solid rgba(110,231,183,0.7)';
  event.currentTarget.style.color = '#fff';
  document.getElementById('poi-input-cat').value = cat;
  document.getElementById('poi-form-msg').textContent = '';
  // Ocultar selector, mostrar indicador
  document.getElementById('poi-recomendar-tipos').style.display = 'none';
  document.getElementById('poi-recomendar-indicador-emoji').textContent = emoji;
  document.getElementById('poi-recomendar-indicador-texto').textContent = texto;
  var ind = document.getElementById('poi-recomendar-indicador'); if (ind) ind.style.display = '';
  // Mostrar campos nombre y descripción
  document.getElementById('poi-nombre-block').style.display = '';
  document.getElementById('poi-desc-block').style.display = '';
  var lbl = document.getElementById('poi-cat-seleccionada'); if (lbl) lbl.style.display = 'none';
}

function cerrarFormPOI() {
  _cerrarSlide('modal-add-poi');
}

// Usar GPS actual
function usarMiUbicacion() {
  var btn = document.getElementById('btn-mi-ubic');
  var txt = document.getElementById('btn-mi-ubic-txt');
  var orig = txt.textContent;
  txt.textContent = 'Obteniendo...';
  btn.disabled = true;
  navigator.geolocation.getCurrentPosition(function(pos) {
    poiFormLat = pos.coords.latitude;
    poiFormLng = pos.coords.longitude;
    document.getElementById('poi-coords-display').innerHTML =
      '✅ ' + poiFormLat.toFixed(5) + ', ' + poiFormLng.toFixed(5);
    txt.textContent = orig;
    btn.disabled = false;
  }, function() {
    document.getElementById('poi-coords-display').textContent = '❌ No se pudo obtener la ubicación';
    txt.textContent = orig;
    btn.disabled = false;
  }, { enableHighAccuracy: true, timeout: 8000 });
}

// Marcar punto en el mapa tocando/haciendo click
function activarMarcarEnMapa() {
  if (typeof mapa === 'undefined' || !mapa) {
    document.getElementById('poi-coords-display').textContent = '❌ El mapa no está disponible';
    return;
  }

  // Cerrar el panel slide para mostrar el mapa
  _cerrarSlide('modal-add-poi');

  // Ocultar botones de añadir punto
  var btnMap = document.getElementById('btn-add-poi-map');
  var btnSec = document.getElementById('btn-add-poi');
  if (btnMap) btnMap.style.display = 'none';
  if (btnSec) btnSec.style.display = 'none';

  // Mostrar solo el banner de instrucción sobre el mapa
  var overlay = document.getElementById('overlay-marcar-mapa');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'overlay-marcar-mapa';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9998;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;padding-top:16px;pointer-events:none';

    var banner = document.createElement('div');
    banner.style.cssText = 'pointer-events:all;background:#1D9E75;color:#fff;border-radius:20px;padding:11px 20px;box-shadow:0 4px 16px rgba(0,0,0,0.2);display:flex;align-items:center;gap:10px;font-family:DM Sans,sans-serif';

    var texto = document.createElement('span');
    texto.style.cssText = 'font-size:15px;font-weight:600';
    texto.textContent = '📍 Toca en el mapa para marcar el punto, o usa el buscador del mapa y toca la ubicación adecuada';

    var btnCancelar = document.createElement('button');
    btnCancelar.textContent = '✕';
    btnCancelar.style.cssText = 'background:rgba(255,255,255,0.25);color:#fff;border:none;border-radius:50%;width:26px;height:26px;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0';
    btnCancelar.addEventListener('touchend', function(e){ e.preventDefault(); cancelarMarcarMapa(); });
    btnCancelar.addEventListener('click', function(){ cancelarMarcarMapa(); });

    banner.appendChild(texto);
    banner.appendChild(btnCancelar);
    overlay.appendChild(banner);
    document.body.appendChild(overlay);
  }
  overlay.style.display = 'flex';

  // Desplazar al mapa para que sea visible al marcar
  var mapBlock = document.querySelector('.map-block');
  if (mapBlock) {
    setTimeout(function() {
      mapBlock.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }

  // Cambiar cursor del mapa
  mapa.getContainer().style.cursor = 'crosshair';

  // Listener de un solo uso para capturar el click en el mapa
  function onMapClick(e) {
    poiFormLat = parseFloat(e.latlng.lat.toFixed(6));
    poiFormLng = parseFloat(e.latlng.lng.toFixed(6));
    confirmarUbicacionMapa();
    mapa.off('click', onMapClick);
  }
  mapa.on('click', onMapClick);
  window._onMapClickPOI = onMapClick;
}

function confirmarUbicacionMapa() {
  // Quitar listener del mapa
  if (window._onMapClickPOI) { mapa.off('click', window._onMapClickPOI); window._onMapClickPOI = null; }
  mapa.getContainer().style.cursor = '';

  // Marcador temporal
  if (window._tempMarkerPOI) mapa.removeLayer(window._tempMarkerPOI);
  window._tempMarkerPOI = L.marker([poiFormLat, poiFormLng], {
    icon: L.divIcon({
      className: '',
      html: '<div style="width:18px;height:18px;border-radius:50%;background:#1D9E75;border:3px solid #fff;box-shadow:0 0 0 3px rgba(29,158,117,0.5)"></div>',
      iconSize:[18,18], iconAnchor:[9,9]
    })
  }).addTo(mapa);

  // Ocultar overlay y restaurar modal
  var overlay = document.getElementById('overlay-marcar-mapa');
  if (overlay) overlay.style.display = 'none';
  _abrirSlide('modal-add-poi');

  // Restaurar botones de añadir punto
  var btnMap = document.getElementById('btn-add-poi-map');
  var btnSec = document.getElementById('btn-add-poi');
  if (btnMap && !_navActiva) btnMap.style.display = 'flex';
  if (btnSec) btnSec.style.display = 'flex';

  // Mostrar coordenadas
  document.getElementById('poi-coords-display').innerHTML =
    '✅ ' + poiFormLat.toFixed(5) + ', ' + poiFormLng.toFixed(5);
}

function cancelarMarcarMapa() {
  if (window._onMapClickPOI) { mapa.off('click', window._onMapClickPOI); window._onMapClickPOI = null; }
  mapa.getContainer().style.cursor = '';
  var overlay = document.getElementById('overlay-marcar-mapa');
  if (overlay) overlay.style.display = 'none';
  _abrirSlide('modal-add-poi');
  // Restaurar botones de añadir punto
  var btnMap = document.getElementById('btn-add-poi-map');
  var btnSec = document.getElementById('btn-add-poi');
  if (btnMap && !_navActiva) btnMap.style.display = 'flex';
  if (btnSec) btnSec.style.display = 'flex';
}

// Limpiar marcador temporal al cerrar el formulario
var _origCerrarFormPOI = cerrarFormPOI;
cerrarFormPOI = function() {
  if (window._tempMarkerPOI) { mapa.removeLayer(window._tempMarkerPOI); window._tempMarkerPOI = null; }
  if (window._onMapClickPOI) { mapa.off('click', window._onMapClickPOI); window._onMapClickPOI = null; }
  var overlay = document.getElementById('overlay-marcar-mapa');
  if (overlay) overlay.style.display = 'none';
  if (typeof mapa !== 'undefined' && mapa) mapa.getContainer().style.cursor = '';
  _origCerrarFormPOI();
};

// Guardar POI
function guardarPOIUsuario() {
  var nombre = document.getElementById('poi-input-nombre').value.trim();
  var desc   = document.getElementById('poi-input-desc').value.trim();
  var cat    = document.getElementById('poi-input-cat').value;
  var msg    = document.getElementById('poi-form-msg');

  var esAlertaCheck = (cat === 'alerta');
  if (esAlertaCheck && !nombre) { msg.innerHTML = '<span style="color:#dc2626">⚠️ Selecciona el tipo de alerta</span>'; return; }
  if (!esAlertaCheck && !nombre) { msg.innerHTML = '<span style="color:#dc2626">⚠️ El nombre es obligatorio</span>'; return; }
  if (!cat)    { msg.innerHTML = '<span style="color:#dc2626">⚠️ Selecciona una categoría</span>'; return; }
  if (!poiFormLat || !poiFormLng) { msg.innerHTML = '<span style="color:#dc2626">⚠️ Indica la ubicación</span>'; return; }

  var id = USER_POI_PREFIX + Date.now();
  var esAlerta = (cat === 'alerta');
  var expiraTs = esAlerta ? (Date.now() + 24*60*60*1000) : null; // 24h en ms
  var poi = {
    id: id,
    nombre: nombre,
    descripcion: desc || '',
    categoria: cat,
    lat: poiFormLat,
    lng: poiFormLng,
    emoji: esAlerta ? '🚨' : '👤',
    color: esAlerta ? 'coral' : 'ambar',
    esUsuario: true,
    esAlerta: esAlerta,
    estado: esAlerta ? 'activa' : 'pendiente',
    ts: Date.now(),
    expiraTs: expiraTs,
    reportes: esAlerta ? 1 : 0,
    deviceId: DEVICE_ID
  };

  var btn = document.getElementById('btn-poi-guardar');
  btn.disabled = true;

  // Alertas: visibles inmediatamente para todos via Firebase en tiempo real
  // Otros: solo local hasta moderación
  PUNTOS_USUARIO.push(poi);
  try { localStorage.setItem('poi_usuario', JSON.stringify(PUNTOS_USUARIO)); } catch(e) {}

  // Registrar en álbum automáticamente (el usuario creó este punto, ya lo "visitó")
  if (window._albumRegistrarVisita && cat === 'punto de control') window._albumRegistrarVisita(poi, true);

  if (!valoraciones[id]) valoraciones[id] = {total:0, votos:0, miVoto:0};
  if (!opiniones[id]) opiniones[id] = [];
  PUNTOS.push(poi);
  if (typeof mapa !== 'undefined' && mapa) añadirMarcadorUsuario(poi);
  if (typeof userLat !== 'undefined' && userLat) {
    PUNTOS.forEach(function(p){p.distancia=haversine(userLat,userLng,p.lat,p.lng);});
    PUNTOS.sort(function(a,b){return a.distancia-b.distancia;});
  }
  cerrarFormPOI();
  btn.disabled = false;
  // Restaurar scroll al mapa tras cerrar el formulario
  setTimeout(function() {
    if (document.activeElement) document.activeElement.blur();
    var mapBlock = document.getElementById('map-block') || document.querySelector('.map-block');
    if (mapBlock) {
      mapBlock.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      var el = document.getElementById('map');
      if (el) {
        var rect = el.getBoundingClientRect();
        window.scrollTo({ top: Math.max(0, window.pageYOffset + rect.top - (window.innerHeight/2) + (rect.height/2)), behavior: 'smooth' });
      }
    }
  }, 350);
  var chipU = document.getElementById('chip-usuario-drawer');
  if (chipU) chipU.style.display = '';
  var chipUM = document.getElementById('chip-usuario-mapa');
  if (chipUM) chipUM.style.display = '';
  renderCarrusel(categoriaActiva);

  // Firebase: alertas van a rama 'alertas' (pública, tiempo real); resto a poi_usuarios (moderación)
  try {
    // Limpiar propiedades no serializables antes de enviar a Firebase
    var poiFirebase = {
      id: poi.id,
      nombre: poi.nombre,
      descripcion: poi.descripcion,
      categoria: poi.categoria,
      lat: poi.lat,
      lng: poi.lng,
      emoji: poi.emoji,
      color: poi.color,
      esUsuario: true,
      esAlerta: poi.esAlerta || false,
      estado: poi.estado,
      ts: poi.ts,
      expiraTs: poi.expiraTs || null,
      reportes: poi.reportes || 0,
      deviceId: poi.deviceId
    };
    if (esAlerta) {
      db.ref('alertas/' + id).set(poiFirebase).then(function() {
        mostrarToast('🚨 Alerta publicada para todos');
      }, function(err) {
        console.warn('Firebase alerta error:', err.message);
        mostrarToast('⚠️ Error al publicar alerta: ' + err.message);
      });
    } else {
      db.ref('poi_usuarios/' + id).set(poiFirebase).then(function() {
      }, function(err) {
        console.warn('Firebase rechazó el POI:', err.message);
        mostrarToast('⚠️ Error Firebase: ' + err.message);
      });
    }
  } catch(e) {
    console.warn('Error Firebase:', e);
    mostrarToast('⚠️ Error Firebase: ' + e.message);
  }
}

// Cerrar modal tocando el fondo
document.addEventListener('click', function(e) {
  var modal = document.getElementById('modal-add-poi');
  if (e.target === modal) cerrarFormPOI();
});

// Comprobar POIs cercanos y enviar notificación local si la app está abierta
var notifEnviadas = {};
function iniciarProximidad() {
  if (!navigator.geolocation) return;
  setInterval(function() {
    if (!notifActivadas) return;
    navigator.geolocation.getCurrentPosition(function(pos) {
      var lat = pos.coords.latitude, lng = pos.coords.longitude;
      PUNTOS.forEach(function(p) {
        if (notifEnviadas[p.id]) return;
        var d = calcDistancia(lat, lng, p.lat, p.lng);
        if (d < 0.025) { // 25 metros
          notifEnviadas[p.id] = true;
          var t = (T[idiomaActual]||T.es);
          new Notification('📍 ' + (idiomaActual==='gl'&&p.nombre_gl?p.nombre_gl:idiomaActual==='en'&&p.nombre_en?p.nombre_en:p.nombre), {
            body: p.subtitulo || t.mapSubtitle,
            icon: ''
          });
        }
      });
    }, {enableHighAccuracy:true});
  }, 30000); // cada 30 segundos
}

function calcDistancia(lat1, lng1, lat2, lng2) {
  var R=6371, dLat=(lat2-lat1)*Math.PI/180, dLng=(lng2-lng1)*Math.PI/180;
  var a=Math.sin(dLat/2)*Math.sin(dLat/2)+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)*Math.sin(dLng/2);
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}
// ────────────────────────────────────────────────────────────────────────────

function cargarDatosFirebase() {
  PUNTOS.forEach(function(p) {
    db.ref('puntos/' + p.id + '/valoracion').on('value', function(snap) {
      var val = snap.val();
      if (val) {
        valoraciones[p.id].total = val.total || 0;
        valoraciones[p.id].votos = val.votos || 0;
        actualizarEstrellasPunto(p.id);
      }
    });
    db.ref('puntos/' + p.id + '/comentarios').on('value', function(snap) {
      var data = snap.val();
      if (data) {
        opiniones[p.id] = Object.values(data).sort(function(a,b){ return a.ts-b.ts; });
        actualizarListaOpiniones(p.id);
      }
    });
  });
}

function actualizarEstrellasPunto(id) {
  var val = valoraciones[id];
  var media = val.votos > 0 ? (val.total/val.votos).toFixed(1) : '-';
  var card = document.querySelector('[data-poi-id="'+id+'"]');
  if (!card) return;
  var starsC = card.querySelector('.stars');
  if (starsC) {
    starsC.innerHTML = '';
    for (var sn=1; sn<=5; sn++) {
      var star = document.createElement('span');
      star.innerHTML = sn<=val.miVoto ? '&#9733;' : '&#9734;';
      star.className = sn<=val.miVoto ? 'star activa' : 'star';
      star.setAttribute('data-id', id);
      star.setAttribute('data-n', sn);
      starsC.appendChild(star);
    }
  }
  var countEl = card.querySelector('.stars-count');
  if (countEl) countEl.innerHTML = '('+media+(val.votos>0?' &middot; '+val.votos+' votos':'')+')';
  // Actualizar badge ranking en imagen
  var rankEl = document.getElementById('rank-'+id);
  if (rankEl) rankEl.innerHTML = '&#9733; ' + (val.votos>0 ? media : '-');
}

function actualizarListaOpiniones(id) {
  var lista = document.getElementById('ops-'+id);
  if (!lista) return;
  var ops = opiniones[id];
  if (ops && ops.length > 0) {
    lista.innerHTML = ops.map(function(o){
      return '<div class="opinion-item"><strong>'+esc(o.autor)+':</strong> '+esc(o.texto)+'</div>';
    }).join('');
  }
}

function guardarValoracion(id) {
  if (typeof db === 'undefined') return;
  var val = valoraciones[id];
  db.ref('puntos/' + id + '/valoracion').set({
    total: val.total,
    votos: val.votos
  });
}

function guardarComentario(id, texto) {
  if (typeof db === 'undefined') return;
  db.ref('pendientes/' + id).push({
    autor: (T[idiomaActual]||T.es).autorOpinion,
    texto: texto,
    ts: Date.now()
  });
  // Confirmar al usuario que está pendiente de revisión
  var lista = document.getElementById('ops-'+id);
  if (lista) {
    var aviso = document.createElement('div');
    aviso.className = 'opinion-item';
    aviso.style.cssText = 'color:#6b7280;font-style:italic';
    aviso.textContent = (T[idiomaActual]||T.es).opinionPendiente;
    lista.appendChild(aviso);
    setTimeout(function(){ if(aviso.parentNode) aviso.parentNode.removeChild(aviso); }, 4000);
  }
}

// ── MODERACIÓN (Firebase Auth) ──────────────────────────────────────────────
var adminActivo = false;

function abrirAdmin() {
  // Solo saltar el login si hay un admin REAL (email/contraseña).
  // El usuario anónimo no cuenta como admin.
  if (auth.currentUser && !auth.currentUser.isAnonymous) {
    _mostrarPanelAdmin();
    return;
  }
  document.getElementById('login-admin-error').style.display = 'none';
  document.getElementById('login-admin-pass').value = '';
  document.getElementById('modal-login-admin').classList.add('visible');
  setTimeout(function(){ var e=document.getElementById('login-admin-email'); if(e) e.focus(); }, 50);
}

function intentarLoginAdmin() {
  var email = document.getElementById('login-admin-email').value.trim();
  var pass = document.getElementById('login-admin-pass').value;
  var errEl = document.getElementById('login-admin-error');
  errEl.style.display = 'none';
  if (!email || !pass) {
    errEl.textContent = 'Introduce correo y contraseña.';
    errEl.style.display = 'block';
    return;
  }
  auth.signInWithEmailAndPassword(email, pass).then(function() {
    document.getElementById('modal-login-admin').classList.remove('visible');
    _mostrarPanelAdmin();
  }).catch(function(err) {
    errEl.textContent = 'Acceso denegado.';
    errEl.style.display = 'block';
    console.warn('Login admin fallido:', err.code);
  });
}

function cerrarSesionAdmin() {
  auth.signOut().then(function() {
    cerrarAdmin();
  });
}

function _mostrarPanelAdmin() {
  adminActivo = true;
  document.getElementById('panel-admin').classList.add('visible');
  cargarPendientes();
  // Badges de pendientes (lecturas públicas, no requieren auth)
  if (typeof db !== 'undefined') {
    db.ref('poi_usuarios').orderByChild('estado').equalTo('pendiente').once('value', function(snap) {
      var badge = document.getElementById('badge-pois-pendientes');
      if (!badge) return;
      var n = snap.val() ? Object.keys(snap.val()).length : 0;
      if (n > 0) { badge.textContent = n; badge.style.display = 'inline'; }
      else { badge.style.display = 'none'; }
    });
    db.ref('alertas').once('value', function(snap) {
      var badge = document.getElementById('badge-alertas');
      if (!badge) return;
      var n = snap.val() ? Object.keys(snap.val()).length : 0;
      if (n > 0) { badge.textContent = n; badge.style.display = 'inline'; }
      else { badge.style.display = 'none'; }
    });
    db.ref('errores_app').once('value', function(snap) {
      var badge = document.getElementById('badge-errores');
      if (!badge) return;
      var n = snap.val() ? Object.keys(snap.val()).length : 0;
      if (n > 0) { badge.textContent = n; badge.style.display = 'inline'; }
      else { badge.style.display = 'none'; }
    });
  }
}

function cerrarAdmin() {
  document.getElementById('panel-admin').classList.remove('visible');
  adminActivo = false;
}

function cargarPendientes() {
  var lista = document.getElementById('admin-lista');
  lista.innerHTML = '<p style="color:#6b7280;font-size:15px">Cargando...</p>';
  // Wait for Firebase if not ready yet
  if (typeof db === 'undefined') {
    var intentos = 0;
    var esperar = setInterval(function() {
      intentos++;
      if (typeof db !== 'undefined') {
        clearInterval(esperar);
        cargarPendientes();
      } else if (intentos > 20) {
        clearInterval(esperar);
        lista.innerHTML = '<p style="color:#EF4444;font-size:15px">Firebase no disponible. Recarga la página e inténtalo de nuevo.</p>';
      }
    }, 300);
    return;
  }
  db.ref('pendientes').once('value', function(snap) {
    var data = snap.val();
    if (!data) {
      lista.innerHTML = '<p style="color:#6b7280;font-size:15px;text-align:center">No hay opiniones pendientes ✓</p>';
      return;
    }
    lista.innerHTML = '';
    var total = 0;
    Object.keys(data).forEach(function(poiId) {
      var ops = data[poiId];
      Object.keys(ops).forEach(function(opKey) {
        total++;
        var op = ops[opKey];
        var poi = PUNTOS.find(function(p){ return p.id === poiId; });
        var poiNombre = poi ? poi.nombre : poiId;
        var item = document.createElement('div');
        item.style.cssText = 'background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:12px;margin-bottom:10px';
        item.innerHTML =
          '<div style="font-size:13px;color:#6b7280;margin-bottom:4px">📍 '+poiNombre+'</div>'+
          '<div style="font-size:15px;color:#1a1a1a;margin-bottom:8px"><strong>'+esc(op.autor)+':</strong> '+esc(op.texto)+'</div>'+
          '<div style="display:flex;gap:8px">'+
          '<button class="mod-aprobar" data-poi="'+poiId+'" data-key="'+opKey+'" style="flex:1;background:#1D9E75;color:#fff;border:none;border-radius:8px;padding:8px;font-size:15px;cursor:pointer">✓ Aprobar</button>'+
          '<button class="mod-rechazar" data-poi="'+poiId+'" data-key="'+opKey+'" style="flex:1;background:#EF4444;color:#fff;border:none;border-radius:8px;padding:8px;font-size:15px;cursor:pointer">✗ Rechazar</button>'+
          '</div>';
        lista.appendChild(item);
      });
    });
    if (total === 0) lista.innerHTML = '<p style="color:#6b7280;font-size:15px;text-align:center">No hay opiniones pendientes ✓</p>';
    // Event delegation for approve/reject buttons
    lista.onclick = function(e) {
      var btn = e.target.closest('.mod-aprobar,.mod-rechazar');
      if (!btn) return;
      var pid = btn.getAttribute('data-poi');
      var key = btn.getAttribute('data-key');
      var row = btn.closest('div[style]');
      if (btn.classList.contains('mod-aprobar')) aprobarOpinion(pid, key, row);
      else rechazarOpinion(pid, key, row);
    };
  });
}

function aprobarOpinion(poiId, opKey, el) {
  db.ref('pendientes/'+poiId+'/'+opKey).once('value', function(snap) {
    var op = snap.val();
    if (!op) return;
    db.ref('puntos/'+poiId+'/comentarios').push(op).then(function() {
      db.ref('pendientes/'+poiId+'/'+opKey).remove();
      if (el && el.parentNode) el.parentNode.removeChild(el);
    });
  });
}

function rechazarOpinion(poiId, opKey, el) {
  db.ref('pendientes/'+poiId+'/'+opKey).remove().then(function() {
    if (el && el.parentNode) el.parentNode.removeChild(el);
  });
}
// ── ELIMINAR POI DE USUARIO ──────────────────────────────────────────────────
function eliminarPOIUsuario(poiId) {
  var t2 = T[idiomaActual]||T.es;
  var _doEliminar = function() {
    // 1. Cerrar popup del mapa
    mapa.closePopup();
    // 2. Quitar marcador del mapa
    var poi = PUNTOS.find(function(p){ return p.id === poiId; });
    if (poi && poi._marker) { mapa.removeLayer(poi._marker); }
    // 3. Quitar de PUNTOS y PUNTOS_USUARIO
    PUNTOS = PUNTOS.filter(function(p){ return p.id !== poiId; });
    PUNTOS_USUARIO = PUNTOS_USUARIO.filter(function(p){ return p.id !== poiId; });
    try { localStorage.setItem('poi_usuario', JSON.stringify(PUNTOS_USUARIO)); } catch(e) {}
    // 4. Quitar de la ruta si estaba añadido
    if (rutaPuntos.find(function(x){ return x.id === poiId; })) { quitarDeRuta(poiId); }
    // 5. Eliminar de Firebase
    db.ref('poi_usuarios/' + poiId).remove().catch(function(e){ console.warn('No se pudo eliminar de Firebase:', e); });
    // 6. Actualizar carrusel y poi-drawer
    renderCarrusel(categoriaActiva);
    if (typeof _renderPoiDrawerCarrusel === 'function') _renderPoiDrawerCarrusel();
    // Ocultar chip 'Mis puntos' si ya no quedan puntos de usuario
    if (PUNTOS_USUARIO.length === 0) {
      var chipUD = document.getElementById('chip-usuario-drawer');
      if (chipUD) chipUD.style.display = 'none';
      var chipUM = document.getElementById('chip-usuario-mapa');
      if (chipUM) chipUM.style.display = 'none';
    }
    mostrarToast('🗑️ Punto eliminado');
  };
  var msgElim = (t2.confirmarEliminar)||'¿Eliminar este punto?';
  var overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:19999;display:flex;align-items:center;justify-content:center';
  overlay.innerHTML =
    '<div style="background:#fff;border-radius:14px;padding:1.5rem 1.5rem 1.25rem;max-width:300px;width:88%;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,0.18)">' +
    '<div style="font-size:32px;margin-bottom:10px">📍</div>' +
    '<p style="font-family:DM Sans,sans-serif;font-size:15px;font-weight:600;color:#1a1a1a;margin:0 0 20px">'+msgElim+'</p>' +
    '<div style="display:flex;gap:10px;justify-content:center">' +
    '<button id="confirm-poi-cancel" style="flex:1;background:#f3f4f6;border:none;border-radius:10px;padding:10px 0;font-size:16px;font-weight:500;cursor:pointer;font-family:DM Sans,sans-serif;color:#374151">Cancelar</button>' +
    '<button id="confirm-poi-ok" style="flex:1;background:#dc2626;border:none;border-radius:10px;padding:10px 0;font-size:16px;font-weight:600;cursor:pointer;font-family:DM Sans,sans-serif;color:#fff">Eliminar</button>' +
    '</div></div>';
  document.body.appendChild(overlay);
  overlay.addEventListener('click', function(e){ if(e.target===overlay) overlay.remove(); });
  document.getElementById('confirm-poi-cancel').addEventListener('click', function(){ overlay.remove(); });
  document.getElementById('confirm-poi-ok').addEventListener('click', function(){ overlay.remove(); _doEliminar(); });
}

// Delegación de eventos para el botón eliminar
document.addEventListener('click', function(e) {
  var btn = e.target.closest('[data-poi-del]');
  if (!btn) return;
  e.stopPropagation();
  e.preventDefault();
  var poiId = btn.getAttribute('data-poi-del');
  if (poiId) eliminarPOIUsuario(poiId);
}, true); // true = captura en fase de captura, antes que otros listeners

// ── MODERACIÓN DE POIs DE USUARIO ───────────────────────────────────────────

function cambiarTabAdmin(tab) {
  var tabs = ['opiniones','pois','alertas','errores'];
  tabs.forEach(function(t) {
    var btn = document.getElementById('tab-'+t);
    var panel = document.getElementById('panel-tab-'+t);
    if (t === tab) {
      btn.style.borderBottomColor = '#1D9E75';
      btn.style.color = '#1D9E75';
      btn.style.fontWeight = '600';
      panel.style.display = 'block';
    } else {
      btn.style.borderBottomColor = 'transparent';
      btn.style.color = '#6b7280';
      btn.style.fontWeight = '500';
      panel.style.display = 'none';
    }
  });
  if (tab === 'pois') cargarPOIsPendientes();
  if (tab === 'alertas') cargarAlertasAdmin();
  if (tab === 'errores') cargarErrores();
}

function cargarAlertasAdmin() {
  var lista = document.getElementById('admin-alertas-lista');
  lista.innerHTML = '<p style="color:#6b7280;font-size:15px">Cargando...</p>';
  db.ref('alertas').once('value', function(snap) {
    var data = snap.val();
    var badge = document.getElementById('badge-alertas');
    if (!data || Object.keys(data).length === 0) {
      lista.innerHTML = '<p style="color:#6b7280;font-size:15px;text-align:center">No hay alertas registradas ✓</p>';
      if (badge) badge.style.display = 'none';
      return;
    }
    var keys = Object.keys(data);
    if (badge) { badge.textContent = keys.length; badge.style.display = 'inline'; }
    lista.innerHTML = '';
    var ahora = Date.now();
    // Ordenar: activas primero, luego caducadas
    keys.sort(function(a,b){
      var ea = data[a].expiraTs || 0;
      var eb = data[b].expiraTs || 0;
      return eb - ea;
    });
    keys.forEach(function(key) {
      var a = data[key];
      var caducada = a.expiraTs && ahora > a.expiraTs;
      var expiraStr = a.expiraTs
        ? (caducada ? 'Caducada' : 'Caduca en ~' + Math.round((a.expiraTs - ahora)/3600000) + 'h')
        : 'Sin caducidad';
      var fechaStr = a.ts ? new Date(a.ts).toLocaleString('es-ES',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}) : '';
      var item = document.createElement('div');
      item.style.cssText = 'background:' + (caducada ? '#f9fafb' : '#fff5f5') + ';border:1px solid ' + (caducada ? '#e5e7eb' : '#fca5a5') + ';border-radius:10px;padding:12px;margin-bottom:10px;opacity:' + (caducada ? '0.65' : '1');
      item.innerHTML =
        '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:4px">' +
          '<strong style="font-size:16px;color:#dc2626">🚨 ' + esc(a.nombre) + '</strong>' +
          '<span style="font-size:13px;color:#9ca3af;flex-shrink:0">' + fechaStr + '</span>' +
        '</div>' +
        (a.descripcion ? '<div style="font-size:15px;color:#374151;margin-bottom:6px;line-height:1.4">' + esc(a.descripcion) + '</div>' : '') +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px">' +
          '<span style="font-size:13px;background:#fef2f2;color:#dc2626;border-radius:8px;padding:2px 8px">⏱ ' + expiraStr + '</span>' +
          '<span style="font-size:13px;background:#f3f4f6;color:#374151;border-radius:8px;padding:2px 8px">👥 ' + (a.reportes||1) + ' reporte(s)</span>' +
          '<span style="font-size:13px;background:#f3f4f6;color:#9ca3af;border-radius:8px;padding:2px 8px">📌 ' + (a.lat||0).toFixed(4) + ', ' + (a.lng||0).toFixed(4) + '</span>' +
        '</div>' +
        '<div style="display:flex;gap:8px">' +
          '<button class="alerta-mod-extender" data-key="' + key + '" style="flex:1;background:#f59e0b;color:#fff;border:none;border-radius:8px;padding:8px;font-size:14px;font-weight:600;cursor:pointer' + (caducada?';opacity:0.4;pointer-events:none':'') + '">+24h</button>' +
          '<button class="alerta-mod-eliminar" data-key="' + key + '" style="flex:1;background:#ef4444;color:#fff;border:none;border-radius:8px;padding:8px;font-size:14px;font-weight:600;cursor:pointer">🗑 Eliminar</button>' +
        '</div>';
      lista.appendChild(item);
    });
    lista.onclick = function(e) {
      var btn = e.target.closest('.alerta-mod-extender,.alerta-mod-eliminar');
      if (!btn) return;
      var k = btn.getAttribute('data-key');
      var row = btn.closest('div[style]');
      if (btn.classList.contains('alerta-mod-extender')) {
        db.ref('alertas/' + k).update({ expiraTs: Date.now() + 24*60*60*1000 }).then(function(){
          cargarAlertasAdmin();
        });
      } else {
        db.ref('alertas/' + k).remove().then(function(){
          if (row && row.parentNode) row.parentNode.removeChild(row);
          var n = lista.querySelectorAll('div[style]').length;
          if (!n) lista.innerHTML = '<p style="color:#6b7280;font-size:15px;text-align:center">No hay alertas registradas ✓</p>';
          if (badge) { badge.textContent = parseInt(badge.textContent||1)-1; if(parseInt(badge.textContent)<=0) badge.style.display='none'; }
        });
      }
    };
  });
}

function cargarErrores() {
  var lista = document.getElementById('admin-errores-lista');
  lista.innerHTML = '<p style="color:#6b7280;font-size:15px">Cargando...</p>';
  db.ref('errores_app').once('value', function(snap) {
    var data = snap.val();
    var badge = document.getElementById('badge-errores');
    if (!data) {
      lista.innerHTML = '<p style="color:#6b7280;font-size:15px;text-align:center">Sin errores registrados ✓</p>';
      if (badge) badge.style.display = 'none';
      return;
    }
    var keys = Object.keys(data);
    // Limpieza automática: si hay más de 200, borrar los más antiguos (las claves push() de Firebase son cronológicas)
    if (keys.length > 200) {
      var keysOrdenadas = keys.slice().sort();
      var aBorrar = keysOrdenadas.slice(0, keysOrdenadas.length - 200);
      aBorrar.forEach(function(k) { db.ref('errores_app/' + k).remove(); delete data[k]; });
      keys = Object.keys(data);
    }
    if (badge) { badge.textContent = keys.length; badge.style.display = keys.length > 0 ? 'inline' : 'none'; }
    // Más recientes primero
    keys.sort().reverse();
    lista.innerHTML = '';
    keys.slice(0, 100).forEach(function(key) {
      var er = data[key];
      var fechaStr = er.ts ? new Date(er.ts).toLocaleString('es-ES',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}) : '';
      var item = document.createElement('div');
      item.style.cssText = 'background:#fdf4ff;border:1px solid #e9d5ff;border-radius:10px;padding:12px;margin-bottom:10px';
      item.innerHTML =
        '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:4px">' +
          '<strong style="font-size:14px;color:#7c3aed;word-break:break-word">🐛 ' + (er.contexto||'(sin contexto)') + '</strong>' +
          '<span style="font-size:12px;color:#9ca3af;flex-shrink:0;white-space:nowrap">' + fechaStr + '</span>' +
        '</div>' +
        '<div style="font-size:14px;color:#374151;margin-bottom:6px;word-break:break-word">' + (er.mensaje||'') + '</div>' +
        '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">' +
          '<span style="font-size:11px;background:#f3f4f6;color:#374151;border-radius:8px;padding:2px 8px">v' + (er.version||'?') + '</span>' +
          (er.idioma ? '<span style="font-size:11px;background:#f3f4f6;color:#374151;border-radius:8px;padding:2px 8px">' + er.idioma + '</span>' : '') +
        '</div>' +
        '<button class="error-mod-eliminar" data-key="' + key + '" style="background:none;border:1px solid #fca5a5;color:#dc2626;border-radius:8px;padding:5px 10px;font-size:12px;cursor:pointer">🗑 Descartar</button>';
      lista.appendChild(item);
    });
    lista.onclick = function(e) {
      var btn = e.target.closest('.error-mod-eliminar');
      if (!btn) return;
      var k = btn.getAttribute('data-key');
      var row = btn.closest('div[style]');
      db.ref('errores_app/' + k).remove().then(function(){
        if (row && row.parentNode) row.parentNode.removeChild(row);
        var n = lista.querySelectorAll('div[style]').length;
        if (!n) lista.innerHTML = '<p style="color:#6b7280;font-size:15px;text-align:center">Sin errores registrados ✓</p>';
        if (badge) { badge.textContent = parseInt(badge.textContent||1)-1; if(parseInt(badge.textContent)<=0) badge.style.display='none'; }
      });
    };
  });
}

function cargarPOIsPendientes() {
  var lista = document.getElementById('admin-pois-lista');
  lista.innerHTML = '<p style="color:#6b7280;font-size:15px">Cargando...</p>';

  db.ref('poi_usuarios').orderByChild('estado').equalTo('pendiente').once('value', function(snap) {
    var data = snap.val();
    var badge = document.getElementById('badge-pois-pendientes');

    if (!data || Object.keys(data).length === 0) {
      lista.innerHTML = '<p style="color:#6b7280;font-size:15px;text-align:center">No hay puntos pendientes ✓</p>';
      if (badge) badge.style.display = 'none';
      return;
    }

    var keys = Object.keys(data);
    if (badge) { badge.textContent = keys.length; badge.style.display = 'inline'; }

    lista.innerHTML = '';
    keys.forEach(function(key) {
      var p = data[key];
      var item = document.createElement('div');
      item.style.cssText = 'background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:12px;margin-bottom:12px';

      var catLabel = {
        'naturaleza':'🌿 Naturaleza','monumento':'🏛️ Monumento',
        'edificación religiosa':'⛪ Religioso','mirador':'🔭 Mirador',
        'albergue':'🏠 Albergue','localización histórica':'📜 Histórico',
        'vestigio arqueológico':'🔍 Arqueológico'
      }[p.categoria] || p.categoria;

      var fecha = p.ts ? new Date(p.ts).toLocaleDateString('es-ES') : '';

      item.innerHTML =
        '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:6px">' +
          '<strong style="font-size:16px;color:#1a1a1a">👤 ' + esc(p.nombre) + '</strong>' +
          '<span style="font-size:13px;color:#6b7280;flex-shrink:0">' + fecha + '</span>' +
        '</div>' +
        '<div style="font-size:14px;color:#6b7280;margin-bottom:4px">' + catLabel + '</div>' +
        (p.descripcion ? '<div style="font-size:15px;color:#374151;margin-bottom:6px;line-height:1.4">' + esc(p.descripcion) + '</div>' : '') +
        '<div style="font-size:13px;color:#9ca3af;margin-bottom:10px">📌 ' + (p.lat||'').toFixed(5) + ', ' + (p.lng||'').toFixed(5) + '</div>' +
        '<div style="display:flex;gap:8px">' +
          '<button class="poi-mod-aprobar" data-key="' + key + '" style="flex:1;background:#1D9E75;color:#fff;border:none;border-radius:8px;padding:9px;font-size:15px;font-weight:600;cursor:pointer">✓ Aprobar</button>' +
          '<button class="poi-mod-rechazar" data-key="' + key + '" style="flex:1;background:#ef4444;color:#fff;border:none;border-radius:8px;padding:9px;font-size:15px;font-weight:600;cursor:pointer">✗ Rechazar</button>' +
        '</div>';

      lista.appendChild(item);
    });

    lista.onclick = function(e) {
      var btn = e.target.closest('.poi-mod-aprobar,.poi-mod-rechazar');
      if (!btn) return;
      var k = btn.getAttribute('data-key');
      var row = btn.closest('div[style]');
      if (btn.classList.contains('poi-mod-aprobar')) {
        aprobarPOIUsuario(k, row);
      } else {
        rechazarPOIUsuario(k, row);
      }
    };
  });
}

function aprobarPOIUsuario(key, el) {
  db.ref('poi_usuarios/' + key + '/estado').set('aprobado').then(function() {
    if (el && el.parentNode) el.parentNode.removeChild(el);
    // Actualizar badge
    var lista = document.getElementById('admin-pois-lista');
    var badge = document.getElementById('badge-pois-pendientes');
    if (badge) {
      var n = parseInt(badge.textContent||'0') - 1;
      if (n <= 0) { badge.style.display = 'none'; }
      else { badge.textContent = n; }
    }
    if (!lista.querySelector('div[style]')) {
      lista.innerHTML = '<p style="color:#6b7280;font-size:15px;text-align:center">No hay puntos pendientes ✓</p>';
    }
  });
}

function rechazarPOIUsuario(key, el) {
  db.ref('poi_usuarios/' + key).remove().then(function() {
    if (el && el.parentNode) el.parentNode.removeChild(el);
    var badge = document.getElementById('badge-pois-pendientes');
    if (badge) {
      var n = parseInt(badge.textContent||'0') - 1;
      if (n <= 0) { badge.style.display = 'none'; }
      else { badge.textContent = n; }
    }
    var lista = document.getElementById('admin-pois-lista');
    if (!lista.querySelector('div[style]')) {
      lista.innerHTML = '<p style="color:#6b7280;font-size:15px;text-align:center">No hay puntos pendientes ✓</p>';
    }
  });
}

// (Badges de moderación ahora se cargan dentro de _mostrarPanelAdmin)

// ────────────────────────────────────────────────────────────────────────────

var mapa, circuloRadio, searchMarkers = [];
var userLat = null, userLng = null;
var categoriaActiva = 'todos';
var radioKm = 1;
var valoraciones = {}, opiniones = {};
PUNTOS.forEach(function(p) {
  valoraciones[p.id] = { total:0, votos:0, miVoto:0 };
  opiniones[p.id] = [];
});
var rutaPuntos = [];

// MENU MOVIL
function toggleMenu() {
  document.getElementById('hamburger').classList.toggle('open');
  document.getElementById('nav-mobile').classList.toggle('open');
}
function cerrarMenu() {
  document.getElementById('hamburger').classList.remove('open');
  document.getElementById('nav-mobile').classList.remove('open');
}

// MAPA
var _userHeading = null;

function crearIconoUsuario(heading) {
  var rot = (heading !== null && heading !== undefined) ? heading : 0;
  var hasHeading = (heading !== null && heading !== undefined);
  return L.divIcon({
    className: '',
    html: hasHeading
      ? '<div style="width:36px;height:36px;display:flex;align-items:center;justify-content:center;transform:rotate('+rot+'deg);transition:transform 0.3s ease">' +
        '<svg width="36" height="36" viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg">' +
        '<circle cx="18" cy="18" r="17" fill="rgba(24,95,165,0.2)" stroke="rgba(24,95,165,0.4)" stroke-width="1"/>' +
        '<polygon points="18,4 24,28 18,23 12,28" fill="#185FA5" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/>' +
        '</svg></div>'
      : '<div style="width:18px;height:18px;background:#185FA5;border-radius:50%;border:3px solid #fff;box-shadow:0 0 0 5px rgba(24,95,165,0.25)"></div>',
    iconSize: hasHeading ? [36,36] : [18,18],
    iconAnchor: hasHeading ? [18,18] : [9,9]
  });
}

var iconoUsuario = crearIconoUsuario(null);

// ── MODO SIMULACIÓN ───────────────────────────────────────────────
// Coloca una posición ficticia (marcador rojo arrastrable) que sustituye al
// punto azul del GPS. Con userLat/userLng apuntando ahí, TODA la app funciona
// (distancias, ruta, navegación, asistente). El GPS real queda suspendido vía
// window._simulacion (guards en los dos watchPosition). Pensado para planificar
// o demostrar el Camino sin estar físicamente sobre él.
var _simClickHandler = null;

function crearIconoSimulado(heading) {
  var rot = (heading !== null && heading !== undefined) ? heading : 0;
  var hasHeading = (heading !== null && heading !== undefined);
  return L.divIcon({
    className: '',
    html: hasHeading
      ? '<div style="width:36px;height:36px;display:flex;align-items:center;justify-content:center;transform:rotate('+rot+'deg);transition:transform 0.3s ease">' +
        '<svg width="36" height="36" viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg">' +
        '<circle cx="18" cy="18" r="17" fill="rgba(220,38,38,0.2)" stroke="rgba(220,38,38,0.4)" stroke-width="1"/>' +
        '<polygon points="18,4 24,28 18,23 12,28" fill="#DC2626" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/>' +
        '</svg></div>'
      : '<div style="width:18px;height:18px;background:#DC2626;border-radius:50%;border:3px solid #fff;box-shadow:0 0 0 5px rgba(220,38,38,0.3)"></div>',
    iconSize: hasHeading ? [36,36] : [18,18],
    iconAnchor: hasHeading ? [18,18] : [9,9]
  });
}

function _iniciarSimulacion() {
  if (typeof mapa === 'undefined' || !mapa) return;
  window._simulacion = true;
  // Quitar el marcador azul real si lo hubiera
  if (window._userMarker) { try { mapa.removeLayer(window._userMarker); } catch(e){} window._userMarker = null; }
  // Volar al Camino: encuadrar los POIs oficiales para que el usuario coloque
  // su posición sobre una ruta.
  try {
    var pts = [];
    (typeof PUNTOS !== 'undefined' ? PUNTOS : []).forEach(function(p){
      if (!p || p.lat == null || p.lng == null) return;
      if (p.categoria === 'busqueda' || p.categoria === 'volver' || p.esUsuario) return;
      if (typeof p.id === 'string' && (p.id.indexOf('_busq_') === 0 || p.id.indexOf('u_') === 0)) return;
      pts.push([p.lat, p.lng]);
    });
    if (pts.length) mapa.fitBounds(L.latLngBounds(pts), { padding:[40,40] });
  } catch(e){}
  var _t = (typeof T !== 'undefined' && T[idiomaActual]) ? T[idiomaActual] : (typeof T !== 'undefined' ? T.es : {});
  // Fase de espera: hasta colocar el punto rojo, los handlers de click de los
  // marcadores (que comprueban esta bandera, igual que _navBloqPopups) no
  // abren ningún popup, de modo que no se puede añadir un POI a la ruta.
  window._simEsperandoUbicacion = true;
  _simMostrarHint(_t.simHint || 'Toca el mapa para colocar tu posición simulada');
  _simClickHandler = function(ev) { _simColocar(ev.latlng.lat, ev.latlng.lng); };
  mapa.on('click', _simClickHandler);
}

function _simColocar(lat, lng, silencioso) {
  window._simulacion = true;
  // Ya hay ubicación: se vuelven a permitir los popups de los POI.
  window._simEsperandoUbicacion = false;
  if (_simClickHandler) { try { mapa.off('click', _simClickHandler); } catch(e){} _simClickHandler = null; }
  _simQuitarHint();
  if (window._userMarker) { try { mapa.removeLayer(window._userMarker); } catch(e){} window._userMarker = null; }
  userLat = lat; userLng = lng;
  if (window._simMarker) { try { mapa.removeLayer(window._simMarker); } catch(e){} window._simMarker = null; }
  var _t = (typeof T !== 'undefined' && T[idiomaActual]) ? T[idiomaActual] : (typeof T !== 'undefined' ? T.es : {});
  window._simMarker = L.marker([lat,lng], { icon: crearIconoSimulado(null), draggable:true, zIndexOffset:1100 })
    .addTo(mapa)
    .bindPopup('<strong>🧪 '+(_t.simBanner||'Simulación activa')+'</strong>');
  window._simMarker.on('drag', function(e){
    var ll = e.target.getLatLng();
    userLat = ll.lat; userLng = ll.lng;
    if (circuloRadio) { try{ mapa.removeLayer(circuloRadio); }catch(_){} circuloRadio = L.circle([userLat,userLng],{radius:radioKm*1000,color:'#DC2626',fillColor:'#DC2626',fillOpacity:0.07,weight:2,dashArray:'6 4'}).addTo(mapa); }
  });
  window._simMarker.on('dragend', function(){
    if (typeof calcularDistancias === 'function') calcularDistancias();
    if (typeof actualizarRuta === 'function') actualizarRuta();
    // Si el trazado de flechas está visible, lo redibujamos desde la nueva
    // posición del punto rojo (mismo trazado que el botón "ver ruta"). Solo en
    // dragend, no durante el arrastre, para no spamear OSRM.
    if (typeof _verRutaMapa !== 'undefined' && _verRutaMapa && typeof dibujarLineaEstática === 'function') dibujarLineaEstática();
  });
  radioKm = 1;
  if (typeof aplicarRadio === 'function') aplicarRadio(1);
  if (circuloRadio) { try { mapa.removeLayer(circuloRadio); } catch(_){} }
  circuloRadio = L.circle([lat,lng],{radius:radioKm*1000,color:'#DC2626',fillColor:'#DC2626',fillOpacity:0.07,weight:2,dashArray:'6 4'}).addTo(mapa);
  mapa.setView([lat,lng], 14, {animate:true});
  if (typeof calcularDistancias === 'function') calcularDistancias();
  _simMostrarBanner();
  if (!silencioso && typeof mostrarToast === 'function') mostrarToast('🧪 '+(_t.simListo||'Posición simulada colocada. Arrástrala para moverte.'));
}

function _salirSimulacion() {
  window._simulacion = false;
  window._simEsperandoUbicacion = false;
  if (_simClickHandler) { try { mapa.off('click', _simClickHandler); } catch(e){} _simClickHandler = null; }
  _simQuitarHint();
  _simQuitarBanner();
  if (window._simMarker) { try { mapa.removeLayer(window._simMarker); } catch(e){} window._simMarker = null; }
  if (circuloRadio) { try { mapa.removeLayer(circuloRadio); } catch(e){} circuloRadio = null; }
  // Al salir de la simulación, borrar de la ruta los POIs seleccionados
  // (vacía rutaPuntos, línea, flechas y resetea botones, sin tocar la ruta
  // guardada en memoria). Silencioso para no mostrar un toast extra.
  try { if (typeof _ejecutarLimpiarRutaSoloMapa === 'function') _ejecutarLimpiarRutaSoloMapa(true); } catch(e){}
  // Volver a la realidad: restaurar la última posición REAL conocida. Como los
  // guards impidieron que el GPS real tocara _lastKnownLat durante la sim, aquí
  // recuperamos la posición física previa (reactivando el geofence si procede).
  userLat = _lastKnownLat || null;
  userLng = _lastKnownLng || null;
  if (userLat && userLng && typeof mapa !== 'undefined' && mapa) {
    if (window._userMarker) { try{ mapa.removeLayer(window._userMarker); }catch(e){} window._userMarker = null; }
    var _t = (typeof T !== 'undefined' && T[idiomaActual]) ? T[idiomaActual] : (typeof T !== 'undefined' ? T.es : {});
    window._userMarker = L.marker([userLat,userLng],{icon:crearIconoUsuario(null),zIndexOffset:1000}).addTo(mapa).bindPopup('<strong>'+(_t.tuUbicacion||'Tu ubicación')+'</strong>');
    mapa.setView([userLat,userLng], 13, {animate:true});
    if (typeof calcularDistancias === 'function') calcularDistancias();
  }
}

function _simMostrarHint(txt) {
  _simQuitarHint();
  var h = document.createElement('div');
  h.id = 'sim-hint';
  h.textContent = txt;
  h.style.cssText = 'position:fixed;top:64px;left:50%;transform:translateX(-50%);z-index:1000001;background:rgba(0,0,0,0.82);color:#fff;font:600 13px/1.4 DM Sans,sans-serif;padding:9px 16px;border-radius:20px;box-shadow:0 4px 16px rgba(0,0,0,0.3);text-align:center;max-width:88vw;pointer-events:none';
  document.body.appendChild(h);
}
function _simQuitarHint(){ var h=document.getElementById('sim-hint'); if(h) h.remove(); }

function _simMostrarBanner() {
  _simQuitarBanner();
  var _t = (typeof T !== 'undefined' && T[idiomaActual]) ? T[idiomaActual] : (typeof T !== 'undefined' ? T.es : {});
  var b = document.createElement('div');
  b.id = 'sim-banner';
  b.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:1000001;background:#DC2626;color:#fff;font:600 13px/1.4 DM Sans,sans-serif;display:flex;align-items:center;justify-content:center;gap:14px;padding:7px 12px';
  var txt = document.createElement('span');
  txt.textContent = '🧪 ' + (_t.simBanner || 'Simulación activa');
  var btn = document.createElement('button');
  btn.textContent = _t.simSalir || 'Salir';
  btn.style.cssText = 'background:#fff;color:#DC2626;border:none;border-radius:14px;padding:4px 14px;font:700 13px DM Sans,sans-serif;cursor:pointer;-webkit-appearance:none';
  btn.addEventListener('click', _salirSimulacion);
  b.appendChild(txt); b.appendChild(btn);
  document.body.appendChild(b);
}
function _simQuitarBanner(){ var b=document.getElementById('sim-banner'); if(b) b.remove(); }

var _COLOR_MAP = {
  'verde':  '#1D9E75',
  'azul':   '#2563EB',
  'rojo':   '#DC2626',
  'naranja':'#EA580C',
  'morado': '#7C3AED',
  'ambar':  '#D97706',
  'coral':  '#F43F5E'
};
function crearIcono(emoji, color) {
  var bg = _COLOR_MAP[color] || '#1D9E75';
  return L.divIcon({
    className: '',
    html: '<div style="background:'+bg+';color:#fff;width:36px;height:36px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.2)"><span style="transform:rotate(45deg);font-size:16px">'+emoji+'</span></div>',
    iconSize:[36,36], iconAnchor:[18,36], popupAnchor:[0,-36]
  });
}

var iconoBusqueda = L.divIcon({
  className: '',
  html: '<div style="background:#DC2626;color:#fff;width:32px;height:32px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.25)"><span style="transform:rotate(45deg);font-size:16px">&#128269;</span></div>',
  iconSize:[32,32], iconAnchor:[16,32], popupAnchor:[0,-32]
});


// ── PUNTOS DE FIESTAS (solo visibles en su rango de fechas) ─────────────────
var FIESTAS_PUNTOS = [
  { id:'fiesta-san-blas-bembrive', nombre:'🎉 San Blas — Bembrive', categoria:'fiesta', emoji:'🍷', color:'ambar',
    descripcion:'Declarada Fiesta de Interés Turístico de Galicia, la romería de San Blas en Bembrive es la gran fiesta del invierno en Vigo. Arranca el 9 de enero y no para hasta el 3 de febrero — casi un mes en el que la pequeña parroquia vive hacia adentro, con sus furanchos: locales improvisados en bajos, garajes y salones de casas particulares donde el vino nuevo de la cosecha se sirve junto a zorza, orella, raxo, callos y el cocido gallego que Galicia ha convertido en liturgia. La «compostela furancheira» — tarjeta de sellos que premia a quien recorra todos los establecimientos con un cocido gratuito — es el guiño jacobeo perfecto en tierra de peregrinos. El 3 de febrero es el día grande: la banda Ría de Vigo abre la mañana con pasacalles desde la Praza do Mosteiro, la misa solemne reúne a toda la feligresía y la procesión honra a San Blas, el abogado de la garganta, venerado aquí desde el siglo XVII. Pero en Bembrive la devoción tiene más capas. La iglesia de Santiago de Bembrive — joya del románico templario vigués, con su ábside poligonal único en Galicia, sus canecillos iniciáticos y el silencio documental entre 1180 y finales del siglo XIV que coincide exactamente con la presencia templaria en la comarca — preside estos festejos desde su colina. Y San Blas mismo conecta con esa historia: los investigadores han señalado que este santo despertó un interés particular entre los Caballeros Templarios. En los inventarios de sus casas de la Provenza podría encontrarse su reliquia, y una posible vía de llegada de su culto a la Orden fue la Orden Militar de San Blas y La Santísima Virgen, fundada en Armenia en el siglo XII y coetánea al Temple. El peregrino que para en un furancho de Bembrive y levanta un vaso no sabe, probablemente, la densidad de lo que sostiene entre las manos.',
    lat:42.2003, lng:-8.7432, mesIni:1, diaIni:8, mesFin:2, diaFin:3 },

  { id:'fiesta-candelaria-castrelos', nombre:'🎉 Virgen de las Candelas y San Blas — Castrelos', categoria:'fiesta', emoji:'🕯️', color:'verde',
    descripcion:'Cada 2 de febrero, la parroquia de Castrelos detiene el tiempo para celebrar la Purificación de Nuestra Señora con la salida procesional de Santa María Candelaria. La imagen recorre las calles mientras la feligresía observa el cielo con atención: hay un dicho que no falla, «Cando a Candelaria rí, o inverno está por vir» — si la santa sonríe, el invierno todavía tiene lo suyo por delante. Al día siguiente, 3 de febrero, llega San Blas: salva de bombas al amanecer, misa mayor cantada por la Coral San Roque de Vigo, procesión solemne con el grupo de gaitas Lume de Cana y verbena que prolonga la fiesta cuanto el frío deja. Tres días de celebración — del 2 al 4 de febrero — en un barrio que guarda más historia de la que parece. La iglesia de Castrelos, dedicada a Santa María Candelaria, no lleva esa advocación por casualidad. La Regla Primitiva del Temple señalaba la fiesta de la Purificación entre las festividades de obligada celebración para los caballeros. La bailía templaria de Coia gobernaba estas tierras desde el siglo XII, y las iglesias de su territorio reflejan fielmente el santoral que los caballeros tenían anotado. Castrelos celebra en dos días lo que aquellos hombres armados y devotos tenían escrito en su regla desde hace nueve siglos.',
    lat:42.2187, lng:-8.7356, mesIni:2, diaIni:1, mesFin:2, diaFin:4 },

  { id:'fiesta-reconquista-vigo', nombre:'🎉 Reconquista de Vigo', categoria:'fiesta', emoji:'⚔️', color:'coral',
    descripcion:'Vigo vuelve al siglo XIX. Reenactment del alzamiento popular del 28 de marzo de 1809 que expulsó al ejército de Napoleón — primera ciudad de Europa en lograrlo. Casco histórico ambientado, uniformes, batallas y mercado de época.',
    lat:42.2328, lng:-8.7218, mesIni:3, diaIni:26, mesFin:3, diaFin:29 },

  { id:'fiesta-ostra-arcade', nombre:'🎉 Festa da Ostra — Arcade', categoria:'fiesta', emoji:'🦪', color:'azul',
    descripcion:'Más de 25.000 personas y 100.000 ostras en el muelle de Arcade. Desde 1987, Fiesta de Interés Turístico de Galicia. La ostra de la desembocadura del Verdugo, al natural o cocinada, acompañada de Albariño. Pasacalles, música y ambiente marinero.',
    lat:42.3497, lng:-8.6312, mesIni:4, diaIni:2, mesFin:4, diaFin:6 },

  { id:'fiesta-lamprea-arbo', nombre:'🎉 Festa da Lamprea — Arbo', categoria:'fiesta', emoji:'🐟', color:'verde',
    descripcion:'El cuarto domingo de abril, Arbo celebra la lamprea del río Miño — un pez que existe desde hace 500 millones de años. Degustaciones, maridaje y cultura fluvial en uno de los municipios más bonitos de la Paradanta.',
    lat:42.1167, lng:-8.3167, mesIni:4, diaIni:25, mesFin:4, diaFin:28 },

  { id:'fiesta-choco-redondela', nombre:'🎉 Jornadas del Choco — Redondela', categoria:'fiesta', emoji:'🦑', color:'ambar',
    descripcion:'El choco de la ensenada de San Simón es el alma de Redondela — sus vecinos son los "choqueiros". Desde 1987, la primera quincena de mayo la villa se viste de fiesta gastronómica con concurso de recetas, carpa popular y verbena.',
    lat:42.2826, lng:-8.6090, mesIni:5, diaIni:8, mesFin:5, diaFin:12 },

  { id:'fiesta-langosta-aguarda', nombre:'🎉 Festa da Langosta — A Guarda', categoria:'fiesta', emoji:'🦞', color:'coral',
    descripcion:'Fiesta de Galicia de Interés Turístico desde 1991. Carpa de 1.000 m² en el puerto de A Guarda con langosta y cocina marinera. Rosca de yema guardesa, vinos Albariño y O Rosal, música y animación. El arranque del Camino Portugués de la Costa tiene mejor sabor estos días.',
    lat:41.9015, lng:-8.8732, mesIni:7, diaIni:2, mesFin:7, diaFin:6 },

  { id:'fiesta-santiago-compostela', nombre:'🎉 Día de Santiago', categoria:'fiesta', emoji:'✨', color:'ambar',
    descripcion:'El 25 de julio es el Día del Apóstol y Día Nacional de Galicia. La Catedral celebra la misa del peregrino con el botafumeiro, procesión, fuegos artificiales y ambiente único. La meta del Camino en su día más sagrado.',
    lat:42.8805, lng:-8.5446, mesIni:7, diaIni:24, mesFin:7, diaFin:25 },

  { id:'fiesta-albarino-cambados', nombre:'🎉 Festa do Albariño — Cambados', categoria:'fiesta', emoji:'🍷', color:'morado',
    descripcion:'La fiesta de vino más antigua de Galicia, desde 1953. Una semana de Albariño, 150.000 personas, la proclamación del Capítulo Serenísimo y degustaciones en la Plaza de Fefiñáns. A 35 km del Camino, merece el desvío.',
    lat:42.5156, lng:-8.8156, mesIni:7, diaIni:27, mesFin:8, diaFin:3 },

  { id:'fiesta-pemento-padron', nombre:'🎉 Festa do Pimiento de Herbón', categoria:'fiesta', emoji:'🫑', color:'verde',
    descripcion:'Fiesta de Interés Turístico. El primer sábado de agosto, Herbón celebra el pimiento que lleva su nombre. Pasacalles, misa campestre, procesión agrícola motorizada y degustación gratuita. "Os pementos de Padrón, uns pican e outros non."',
    lat:42.7333, lng:-8.6500, mesIni:8, diaIni:2, mesFin:8, diaFin:5 },

  { id:'fiesta-mexilon-chapela', nombre:'🎉 Festa do Mexilón — Chapela', categoria:'fiesta', emoji:'🦪', color:'azul',
    descripcion:'Fiesta gastronómica del mejillón en el Paseo Marítimo de Chapela. El mejor mejillón de las rías al vapor, en vinagreta y en empanada. Segunda semana de agosto, ambiente marinero junto a la ría de Vigo.',
    lat:42.2965, lng:-8.6547, mesIni:8, diaIni:10, mesFin:8, diaFin:14 },

  { id:'fiesta-san-roque-vigo', nombre:'🎉 San Roque — Vigo', categoria:'fiesta', emoji:'🕍', color:'verde',
    descripcion:'La romería urbana más grande de Galicia. San Roque llegó a Vigo en 1598 durante una epidemia y desde entonces es el patrón de la ciudad. El 16 de agosto el Casco Vello se llena de gente, música y devoción.',
    lat:42.2362, lng:-8.7204, mesIni:8, diaIni:15, mesFin:8, diaFin:17 },

  { id:'fiesta-peregrina-pontevedra', nombre:'🎉 Festas da Peregrina — Pontevedra', categoria:'fiesta', emoji:'🐚', color:'verde',
    descripcion:'Las fiestas más importantes de Pontevedra, dedicadas a la Virgen Peregrina, patrona del Camino Portugués. Segunda semana de agosto con conciertos, actos religiosos y ambiente festivo.',
    lat:42.4306, lng:-8.6435, mesIni:8, diaIni:12, mesFin:8, diaFin:17 },

  { id:'fiesta-anguia-valga', nombre:'🎉 Festa da Anguía — Valga', categoria:'fiesta', emoji:'🐍', color:'ambar',
    descripcion:'Fiesta gastronómica de la anguila y Muestra de Caña del País (aguardiente gallego) en Valga, entre Padrón y Caldas de Reis. Del 24 al 26 de agosto, orillas del río Ulla.',
    lat:42.7167, lng:-8.6333, mesIni:8, diaIni:23, mesFin:8, diaFin:26 },

  { id:'fiesta-feira-franca', nombre:'🎉 Feira Franca Medieval — Pontevedra', categoria:'fiesta', emoji:'🏰', color:'morado',
    descripcion:'El primer fin de semana de septiembre, Pontevedra vuelve a la Edad Media. Disfraces, reenactments históricos, mercado medieval, artesanía y gastronomía de época. Una de las ferias medievales más espectaculares de Galicia.',
    lat:42.4306, lng:-8.6435, mesIni:9, diaIni:3, mesFin:9, diaFin:6 },
];

// Comprobar si una fiesta es visible hoy (incluyendo día previo)
function fiestaActivaHoy(f) {
  var ahora = new Date();
  var mes = ahora.getMonth() + 1; // 1-12
  var dia  = ahora.getDate();
  // Convertir todo a número de día del año para comparación simple
  function toDayNum(m, d) { return m * 100 + d; }
  var hoy  = toDayNum(mes, dia);
  var ini  = toDayNum(f.mesIni, f.diaIni);
  var fin  = toDayNum(f.mesFin, f.diaFin);
  return hoy >= ini && hoy <= fin;
}

function initMapa() {
  if (window._mapaInicializado) return;  // evita doble init (observer + fallback)
  window._mapaInicializado = true;
  var radioCtrl = document.getElementById('map-radio-control');
  if (radioCtrl) radioCtrl.style.display = 'flex';
  // Forzar radio 1km al iniciar
  radioKm = 1;
  _aplicarEstadoRadioBtns(1);
  setTimeout(cargarRutaGuardada, 1200); // cargar ruta guardada tras iniciar mapa
  setTimeout(_actualizarBtnRestauraRuta, 1400);
  mapa = L.map('map', { center:[42.2220,-8.7580], zoom:14, zoomControl:false, preferCanvas:true });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    crossOrigin: 'anonymous',
    maxZoom:19,
    keepBuffer:4,
    updateWhenIdle:false,
    updateWhenZooming:false
  }).addTo(mapa);

  window._cluster = L.markerClusterGroup({
    maxClusterRadius: 60,
    chunkedLoading: true,
    chunkedInterval: 50,
    disableClusteringAtZoom: 17,
    spiderfyOnMaxZoom: true,
    showCoverageOnHover: false,
    iconCreateFunction: function(c) {
      var n = c.getChildCount();
      var s = n < 10 ? 32 : n < 50 ? 38 : 44;
      return L.divIcon({
        className:'',
        html:'<div style="width:'+s+'px;height:'+s+'px;border-radius:50%;background:#1D9E75;color:#fff;font-family:DM Sans,sans-serif;font-size:'+(n<10?13:11)+'px;font-weight:700;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.3);border:2px solid #fff">'+n+'</div>',
        iconSize:[s,s], iconAnchor:[s/2,s/2]
      });
    }
  });
  mapa.addLayer(window._cluster);

  // Ocultar botón ➕ cuando se abre un popup, restaurar al cerrar
  var _popupAbierto = false;

  var _mapBtns = ['btn-add-poi-map','btn-poi-drawer-mapa','btn-alertas-toggle','btn-brujula-mapa','btn-sos-mapa','btn-buscar-mapa','btn-ruta-oficial','btn-descargar-mapa','btn-simular-mapa','map-ruta-panel','map-radio-control'];
  // Red de seguridad: si por cualquier vía se abriera un popup durante la fase
  // de simulación en la que aún no se ha colocado el punto rojo, lo cerramos.
  mapa.on('popupopen', function(e) {
    if (window._simEsperandoUbicacion) { try { mapa.closePopup(e.popup); } catch(_) {} }
  });
  // Actualizar botón añadir/quitar en popups de resultados de búsqueda al abrirlos
  mapa.on('popupopen', function(e) {
    var container = e.popup.getElement();
    if (!container) return;
    var btn = container.querySelector('button[onclick*="_toggleBusquedaRuta"]');
    if (!btn) return;
    var onc = btn.getAttribute('onclick') || '';
    var m = onc.match(/_toggleBusquedaRuta\(this,([^,]+),([^,]+),([^)]+)\)/);
    if (!m) return;
    try {
      var lat = parseFloat(m[2]);
      var lng = parseFloat(m[3]);
      var tmpId = '_busq_' + lat.toString().replace('.','') + '_' + lng.toString().replace('.','');
      var enR = rutaPuntos.some(function(p){ return p.id === tmpId; });
      if (enR) {
        btn.textContent = '✓ En ruta';
        btn.style.cssText = btn.style.cssText.replace(/background:[^;]+/, 'background:#1D9E75').replace(/color:[^;]+/, 'color:#fff').replace(/border:[^;]+/, 'border:none');
      } else {
        btn.textContent = '➕ Añadir a ruta';
        btn.style.cssText = btn.style.cssText.replace(/background:[^;]+/, 'background:#E1F5EE').replace(/color:[^;]+/, 'color:#0F6E56').replace(/border:[^;]+/, 'border:1px solid rgba(29,158,117,0.4)');
      }
    } catch(e2) {}
  });

  mapa.on('popupopen', function() {
    _popupAbierto = true;
    _mapBtns.forEach(function(id){
      var b=document.getElementById(id); if(b) b.style.display='none';
    });
    var bm=document.getElementById('btn-meteo-mapa'); if(bm) bm.style.display='none';
    var bc=document.getElementById('btn-asistente-mapa'); if(bc) bc.style.display='none';
  });
  mapa.on('popupclose', function() {
    _popupAbierto = false;
    var b;
    b=document.getElementById('btn-add-poi-map'); if(b&&!_navActiva) b.style.display='flex';
    b=document.getElementById('btn-alertas-toggle'); if(b) b.style.display='flex';
    b=document.getElementById('btn-brujula-mapa'); if(b&&!_navActiva) b.style.display='flex';
    b=document.getElementById('btn-sos-mapa'); if(b) b.style.display='flex';
    b=document.getElementById('btn-buscar-mapa'); if(b&&!_navActiva) b.style.display='flex';
    b=document.getElementById('btn-meteo-mapa'); if(b) b.style.display='flex';
    b=document.getElementById('btn-poi-drawer-mapa'); if(b) b.style.display='flex';
    b=document.getElementById('btn-ruta-oficial'); if(b) b.style.display='';
    b=document.getElementById('btn-descargar-mapa'); if(b) b.style.display='flex';
    b=document.getElementById('btn-simular-mapa'); if(b) b.style.display='flex';
    b=document.getElementById('btn-asistente-mapa'); if(b&&!_navActiva) b.style.display='flex';
    // Restaurar panel ruta siempre visible
    b=document.getElementById('map-ruta-panel'); if(b){b.style.display='flex';b.style.flexDirection='column';}
    b=document.getElementById('map-radio-control'); if(b){b.style.display='flex';}
  });
  // Cerrar popup al arrastrar o hacer scroll en el mapa
  mapa.on('dragstart', function() { mapa.closePopup(); });
  mapa.on('zoomstart', function() { mapa.closePopup(); });

  var _radioFitBoundsTs = 0;
  function _sincRadioBtns() {
    // Desactivado — estado gestionado exclusivamente por _aplicarEstadoRadioBtns
  }

  mapa.on('zoomend', function() {
    if (_rutaLinea && rutaPuntos.length >= 1) setTimeout(dibujarLineaEstática, 150);
    _sincRadioBtns();
  });
  // moveend eliminado — se re-activaba al fitBounds

  // En scroll: ocultar botón si hay popup visible en el DOM
  window.addEventListener('scroll', function() {
    if (mapa && document.querySelector('.leaflet-popup')) {
      mapa.closePopup();
    }
  }, { passive: true });

  // Añadir marcadores de fiestas si están activas hoy
  FIESTAS_PUNTOS.forEach(function(p) {
    if (!fiestaActivaHoy(p)) return;
    var iconFiesta = L.divIcon({
      className: '',
      html: '<div style="font-size:26px;line-height:1;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3));animation:donCatBody 1s ease-in-out infinite">' + p.emoji + '</div>',
      iconSize: [30, 30],
      iconAnchor: [15, 15]
    });
    var mf = L.marker([p.lat, p.lng], { icon: iconFiesta, zIndexOffset: 500 }).addTo(mapa);
    mf.on('click', function() {
      if (window._navBloqPopups || window._simEsperandoUbicacion) return;
      var content = '<div style="font-family:DM Sans,sans-serif;min-width:190px;max-width:260px">' +
        '<strong style="font-size:16px;color:#1D9E75">' + p.nombre + '</strong><br>' +
        '<small style="color:#6b7280;text-transform:uppercase;letter-spacing:1px">FIESTA HOY 🎉</small>' +
        '<div style="font-size:15px;margin-top:6px;color:#444;max-height:150px;overflow-y:auto">' + p.descripcion + '</div>' +

        '</div>';
      mapa.openPopup(L.popup({ className:'poi-popup', maxWidth:260 }).setLatLng([p.lat,p.lng]).setContent(content));
    });
  });

  // Creación de marcadores TROCEADA. Construir 774 marcadores de golpe
  // bloqueaba el hilo principal cientos de ms en gama baja. Los creamos en
  // lotes, cediendo el hilo entre cada uno, y los insertamos en el cluster
  // por tandas. chunkedLoading del cluster trocea su cálculo interno; esto
  // trocea además la construcción de los objetos L.marker.
  // IMPORTANTE: como los marcadores ya no existen todos de golpe, al terminar
  // marcamos _marcadoresListos y emitimos 'marcadores-listos'. Las funciones
  // que dependen de TODOS los marcadores (filtro por categoría, sincronización
  // de ruta) escuchan esa señal y se re-aplican; si no, albergues u otros POIs
  // de las últimas tandas se quedaban fuera del cluster.
  window._marcadoresListos = false;
  var _marcadoresCluster = [];
  (function _construirMarcadores() {
    var LOTE = 120;
    // SNAPSHOT ESTABLE del array. El troceado se reparte en varios frames y,
    // durante esa ventana, Firebase/alertas/GPS pueden reordenar (PUNTOS.sort)
    // o ampliar (PUNTOS.push) el array. Si iterábamos PUNTOS por índice vivo,
    // un sort a mitad hacía que 'idx' recayera sobre POIs ya procesados: se
    // creaban marcadores DUPLICADOS para unos (el cluster sumaba el doble y al
    // hacer zoom se apilaban exactos) y se saltaban otros. Iterando una copia
    // fija, cada POI recibe exactamente un marcador, pase lo que pase con PUNTOS.
    var _lista = PUNTOS.slice();
    var idx = 0;
    function _tanda() {
      var fin = Math.min(idx + LOTE, _lista.length);
      var nuevos = [];
      for (; idx < fin; idx++) {
        var p = _lista[idx];
        if (p.marker) continue; // ya tiene marcador: nunca duplicar
        var m = L.marker([p.lat,p.lng], { icon:crearIcono(p.emoji, p.categoria==='etapa' ? p.color : null) });
        m.on('click', (function(punto) {
          return function() {
            if (window._navBloqPopups || window._simEsperandoUbicacion) return;
            _abrirModalPOI(punto);
          };
        })(p));
        p.marker = m;
        _marcadoresCluster.push(m);
        nuevos.push(m);
      }
      // Insertar la tanda en el cluster en cuanto está lista (render progresivo).
      if (nuevos.length) window._cluster.addLayers(nuevos);
      if (idx < _lista.length) {
        (window.requestAnimationFrame || function(f){ setTimeout(f, 16); })(_tanda);
      } else {
        // Todos los marcadores creados e insertados.
        window._marcadoresListos = true;
        try { window.dispatchEvent(new CustomEvent('marcadores-listos')); } catch(_) {}
      }
    }
    _tanda();
  })();

  var statusEl = document.getElementById('map-status');
  statusEl.classList.add('visible');
  // En la landing de escritorio el mapa no es visible (oculto por CSS):
  // no tiene sentido pedir permiso de localización solo por visitar la web.
  if (window.matchMedia('(min-width:769px)').matches) {
    statusEl.classList.remove('visible');
  } else if (navigator.geolocation) {
    // ── Posición guardada: mostrar punto azul inmediatamente al arrancar ──
    // Si hay una posición guardada de sesiones anteriores, la usamos de
    // arranque para que el marcador aparezca al instante, incluso offline.
    // El GPS real la actualiza en cuanto puede (watchPosition más abajo).
    (function() {
      try {
        var saved = localStorage.getItem('_gps_last');
        if (saved) {
          var p = JSON.parse(saved);
          if (p && p.lat && p.lng) {
            userLat = p.lat; userLng = p.lng;
            _lastKnownLat = p.lat; _lastKnownLng = p.lng;
            if (window._userMarker) { try{ mapa.removeLayer(window._userMarker); }catch(e){} window._userMarker = null; }
            window._userMarker = L.marker([userLat,userLng],{icon:iconoUsuario,zIndexOffset:1000}).addTo(mapa).bindPopup('<strong>'+(T[idiomaActual]||T.es).tuUbicacion+'</strong>');
            mapa.setView([userLat, userLng], 15, {animate:false});
            statusEl.classList.remove('visible');
            calcularDistancias();
          }
        }
      } catch(e) {}
    })();

    // ── watchPosition único: fuente de verdad para la posición ──
    // maximumAge:5000 → posiciones frescas (≤5 s) para que el punto azul siga
    // al peregrino sin desfase. El GPS funciona sin conexión; localStorage
    // guarda la última posición para centrar el mapa en el próximo arranque.
    var _watchId = navigator.geolocation.watchPosition(function(pos) {
      if (window._simulacion) return; // en simulación, el GPS real no manda
      var lat = pos.coords.latitude, lng = pos.coords.longitude;
      var esNuevo = !userLat;
      userLat = lat; userLng = lng;
      _lastKnownLat = lat; _lastKnownLng = lng;
      // Persistir para el próximo arranque (clave del mecanismo offline)
      try { localStorage.setItem('_gps_last', JSON.stringify({lat:lat,lng:lng})); } catch(e) {}
      statusEl.classList.remove('visible');
      if (esNuevo) {
        // Primera posición real: actualizar título y crear/mover marcador
        var mt=document.getElementById('map-title');if(mt){mt.style.opacity='0';setTimeout(function(){mt.innerHTML=(T[idiomaActual]||T.es).mapTitle+" <svg width='22' height='30' viewBox='0 0 22 30' fill='none' xmlns='http://www.w3.org/2000/svg' style='animation:bounceDownArrow 1.4s ease-in-out infinite;flex-shrink:0;display:inline-block;vertical-align:middle;'><path d='M11 2 L11 22 M3 15 L11 24 L19 15' stroke='#dc2626' stroke-width='4' stroke-linecap='round' stroke-linejoin='round'/></svg>";mt.style.opacity='1';},300);}
        var ms=document.getElementById('map-subtitle');if(ms)ms.textContent=(T[idiomaActual]||T.es).mapSubtitle;
        if (window._userMarker) { try{ mapa.removeLayer(window._userMarker); }catch(e){} window._userMarker = null; }
        window._userMarker = L.marker([lat,lng],{icon:iconoUsuario,zIndexOffset:1000}).addTo(mapa).bindPopup('<strong>'+(T[idiomaActual]||T.es).tuUbicacion+'</strong>');
        radioKm = 1; aplicarRadio(1);
        calcularDistancias();
        cargarTiempo(lat, lng);
      } else {
        // Actualización continua: mover marcador y círculo sin cambiar vista
        if (window._albumCheckProximidad) window._albumCheckProximidad(lat, lng, pos.coords.accuracy);
        if (window._userMarker) {
          window._userMarker.setLatLng([lat, lng]);
          if (!window._orientacionActiva) window._userMarker.setIcon(crearIconoUsuario(null));
        }
        if (circuloRadio) mapa.removeLayer(circuloRadio);
        circuloRadio = L.circle([lat, lng], {
          radius: radioKm*1000, color:'#1D9E75', fillColor:'#1D9E75',
          fillOpacity:0.07, weight:2, dashArray:'6 4'
        }).addTo(mapa);
        calcularDistancias();
      }
    }, _gpsErrorHandler, { enableHighAccuracy:true, maximumAge:5000, timeout:30000 });

    // Escuchar orientación para rotar la flecha
    // Android — activar orientación directamente
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission !== 'function') {
      window.addEventListener('deviceorientation', actualizarFlecha, true);
    }

  } else {
    statusEl.innerHTML = (T[idiomaActual]||T.es).noGeolocal;
    setTimeout(function(){statusEl.classList.remove('visible');},3000);
  }

  // El mapa ya está creado e inicializado. Avisamos a los módulos que
  // dependen de él (p. ej. el trazado violeta de las rutas oficiales, que
  // vive en un script aparte). Antes esos módulos sondeaban la variable
  // global 'mapa' con setTimeout; al externalizar app.js con defer, su
  // DOMContentLoaded corría ANTES de que el mapa existiera y el trazado
  // podía no llegar a pintarse. Con este evento el dibujo es determinista.
  window._mapaListo = true;
  try { window.dispatchEvent(new CustomEvent('mapa-listo')); } catch(_) {}

  // Enganche directo y a prueba de timing: además del evento, pedimos
  // explícitamente al módulo del trazado oficial que se dibuje. Si su script
  // aún no se ha evaluado (orden de carga con defer), reintentamos unas pocas
  // veces. mostrarTodo() es idempotente, así que llamarlo de más no duplica.
  (function _pintarTrazadoOficial(intentos){
    intentos = intentos || 0;
    if (window.TrazadoRuta && typeof window.TrazadoRuta.mostrar === 'function') {
      try { window.TrazadoRuta.mostrar(); } catch(_) {}
    } else if (intentos < 40) {
      setTimeout(function(){ _pintarTrazadoOficial(intentos+1); }, 250);
    }
  })(0);
}


// Última posición GPS conocida
var _lastKnownLat = null, _lastKnownLng = null;

function _gpsErrorHandler() {
  if (typeof mapa === 'undefined' || !mapa) return;
  var lat = _lastKnownLat || (typeof userLat !== 'undefined' && userLat ? userLat : null);
  var lng = _lastKnownLng || (typeof userLng !== 'undefined' && userLng ? userLng : null);
  if (lat && lng) {
    mapa.setView([lat, lng], 15, {animate: true});
  }
}

function actualizarFlecha(e) {
  var h = null;
  if (typeof e.webkitCompassHeading === 'number' && e.webkitCompassHeading >= 0) {
    h = e.webkitCompassHeading;
  } else if (e.alpha !== null) {
    h = (360 - e.alpha + 360) % 360;
  }
  if (h === null) return;
  _userHeading = h;
  if (window._userMarker) {
    window._userMarker.setIcon(crearIconoUsuario(h));
  }
}

function toggleSeguimiento() {
  _modoSeguimiento = !_modoSeguimiento;
  var btn = document.getElementById('btn-seguimiento');
  var btnO = document.getElementById('btn-brujula-mapa');
  if (_modoSeguimiento) {
    // Poner ambos botones en verde
    btn.style.background = '#1D9E75';
    btn.style.border = '2px solid #1D9E75';
    btn.style.color = '#fff';
    if (btnO) { btnO.style.display='flex'; btnO.style.background='#1D9E75'; btnO.style.border='2px solid #1D9E75'; btnO.style.color='#fff'; }
    // Activar brújula
    pedirOrientacion();
    // Cerrar popup al activar seguimiento
    mapa.closePopup();
    // Zoom máximo y centrar en posición del usuario
    if (userLat) mapa.setView([userLat, userLng], 19, {animate:true});
    mostrarToast('📡 Seguimiento activado');
    actualizarLineaRuta();
    // watchPosition seguimiento
    if (!window._seguimientoId && navigator.geolocation) {
      window._seguimientoId = navigator.geolocation.watchPosition(function(pos) {
        if (window._simulacion) return; // en simulación, el GPS real no manda
        if (!_modoSeguimiento) return;
        userLat = pos.coords.latitude;
        userLng = pos.coords.longitude;
        _lastKnownLat = userLat; _lastKnownLng = userLng;
        if (window._userMarker) window._userMarker.setLatLng([userLat, userLng]);
        if (circuloRadio) { mapa.removeLayer(circuloRadio); circuloRadio = L.circle([userLat,userLng],{radius:radioKm*1000,color:'#1D9E75',fillColor:'#1D9E75',fillOpacity:0.07,weight:2,dashArray:'6 4'}).addTo(mapa); }
        mapa.panTo([userLat, userLng], {animate:true, duration:0.5});
        // Comprobar proximidad a POIs para álbum
        if (window._albumCheckProximidad) window._albumCheckProximidad(userLat, userLng, pos.coords.accuracy);
        // Actualizar línea máx cada 10s para no saturar OSRM
        var ahora = Date.now();
        if (!window._ultimaActLinea || ahora - window._ultimaActLinea > 10000) {
          window._ultimaActLinea = ahora;
          actualizarLineaRuta();
        }
      }, _gpsErrorHandler, {enableHighAccuracy:true, maximumAge:2000});
    }
  } else {
    // Desactivar — restaurar todo
    btn.style.background = '#fff';
    btn.style.border = '2px solid rgba(0,0,0,0.2)';
    btn.style.color = '';
    if (btnO) { btnO.style.background='#fff'; btnO.style.border='2px solid rgba(0,0,0,0.2)'; btnO.style.color=''; }

    // Detener watch
    if (window._seguimientoId) { navigator.geolocation.clearWatch(window._seguimientoId); window._seguimientoId = null; }
    window._orientacionActiva = false;
    window.removeEventListener('deviceorientation', actualizarFlecha, true);
    // Volver a punto azul
    if (window._userMarker) window._userMarker.setIcon(crearIconoUsuario(null));
    _modoSeguimiento = false;
    // Eliminar línea de ruta
    if (_rutaLinea) { mapa.removeLayer(_rutaLinea); _rutaLinea = null; }
    // Volver a radio 1km
    aplicarRadio(1);
    radioKm = 1;
    _aplicarEstadoRadioBtns(1);
    mostrarToast('📡 Seguimiento desactivado');
  }
}

var _cromoCola = [];
var _cromoMostrando = false;
function _cromoSiguiente() {
  if (_cromoCola.length === 0) { _cromoMostrando = false; return; }
  _cromoMostrando = true;
  var poi = _cromoCola.shift();
  _mostrarUnCromo(poi, function(){ setTimeout(_cromoSiguiente, 400); });
}
function mostrarToastCromo(poi, numCromo, tipoCromo, extras, doble) {
  if (!_cromosNotifOn) return;
  // Compatibilidad con llamadas antiguas
  if (typeof numCromo === 'undefined') { _cromoCola.push({poi:poi}); if (!_cromoMostrando) _cromoSiguiente(); return; }
  _cromoCola.push({poi:poi, num:numCromo, tipo:tipoCromo, extras:extras||[], doble:!!doble});
  if (!_cromoMostrando) _cromoSiguiente();
}
function _mostrarUnCromo(item, onClose) {
  var poi = item.poi || item; // compatibilidad
  var num = item.num;
  var tipo = item.tipo || 'normal';
  var extras = item.extras || [];
  var doble = item.doble;
  var existing = document.getElementById('cromo-celebracion');
  if (existing) existing.remove();
  var tablero = window._OCA_TABLERO || {};
  var casilla = tablero[num] || {emoji:'🐚', label:'Casilla '+num, tipo:'normal'};
  var nombre = (poi.nombre||'').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  var nombre = (poi.nombre||'').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  var poiEmoji = poi.emoji || '📍';

  // Modal de notificación — efectos especiales se resuelven al pulsar casilla en el Tablero
  var headerTxt = doble ? '🏨 ¡Doble por la Posada!' : 'Localización desbloqueada';
  var cromoInfo = num
    ? '<div style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:14px;padding:14px 16px;margin-bottom:14px;text-align:center">'      + '<div style="font-size:15px;color:rgba(255,255,255,0.55);margin-bottom:8px">Obtienes un cromo</div>'      + '<div style="font-size:15px;color:rgba(255,255,255,0.75);line-height:1.5">Ahora puedes añadir tu foto recuerdo en <strong style=\"color:#fff\">Mi Álbum</strong> y abrir el cromo en el <strong style=\"color:#fff\">Tablero</strong></div>'      + '</div>'    : '<div style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:14px;padding:14px 16px;margin-bottom:14px;text-align:center">'      + '<div style="font-size:15px;color:rgba(255,255,255,0.75);line-height:1.6">Localización registrada en tu <strong style=\"color:#6ee7b7\">Álbum</strong> · cromo disponible en tu <strong style=\"color:#F5C800\">Colección</strong></div>'      + '</div>';

  var botonesHtml = '<div id="cromo-btn-cerrar" style="background:#1D9E75;color:#fff;border:none;border-radius:24px;padding:12px 32px;font-size:15px;font-weight:600;cursor:pointer;display:inline-block;width:100%;box-sizing:border-box">¡Genial!</div>';

  // Vibración al desbloquear
  if (navigator.vibrate) navigator.vibrate([100,50,100,50,200]);
  var overlay = document.createElement('div');
  overlay.id = 'cromo-celebracion';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:99999;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;font-family:DM Sans,sans-serif;padding:1rem;box-sizing:border-box';
  var box = document.createElement('div');
  box.style.cssText = 'background:linear-gradient(160deg,#1a0e2e,#3b1f6a);border-radius:20px;padding:1.5rem;max-width:85vw;width:300px;text-align:center;border:1px solid rgba(255,255,255,0.2)';
  box.innerHTML =
    '<div style="font-size:13px;text-transform:uppercase;letter-spacing:2px;color:rgba(255,255,255,0.4);margin-bottom:10px">'+headerTxt+'</div>'
    +'<div style="font-size:16px;font-weight:700;color:#fff;margin-bottom:14px">'+poiEmoji+' '+nombre+'</div>'
    +cromoInfo+botonesHtml;
  overlay.appendChild(box);
  document.body.appendChild(overlay);

  function cerrar(){ var el=document.getElementById('cromo-celebracion'); if(el) el.remove(); if(onClose) onClose(); }

  var btnCerrar = box.querySelector('#cromo-btn-cerrar');
  if (btnCerrar) btnCerrar.addEventListener('click', cerrar);

  overlay.addEventListener('click', function(e){ if(e.target===overlay) cerrar(); });

}

// Selector de cromos para perder N
function _ocaMostrarSelectorPerder(n) {
  window._ocaGetCromos(function(cromos){
    if (cromos.length === 0) { mostrarToast('No tienes cromos que perder'); return; }
    var overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;font-family:DM Sans,sans-serif;padding:1rem;box-sizing:border-box';
    var tablero = window._OCA_TABLERO || {};
    // Contar cromos por número
    var conteo = {};
    var keysPorNum = {};
    cromos.forEach(function(item, idx){
      var num = item.num;
      conteo[num] = (conteo[num]||0)+1;
      if (!keysPorNum[num]) keysPorNum[num] = [];
      keysPorNum[num].push(idx);
    });
    var nums = Object.keys(conteo).map(Number).sort(function(a,b){return b-a;});
    var seleccionados = [];
    var html = '<div style="background:linear-gradient(160deg,#1a0e2e,#3b1f6a);border-radius:20px;padding:1.25rem;max-width:90vw;width:320px;border:1px solid rgba(255,255,255,0.2)">'
      + '<div style="font-size:14px;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:1.5px;margin-bottom:10px">Elige '+n+' cromo'+(n>1?'s':'')+' para perder</div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;max-height:50vh;overflow-y:auto;margin-bottom:12px" id="sel-cromos-grid">';
    nums.forEach(function(num){
      var cas = tablero[num]||{emoji:'🐚',label:'Casilla '+num};
      var rep = conteo[num]>1 ? '<span style="font-size:9px;background:#1D9E75;color:#fff;border-radius:10px;padding:1px 5px;margin-left:4px">×'+conteo[num]+'</span>' : '';
      html += '<div class="sel-cromo-item" data-num="'+num+'" style="display:flex;align-items:center;gap:6px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:10px;padding:7px 10px;cursor:pointer;transition:all 0.15s">'
        + '<span style="font-size:20px">'+cas.emoji+'</span>'
        + '<div style="flex:1"><div style="font-size:12px;color:rgba(255,255,255,0.4)">#'+num+'</div>'
        + '<div style="font-size:13px;font-weight:600;color:#fff">'+cas.label+'</div></div>'
        + rep+'</div>';
    });
    html += '</div><button id="sel-confirmar" disabled style="width:100%;background:#6b7280;color:#fff;border:none;border-radius:24px;padding:10px;font-size:16px;font-weight:600;cursor:pointer;font-family:DM Sans,sans-serif">Confirmar</button></div>';
    overlay.innerHTML = html;
    document.body.appendChild(overlay);
    var confirmBtn = overlay.querySelector('#sel-confirmar');
    overlay.querySelectorAll('.sel-cromo-item').forEach(function(item){
      item.addEventListener('click', function(){
        var num = parseInt(this.getAttribute('data-num'));
        var idx = seleccionados.indexOf(num);
        if (idx >= 0){
          seleccionados.splice(idx,1);
          this.style.background='rgba(255,255,255,0.06)';
          this.style.border='1px solid rgba(255,255,255,0.12)';
        } else if (seleccionados.length < n){
          seleccionados.push(num);
          this.style.background='rgba(220,38,38,0.3)';
          this.style.border='1.5px solid rgba(252,165,165,0.7)';
        }
        confirmBtn.disabled = seleccionados.length < Math.min(n, nums.length);
        confirmBtn.style.background = confirmBtn.disabled ? '#6b7280' : '#dc2626';
      });
    });
    confirmBtn.addEventListener('click', function(){
      var pendiente = seleccionados.slice();
      function _eliminarSiguiente(){
        if (pendiente.length === 0){ overlay.remove(); mostrarToast('🗑️ '+n+' cromo'+(n>1?'s':'')+' perdido'+(n>1?'s':'')); return; }
        var numDel = pendiente.shift();
        // Eliminar una instancia de ese número
        _abrirDB(function(db){
          var tx = db.transaction('cromos','readwrite');
          var store = tx.objectStore('cromos');
          var allK = store.getAllKeys();
          allK.onsuccess = function(){
            var keys = allK.result;
            var allV = store.getAll();
            allV.onsuccess = function(){
              var vals = allV.result;
              for(var k=0;k<vals.length;k++){
                if(vals[k].num===numDel){ store.delete(keys[k]); break; }
              }
              tx.oncomplete = function(){ _eliminarSiguiente(); };
            };
          };
        });
      }
      _eliminarSiguiente();
    });
  });
}

function mostrarToast(msg) {
  if (!document.getElementById('_casc-pulse-style-global')) {
    var st = document.createElement('style');
    st.id = '_casc-pulse-style-global';
    st.textContent = '@keyframes _casc-pulse{0%,100%{transform:scale(1) rotate(-3deg)}50%{transform:scale(1.08) rotate(3deg)}}';
    document.head.appendChild(st);
  }
  var t = document.getElementById('map-toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'map-toast';
    t.style.cssText = 'position:fixed;bottom:72px;left:50%;transform:translateX(-50%);z-index:99999;pointer-events:none;display:flex;align-items:center;gap:10px;padding:9px 16px 9px 10px;border-radius:24px;font-family:DM Sans,sans-serif;font-size:14px;font-weight:500;white-space:nowrap;transition:opacity 0.35s;max-width:88vw;box-sizing:border-box;background:rgba(0,0,0,0.88);color:#fff;box-shadow:0 4px 18px rgba(0,0,0,0.35)';
    var cascoEl = document.createElement('span');
    cascoEl.style.cssText = 'display:none';
    cascoEl.id = 'map-toast-casco';
    var txtEl = document.createElement('span');
    txtEl.id = 'map-toast-txt';
    txtEl.style.cssText = 'color:#fff;overflow:hidden;text-overflow:ellipsis';
    t.appendChild(cascoEl);
    t.appendChild(txtEl);
    document.body.appendChild(t);
  }
  var casco = document.getElementById('map-toast-casco');
  var txtSpan = document.getElementById('map-toast-txt');
  if (txtSpan) txtSpan.textContent = msg;
  if (casco) casco.style.animation = '_casc-pulse 2s ease-in-out infinite';
  t.style.opacity = '1';
  clearTimeout(t._timer);
  t._timer = setTimeout(function(){
    t.style.opacity = '0';
    if (casco) casco.style.animation = 'none';
  }, 2400);
}

function desactivarSeguimientoYBrujula() {
  if (_modoSeguimiento) {
    _modoSeguimiento = false;
    var btnS = document.getElementById('btn-seguimiento');
    if (btnS) { btnS.style.background='#fff'; btnS.style.border='2px solid rgba(0,0,0,0.2)'; }
    if (window._seguimientoId) { navigator.geolocation.clearWatch(window._seguimientoId); window._seguimientoId = null; }

  }
  if (window._orientacionActiva) {
    window._orientacionActiva = false;
    window.removeEventListener('deviceorientation', actualizarFlecha, true);
    var btnO = document.getElementById('btn-brujula-mapa');
    if (btnO) { btnO.style.background='#fff'; btnO.style.border='2px solid rgba(0,0,0,0.2)'; btnO.style.color=''; }
  }
}


function pedirOrientacion() {
  var btn = document.getElementById('btn-brujula-mapa');

  // Si ya está activa y seguimiento NO está activo → desactivar
  if (window._orientacionActiva && !_modoSeguimiento) {
    window._orientacionActiva = false;
    window.removeEventListener('deviceorientation', actualizarFlecha, true);
    if (btn) { btn.style.background='#fff'; btn.style.border='2px solid rgba(0,0,0,0.2)'; btn.style.color=''; }
    if (window._userMarker) window._userMarker.setIcon(crearIconoUsuario(null));
    mostrarToast('🧭 Brújula desactivada');
    var nb = document.getElementById('ruta-nav-orientacion');
    if(nb){ nb.style.background='#fff'; nb.style.border='2px solid rgba(0,0,0,0.15)'; nb.style.color='#333';
      var ol = nb.querySelector('#nav-ori-offline'); if(ol) ol.style.display='inline';
      var lbl = nb.querySelector('#nav-ori-label'); if(lbl) lbl.textContent='Orientación'; }
    return;
  }

  // Si ya está activa y seguimiento SÍ está activo → ignorar
  if (window._orientacionActiva) return;

  // Activar brújula
  function activar() {
    window._orientacionActiva = true;
    window.removeEventListener('deviceorientation', actualizarFlecha, true);
    window.addEventListener('deviceorientation', actualizarFlecha, true);
    if (btn) { btn.style.background='#1D9E75'; btn.style.border='2px solid #1D9E75'; btn.style.color='#fff'; }
    mostrarToast('🧭 Brújula activada');
    var nb = document.getElementById('ruta-nav-orientacion');
    if(nb){ nb.style.background='#EFF6FF'; nb.style.border='2px solid #185FA5'; nb.style.color='#185FA5';
      var ol = nb.querySelector('#nav-ori-offline'); if(ol) ol.style.display='none';
      var lbl = nb.querySelector('#nav-ori-label'); if(lbl) lbl.textContent='Activada'; }
  }

  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    DeviceOrientationEvent.requestPermission().then(function(s) {
      if (s === 'granted') { window._orientacionConcedida = true; activar(); }
    }).catch(function(){});
  } else if (window.DeviceOrientationEvent) {
    activar();
  }
}

function activarFlechaOrientacion() {
  DeviceOrientationEvent.requestPermission().then(function(s) {
    if (s === 'granted') {
      window.addEventListener('deviceorientation', actualizarFlecha, true);
      var btn = document.getElementById('btn-flecha-orientacion');
      if (btn) { btn.style.background = '#1D9E75'; btn.innerHTML = '▲'; btn.style.color = '#fff'; btn.style.fontSize = '14px'; }
    }
  }).catch(function(){});
}

function aplicarRadio(km) {
  if (circuloRadio) mapa.removeLayer(circuloRadio);
  circuloRadio = L.circle([userLat,userLng], {
    radius:km*1000, color:'#1D9E75', fillColor:'#1D9E75',
    fillOpacity:0.07, weight:2, dashArray:'6 4'
  }).addTo(mapa);
  _radioFitBoundsTs = Date.now();
  mapa.fitBounds(circuloRadio.getBounds(), {padding:[20,20]});
}

function _aplicarEstadoRadioBtns(km) {
  var cont = document.getElementById('map-radio-control');
  if (!cont) return;
  cont.querySelectorAll('.map-radio-btn').forEach(function(b) {
    var activo = parseInt(b.getAttribute('data-km')) === km;
    b.style.transition  = 'none';
    b.classList.toggle('active', activo);
    b.style.background  = activo ? '#1a4a9e' : 'rgba(255,245,210,0.9)';
    b.style.color       = activo ? '#f5e6c8' : '#3d2000';
    b.style.borderColor = activo ? '#2a5aae' : '#a07828';
    b.style.boxShadow   = activo ? '0 4px 14px rgba(26,74,158,0.4),0 1px 3px rgba(0,0,0,0.18)' : '0 4px 12px rgba(0,0,0,0.2),0 1px 3px rgba(0,0,0,0.12)';
    // Forzar repaint antes de restaurar transition
    b.offsetHeight;
    b.style.transition  = '';
  });
}
var _cambiarRadioTs = 0;
function cambiarRadio(km, btn) {
  var now = Date.now();
  if (now - _cambiarRadioTs < 400) return;
  _cambiarRadioTs = now;
  desactivarSeguimientoYBrujula();
  radioKm = km;
  _aplicarEstadoRadioBtns(km);
  if (userLat) aplicarRadio(km);
  // Re-aplicar tras el fitBounds por si algo lo sobreescribió
  setTimeout(function() { _aplicarEstadoRadioBtns(km); }, 600);
}

// BUSCADOR NOMINATIM
function limpiarBusquedaMapa() {
  // Limpiar marcadores de búsqueda del strip
  searchMarkers.forEach(function(m){ try{ mapa.removeLayer(m); }catch(e){} });
  searchMarkers = [];
  // Limpiar marcadores del asistente
  if (window._wizSearchMarkers) { window._wizSearchMarkers.forEach(function(m){ try{ mapa.removeLayer(m); }catch(e){} }); window._wizSearchMarkers = []; }
  _actualizarBtnLimpiar();
  // Quitar puntos de búsqueda de la ruta y de PUNTOS
  rutaPuntos = rutaPuntos.filter(function(p){ return p.categoria !== 'busqueda'; });
  PUNTOS = PUNTOS.filter(function(p){ return p.categoria !== 'busqueda'; });
  // Borrar siempre la línea de ruta trazada desde búsqueda
  if (typeof _rutaLinea !== 'undefined' && _rutaLinea) { try { mapa.removeLayer(_rutaLinea); } catch(e){} _rutaLinea = null; }
  if (window._rutaFlechas) { window._rutaFlechas.forEach(function(m){ try{mapa.removeLayer(m);}catch(e){}; }); window._rutaFlechas = []; }
  if (typeof actualizarRuta === 'function') { try { actualizarRuta(); } catch(e){} }
  var input = document.getElementById('buscar-mapa-strip-input');
  if (input) input.value = '';
  // Actualizar posición sin zoom ni fitBounds
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(function(pos) {
      userLat = pos.coords.latitude; userLng = pos.coords.longitude;
      if (window._userMarker) { window._userMarker.setLatLng([userLat, userLng]); }
      PUNTOS.forEach(function(p){ p.distancia = haversine(userLat,userLng,p.lat,p.lng); });
    }, function(){}, { enableHighAccuracy:true, timeout:6000 });
  }
}

function limpiarBusqueda() {
  searchMarkers.forEach(function(m){ mapa.removeLayer(m); });
  searchMarkers = [];
  var input = document.getElementById('buscar-input');
  if (input) input.value = '';
  var clearBtn = document.getElementById('buscar-clear');
  if (clearBtn) clearBtn.style.display = 'none';
  aplicarRadio(radioKm);
}

function ejecutarBusqueda() {
  var q = document.getElementById('buscar-input').value.trim();
  if (!q) return;
  var btn = document.getElementById('buscar-btn');
  btn.textContent=(T[idiomaActual]||T.es).buscando;
  btn.disabled = true;
  searchMarkers.forEach(function(m){mapa.removeLayer(m);}); searchMarkers=[];
  // Búsqueda global sin restricción geográfica
  var url = 'https://nominatim.openstreetmap.org/search?format=json&limit=10&q=' +
    encodeURIComponent(q) + '&accept-language=es';
  var xhr = new XMLHttpRequest();
  xhr.open('GET',url,true);
  xhr.onreadystatechange = function() {
    if (xhr.readyState!==4) return;
    btn.innerHTML=(T[idiomaActual]||T.es).buscarBtn;
    btn.disabled = false;
    if (xhr.status===200) {
      try {
        var res = JSON.parse(xhr.responseText);
        if (res && res.length>0) {
          if (userLat) res.sort(function(a,b){
            return haversine(userLat,userLng,parseFloat(a.lat),parseFloat(a.lon)) -
                   haversine(userLat,userLng,parseFloat(b.lat),parseFloat(b.lon));
          });
          var bounds=[];
          res.forEach(function(r){
            var lat=parseFloat(r.lat), lng=parseFloat(r.lon);
            var nombre=r.display_name.split(',')[0].trim();
            var dist=userLat?' - '+formatDist(haversine(userLat,userLng,lat,lng)):'';
            var sm=L.marker([lat,lng],{icon:iconoBusqueda}).addTo(mapa);
            sm.bindPopup('<div style="font-family:DM Sans,sans-serif;min-width:160px"><strong>'+nombre+dist+'</strong><br><div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap"><button onclick="_toggleBusquedaRuta(this,encodeURIComponent(\''+nombre+'\'),'+lat+','+lng+');" style="background:#E1F5EE;color:#0F6E56;border:1px solid rgba(29,158,117,0.4);padding:5px 12px;border-radius:12px;font-size:14px;font-weight:600;cursor:pointer;font-family:DM Sans,sans-serif">➕ Añadir a ruta</button><button onclick="irACoordenadasNav('+lat+','+lng+')" style="background:#1D9E75;color:#fff;border:none;padding:5px 12px;border-radius:12px;font-size:14px;cursor:pointer;font-family:DM Sans,sans-serif">&#128506; Cómo llegar</button></div></div>');
            searchMarkers.push(sm); bounds.push([lat,lng]);
          });
          if (searchMarkers.length>0) searchMarkers[0].openPopup();
          var clearBtn = document.getElementById('buscar-clear');
          if (clearBtn) clearBtn.style.display = 'flex';
          if (bounds.length>1){mapa.fitBounds(bounds,{padding:[40,40]});}
          else{mapa.setView(bounds[0],17);}
          document.activeElement && document.activeElement.blur(); setTimeout(function(){ var el=document.getElementById('map'); if(el){ var rect=el.getBoundingClientRect(); var center=window.pageYOffset+rect.top-(window.innerHeight/2)+(rect.height/2); window.scrollTo({top:Math.max(0,center),behavior:'smooth'}); } },600);
        } else {
          mostrarToast('🔍 Sin resultados para "'+q+'"');
        }
      } catch(e) { mostrarToast('⚠️ Error al buscar. Inténtalo de nuevo.'); }
    }
  };
  xhr.send();
}

// DISTANCIAS
function haversine(lat1,lng1,lat2,lng2) {
  var R=6371, dLat=(lat2-lat1)*Math.PI/180, dLng=(lng2-lng1)*Math.PI/180;
  var a=Math.sin(dLat/2)*Math.sin(dLat/2)+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)*Math.sin(dLng/2);
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}
function calcularDistancias() {
  if (!userLat) return;
  PUNTOS.forEach(function(p){p.distancia=haversine(userLat,userLng,p.lat,p.lng);});
  PUNTOS.sort(function(a,b){return a.distancia-b.distancia;});
  renderCarrusel(categoriaActiva);
}
function formatDist(km) { return km<1 ? Math.round(km*1000)+' m' : km.toFixed(1)+' km'; }

// CARRUSEL
function renderCarrusel(categoria) {
  categoriaActiva = categoria;
  var carousel = document.getElementById('carousel');
  // Solo POIs oficiales en el carrusel — los de usuario van solo en el mapa
  var filtrados;
  if (categoria === 'fiesta') {
    // Fiestas: mostrar todas del año, con indicador si está activa hoy
    filtrados = FIESTAS_PUNTOS.map(function(p) {
      var activa = fiestaActivaHoy(p);
      return Object.assign({}, p, {
        distancia: (userLat && userLng) ? haversine(userLat, userLng, p.lat, p.lng) : undefined,
        _activaHoy: activa
      });
    });
  } else if (categoria === 'usuario') {
    // POIs del usuario
    filtrados = PUNTOS_USUARIO.map(function(p){
      return Object.assign({}, p, { distancia: (userLat && userLng) ? haversine(userLat, userLng, p.lat, p.lng) : undefined });
    });
  } else if (categoria === 'etapa-costa') {
    filtrados = PUNTOS.filter(function(p){ return p.categoria==='etapa' && p.variante==='costa'; });
    filtrados.sort(function(a,b){ return (a.orden||0)-(b.orden||0); });
  } else if (categoria === 'etapa-interior') {
    filtrados = PUNTOS.filter(function(p){ return p.categoria==='etapa' && p.variante==='interior'; });
    filtrados.sort(function(a,b){ return (a.orden||0)-(b.orden||0); });
  } else {
    filtrados = PUNTOS.filter(function(p){
      if (categoria === 'alerta') {
        return p.categoria === 'alerta' || (p.esUsuario && p.categoria === 'alerta');
      }
      return !p.esUsuario && !(p.id && p.id.indexOf('u_')===0) && p.categoria!=='etapa' && (categoria==='todos'||p.categoria===categoria);
    });
  }
  // Ordenar: etapas por orden progresivo, resto por distancia
  if (categoria !== 'etapa-costa' && categoria !== 'etapa-interior') {
    filtrados = filtrados.slice().sort(function(a, b) {
      var da = a.distancia !== undefined ? a.distancia : 999999;
      var db = b.distancia !== undefined ? b.distancia : 999999;
      return da - db;
    });
  }
  if (!filtrados.length) {
    var msgs = {
      'alerta':   { es:'🚨 Sin alertas activas en este momento', gl:'🚨 Sen alertas activas neste momento', en:'🚨 No active alerts at this time' },
      'fiesta':   { es:'🎉 Sin fiestas activas hoy · consulta el calendario', gl:'🎉 Sen festas activas hoxe · consulta o calendario', en:'🎉 No active festivals today · check the calendar' }
    };
    var iconos = {
      'naturaleza':'🌿','monumento':'🏛️','edificación religiosa':'⛪','localización histórica':'📜',
      'vestigio arqueológico':'🔍','albergue':'🏠','mirador':'🔭','etapa-costa':'🌊','etapa-interior':'🥾','etapa-frances':'🔴','etapa-norte':'🟠','etapa-primitivo':'🟣','etapa-ingles':'🟡','etapa-frances':'🔴','etapa-norte':'🟠','etapa-primitivo':'🟣','etapa-ingles':'🟡'
    };
    var icono = iconos[categoria] || '🐚';
    var textoEs = (msgs[categoria] && msgs[categoria].es) || 'No hay puntos en esta categoría';
    var textoGl = (msgs[categoria] && msgs[categoria].gl) || textoEs;
    var textoEn = (msgs[categoria] && msgs[categoria].en) || textoEs;
    var texto = idiomaActual==='gl' ? textoGl : idiomaActual==='en' ? textoEn : textoEs;
    var subEs = 'Prueba con otra categoría o amplía el radio de búsqueda en el mapa.';
    var subGl = 'Proba con outra categoría ou amplía o radio de busca no mapa.';
    var subEn = 'Try another category or widen the search radius on the map.';
    if (msgs[categoria]) { subEs = ''; subGl = ''; subEn = ''; }
    var sub = idiomaActual==='gl' ? subGl : idiomaActual==='en' ? subEn : subEs;
    carousel.innerHTML = '<div style="width:100%;padding:2rem 1.5rem;text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center">'
      + '<div style="font-size:36px;margin-bottom:10px">'+icono+'</div>'
      + '<div style="color:#6b7280;font-size:15px;font-weight:600;margin-bottom:6px">'+texto+'</div>'
      + (sub ? '<div style="color:#9ca3af;font-size:14px;line-height:1.6;max-width:240px">'+sub+'</div>' : '')
      + '</div>';
    return;
  }
  var _frag = document.createDocumentFragment();
  filtrados.forEach(function(p) {
    var distHtml = p.distancia!==undefined
      ? '<span class="poi-dist">&#128205; '+formatDist(p.distancia)+'</span>'
      : '<span class="poi-dist calculando">&#128205; ...</span>';
    // Garantizar que valoraciones y opiniones existen para cualquier POI
    if (!valoraciones[p.id]) valoraciones[p.id] = {total:0, votos:0, miVoto:0};
    if (!opiniones[p.id]) opiniones[p.id] = [];
    var val = valoraciones[p.id];
    var media = val.votos>0 ? (val.total/val.votos).toFixed(1) : '-';
    var pageUrl = encodeURIComponent(window.location.href);
    var texto = encodeURIComponent(p.nombre+' - Guia Compostelana Ultreia');
    var ops = opiniones[p.id];
    var opsList = ops.length
      ? ops.map(function(o){return '<div class="opinion-item"><strong>'+esc(o.autor)+':</strong> '+esc(o.texto)+'</div>';}).join('')
      : '<div class="opinion-item" style="color:#bbb">'+(T[idiomaActual]||T.es).seElPrimero+'</div>';
    var enRuta = rutaPuntos.find(function(x){return x.id===p.id;});
    var card = document.createElement('div');
    card.className = 'poi-card';
    card.setAttribute('data-poi-id', p.id);
    // verEnMapa al hacer click en la tarjeta (no en elementos interactivos)
    // Lo maneja el listener global de document
    var pNombre = idiomaActual==='gl'&&p.nombre_gl?p.nombre_gl:idiomaActual==='en'&&p.nombre_en?p.nombre_en:p.nombre;
    var pDesc = idiomaActual==='gl'&&p.descripcion_gl ? p.descripcion_gl : idiomaActual==='en'&&p.descripcion_en ? p.descripcion_en : p.descripcion;
    var pSub = idiomaActual==='gl'&&p.subtitulo_gl ? p.subtitulo_gl : idiomaActual==='en'&&p.subtitulo_en ? p.subtitulo_en : (p.subtitulo||'');
    // Para fiestas, ocultar botón ruta si no es día de la fiesta ±1 día
    var mostrarBtnRuta = true;
    if (p.categoria === 'fiesta' && p.mesIni && p.diaIni) {
      var hoy = new Date();
      var anio = hoy.getFullYear();
      var fIni = new Date(anio, p.mesIni-1, p.diaIni);
      var fFin = p.mesFin ? new Date(anio, p.mesFin-1, p.diaFin) : new Date(anio, p.mesIni-1, p.diaIni);
      var fIniExt = new Date(fIni); fIniExt.setDate(fIniExt.getDate()-1);
      var fFinExt = new Date(fFin); fFinExt.setDate(fFinExt.getDate()+1);
      hoy.setHours(0,0,0,0);
      mostrarBtnRuta = (hoy >= fIniExt && hoy <= fFinExt);
    }
    card.innerHTML =
      (window._imgCromo ? window._imgCromo(p, enRuta, T, idiomaActual) : (p.imagen ? '<div class="poi-img '+p.color+'" style="position:relative;overflow:hidden">' +
        '<img src="'+p.imagen+'" alt="'+p.nombre+'" class="poi-img-cover" loading="lazy" decoding="async" fetchpriority="low"/>' +
      '</div>' : ''))+
      (mostrarBtnRuta && !p.esAlerta && !p.esUsuario && !(window._albumVisitasSet && window._albumVisitasSet[p.id]) ? '<button id="rbtn-'+p.id+'" class="poi-ruta-btn" data-poi="'+p.id+'" style="position:absolute;top:8px;right:8px;z-index:10;font-size:13px;padding:4px 10px;border-radius:10px;background:'+(enRuta?'#1D9E75':'rgba(255,255,255,0.96)')+';color:'+(enRuta?'#fff':'#0F6E56')+';border:1px solid '+(enRuta?'#1D9E75':'rgba(29,158,117,0.4)')+'">'+  (enRuta?'&#10003; '+(T[idiomaActual]||T.es).enRuta.replace('✓ ',''):(T[idiomaActual]||T.es).añadirRuta)+'</button>' : '') +
      (!p.esUsuario ? '<div class="poi-ranking" id="rank-'+p.id+'" style="left:8px;right:auto">&#9733; '+(val.votos>0?media:'-')+'</div>' : '')+
      '<div class="poi-body">'+
        '<div class="poi-category">'+(function(c){var t2=T[idiomaActual]||T.es;var cm={'naturaleza':t2.chipNaturaleza,'monumento':t2.chipMonumento,'albergue':t2.chipAlbergue,'mirador':t2.chipMirador,'edificación religiosa':t2.chipEdif,'localización histórica':t2.chipHist,'vestigio arqueológico':t2.chipVest,'edificación histórica':t2.chipEdifH,'naturaleza':t2.chipNat};return cm[c]||c;})(p.categoria)+'</div>'+
        '<div class="poi-nombre-row"><span class="poi-emoji">'+p.emoji+'</span><span class="poi-nombre">'+pNombre+'</span></div>'+
        (p.categoria==='etapa' && p.km ? '<div style="display:flex;gap:6px;flex-wrap:wrap;margin:5px 0 3px">'+
          '<span style="background:#E1F5EE;color:#0F6E56;border-radius:10px;padding:2px 8px;font-size:13px;font-weight:600">📍 '+p.km+' km</span>'+
          (p.desnivel_pos ? '<span style="background:#FEF3C7;color:#92400E;border-radius:10px;padding:2px 8px;font-size:13px;font-weight:600">↑'+p.desnivel_pos+' m</span>' : '')+
          (p.desnivel_neg ? '<span style="background:#FEF3C7;color:#92400E;border-radius:10px;padding:2px 8px;font-size:13px;font-weight:600">↓'+p.desnivel_neg+' m</span>' : '')+
          (p.dificultad ? '<span style="background:#F3E8FF;color:#6B21A8;border-radius:10px;padding:2px 8px;font-size:13px;font-weight:600">'+p.dificultad+'</span>' : '')+
          (p.variante ? '<span style="background:'+(p.variante==="costa"?"#E0F2FE":"#FCE7F3")+';color:'+(p.variante==="costa"?"#0369A1":"#9D174D")+';border-radius:10px;padding:2px 8px;font-size:13px;font-weight:600">'+(p.variante==="costa"?"🌊 Costa":"🛤️ Interior")+' </span>' : '')+
        '</div>' : '')+
        (pSub ? '<div class="poi-subtitulo">'+pSub+'</div>' : '')+
        (p.esAlerta
          ? '<div style="margin:4px 0 8px">'+distHtml+'</div>'
          : '<div style="display:flex;align-items:center;justify-content:space-between;margin:4px 0 8px">'+
              distHtml+
              '<button class="poi-btn" data-id="'+p.id+'" data-lat="'+p.lat+'" data-lng="'+p.lng+'">'+(T[idiomaActual]||T.es).comoLlegar+'</button>'+
            '</div>'
        )+
        '<p class="poi-desc" id="desc-'+p.id+'">'+pDesc+'</p>'+
        '<button class="poi-leer-mas" id="leer-mas-'+p.id+'">'+(T[idiomaActual]||T.es).leerMas+'</button>'+
        (!p.esUsuario ? '<div class="poi-stars"><div class="stars" id="stars-'+p.id+'"></div><span class="stars-count" id="scount-'+p.id+'">'+(val.votos>0?media+' &middot; '+val.votos+' votos':'')+'</span></div>' : '')+
        (!p.esUsuario ? '<div class="poi-share">'+
          '<a class="poi-share-btn" href="https://wa.me/?text='+texto+'%20'+pageUrl+'" target="_blank">&#128172;</a>'+
          '<a class="poi-share-btn" href="https://www.facebook.com/sharer/sharer.php?u='+pageUrl+'" target="_blank">&#128248;</a>'+
          '<a class="poi-share-btn" href="https://twitter.com/intent/tweet?text='+texto+'&url='+pageUrl+'" target="_blank">&#128038;</a>'+
          '<a class="poi-share-btn" href="https://t.me/share/url?url='+pageUrl+'&text='+texto+'" target="_blank">&#9992;</a>'+
        '</div>' : '')+
        (p.esAlerta
          ? '<div style="margin:8px 0 4px">' +
              '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">' +
                '<span style="font-size:13px;color:#9ca3af">⏱ Caduca en ~'+Math.max(0,Math.round(((p.expiraTs||Date.now())-Date.now())/3600000))+'h · '+(p.reportes||1)+' reporte(s)</span>' +
              '</div>' +
              (alertasReportadas[p.id]
                ? '<div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;padding:7px;font-size:14px;color:#dc2626;text-align:center;margin-bottom:6px">✓ Ya confirmaste esta alerta</div>'
                : '<button onclick="reportarAlerta(\''+p.id+'\')" style="width:100%;background:#dc2626;color:#fff;border:none;border-radius:8px;padding:8px;font-size:14px;font-weight:600;cursor:pointer;font-family:DM Sans,sans-serif;margin-bottom:6px">🚨 Confirmar alerta (+24h)</button>'
              ) +
              (p.deviceId === DEVICE_ID
                ? '<button onclick="eliminarAlerta(\''+p.id+'\')" style="width:100%;background:#fff2f2;color:#ef4444;border:1.5px solid #ef4444;border-radius:8px;padding:7px;font-size:14px;font-weight:600;cursor:pointer;font-family:DM Sans,sans-serif">🗑️ Eliminar para todos</button>'
                : (alertasOcultas[p.id]
                    ? '<button data-alerta-toggle onclick="mostrarAlerta(\''+p.id+'\')" style="width:100%;background:#f0fdf4;color:#15803d;border:1px solid #86efac;border-radius:8px;padding:7px;font-size:14px;font-weight:500;cursor:pointer;font-family:DM Sans,sans-serif">👁 Mostrar en el mapa</button>'
                    : '<button data-alerta-toggle onclick="ocultarAlerta(\''+p.id+'\')" style="width:100%;background:#f3f4f6;color:#6b7280;border:1px solid #d1d5db;border-radius:8px;padding:7px;font-size:14px;font-weight:500;cursor:pointer;font-family:DM Sans,sans-serif">👁 Ocultar del mapa</button>'
                  )
              ) +
            '</div>'
          : '<div class="poi-opiniones">'+
              '<div class="poi-opiniones-lista" id="ops-'+p.id+'">'+opsList+'</div>'+
              '<div class="opinion-form">'+
                '<input class="opinion-input" id="op-txt-'+p.id+'" type="text" placeholder="'+(T[idiomaActual]||T.es).opinionPlaceholder+'"/>'+
                '<button class="opinion-send" data-pid="'+p.id+'">'+(T[idiomaActual]||T.es).enviar+'</button>'+
              '</div>'+
            '</div>'
        )+
        (p.esUsuario ? '<button data-poi-del="'+p.id+'" style="margin-top:6px;width:100%;background:rgba(239,68,68,0.12);color:#ef4444;border:1px solid rgba(239,68,68,0.35);border-radius:8px;padding:6px;font-size:13px;font-weight:600;cursor:pointer;font-family:DM Sans,sans-serif">🗑️ Eliminar este punto</button>' : '')+
      '</div>';
    _frag.appendChild(card);

    // Añadir estrellas con createElement — igual que el test que funciona
    // Si ya tiene foto propia guardada, aplicarla
    if (window._albumGetFoto && window._albumVisitasSet && window._albumVisitasSet[p.id]) {
      (function(pid){ window._albumGetFoto(pid, function(blob) {
        if (!blob) return;
        var url = URL.createObjectURL(blob);
        var el = document.getElementById('cromo-img-'+pid); if (el) el.src = url;
        var btn = document.getElementById('foto-btn-'+pid); if (btn) btn.innerHTML = '✏️ cambiar';
        // Eliminar overlay 'Añade foto' ya que el usuario tiene foto propia
        var wrap = document.querySelector('[data-cromo-id="'+pid+'"]');
        if (wrap) { var ov = wrap.querySelector('div[style*="pointer-events:none"]'); if (ov) ov.remove(); }
      }); })(p.id);
    }
    if (!p.esUsuario) { var starsContainer = card.querySelector('.stars');
    if (starsContainer) {
      starsContainer.innerHTML = '';
      for (var sn = 1; sn <= 5; sn++) {
        var star = document.createElement('span');
        star.innerHTML = sn <= val.miVoto ? '&#9733;' : '&#9734;';
        if (sn <= val.miVoto) star.className = 'star activa';
        else star.className = 'star';
        star.setAttribute('data-id', p.id);
        star.setAttribute('data-n', sn);
        star.setAttribute('data-star', '1');
        starsContainer.appendChild(star);
      }
    } }
    // Listener directo en botón enviar
    var sendBtn = card.querySelector('.opinion-send');
    if (sendBtn) sendBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      enviarOpinion(sendBtn);
    });
    // Listener directo en input opinión
    var opInput = card.querySelector('.opinion-input');
    if (opInput) opInput.addEventListener('click', function(e) { e.stopPropagation(); });
    // Listener "Leer más"
    var leerMasBtn = card.querySelector('.poi-leer-mas');
    if (leerMasBtn) {
      leerMasBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        var descEl = card.querySelector('.poi-desc');
        if (!descEl) return;
        var open = descEl.classList.contains('expanded');
        descEl.classList.toggle('expanded', !open);
        leerMasBtn.textContent = open ? (T[idiomaActual]||T.es).leerMas : (T[idiomaActual]||T.es).leerMenos;
        // Ocultar/mostrar botón añadir punto del mapa al expandir/colapsar
        var btnAdd = document.getElementById('btn-add-poi-map');
        if (btnAdd && !_navActiva) btnAdd.style.display = open ? 'flex' : 'none';
      });
    }
    // El botón ruta es manejado por el listener global del carrusel (sin listener directo)
    // Listener directo en botón llegar
    var llegarBtn = card.querySelector('.poi-btn');
    if (llegarBtn) llegarBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      irDesdeCarrusel(llegarBtn.getAttribute('data-id') || ''); 
    });

  });
  // Volcar todo el fragment al DOM de una sola vez — evita reflows por cada card
  carousel.innerHTML = '';
  carousel.appendChild(_frag);
}

function moverCarrusel(dir) {
  var c=document.getElementById('carousel');
  var card=c.querySelector('.poi-card');
  var ancho=card?card.offsetWidth+20:300;
  c.scrollBy({left:dir*ancho*2,behavior:'smooth'});
}

// ACCIONES POI
function votarEstrella(id, n) {
  var val = valoraciones[id];
  if (!val) return;
  var yaVoto = val.miVoto > 0;
  val.total = val.total - val.miVoto + n;
  val.votos = yaVoto ? val.votos : val.votos + 1;
  val.miVoto = n;
  guardarValoracion(id);
  actualizarEstrellasPunto(id);
}

function votar(el) {
  var id=el.getAttribute('data-id'), n=parseInt(el.getAttribute('data-n'));
  var yaVoto = valoraciones[id].miVoto > 0;
  valoraciones[id].total = valoraciones[id].total - valoraciones[id].miVoto + n;
  valoraciones[id].votos = yaVoto ? valoraciones[id].votos : valoraciones[id].votos + 1;
  valoraciones[id].miVoto = n;
  guardarValoracion(id);
  actualizarEstrellasPunto(id);
}
function enviarOpinion(btn) {
  var id=btn.getAttribute('data-pid');
  var input=document.getElementById('op-txt-'+id);
  var txt=input?input.value.trim():'';
  if (!txt) return;
  guardarComentario(id, txt);
  input.value='';
  btn.textContent = '&#10003;';
  setTimeout(function(){ btn.textContent = 'Enviar'; }, 1500);
}

function irDesdeCarrusel(id) {
  // Añadir a ruta si no está ya
  var p = PUNTOS.find(function(x){ return x.id === id; });
  if (!p) return;
  if (!rutaPuntos.find(function(x){ return x.id === id; })) {
    addToRoute(id);
  }
  // Ir al mapa
  verEnMapa(p.lat, p.lng);
  // Activar navegación tras un breve delay para que el mapa se centre
  setTimeout(function() {
    var btnNav = document.getElementById('ruta-nav-btn');
    if (btnNav && btnNav.style.display !== 'none') {
      activarNavegacionVoz();
    }
  }, 600);
}
function verEnMapa(lat,lng) {
  mapa.setView([lat,lng],14);
  document.activeElement && document.activeElement.blur(); setTimeout(function(){ var el=document.getElementById('map'); if(el){ var rect=el.getBoundingClientRect(); var center=window.pageYOffset+rect.top-(window.innerHeight/2)+(rect.height/2); window.scrollTo({top:Math.max(0,center),behavior:'smooth'}); } },600);
}
function _busqBtnEstado(lat, lng) {
  var tmpId = '_busq_' + lat.toString().replace('.','') + '_' + lng.toString().replace('.','');
  return rutaPuntos.some(function(p){ return p.id === tmpId; });
}
function _busqBtnHtml(lat, lng) {
  var enR = _busqBtnEstado(lat, lng);
  return enR
    ? 'background:#1D9E75;color:#fff;border:none'
    : 'background:#E1F5EE;color:#0F6E56;border:1px solid rgba(29,158,117,0.4)';
}
function _busqBtnTxt(lat, lng) {
  return _busqBtnEstado(lat, lng) ? '✓ En ruta' : '➕ Añadir a ruta';
}
function _toggleBusquedaRuta(btn, nombreEnc, lat, lng) {
  var nombre = decodeURIComponent(nombreEnc);
  var tmpId = '_busq_' + lat.toString().replace('.','') + '_' + lng.toString().replace('.','');
  var enRuta = rutaPuntos.some(function(p){ return p.id === tmpId; });
  mapa.closePopup();
  if (enRuta) {
    // Quitar de la ruta (mantener en PUNTOS para que el marcador siga visible)
    rutaPuntos = rutaPuntos.filter(function(p){ return p.id !== tmpId; });
    actualizarRuta();
    mostrarToast('🗑️ ' + nombre + ' eliminado de la ruta');
    if (btn) { btn.textContent = '➕ Añadir a ruta'; btn.style.background = '#E1F5EE'; btn.style.color = '#0F6E56'; btn.style.borderColor = 'rgba(29,158,117,0.4)'; }
  } else {
    // Añadir a la ruta
    if(_bloquearSiLejos())return;
    PUNTOS = PUNTOS.filter(function(p){ return p.id !== tmpId; });
    PUNTOS.push({ id:tmpId, nombre:nombre, lat:lat, lng:lng, categoria:'busqueda', emoji:'📍' });
    addToRoute(tmpId);
    mostrarToast('📍 ' + nombre + ' añadido a la ruta');
    if (btn) { btn.textContent = '✓ En ruta'; btn.style.background = '#1D9E75'; btn.style.color = '#fff'; btn.style.borderColor = 'transparent'; }
    setTimeout(function(){
      var ids = ['btn-add-poi-map','btn-alertas-toggle','btn-brujula-mapa','btn-sos-mapa',
                 'btn-buscar-mapa','btn-meteo-mapa','btn-poi-drawer-mapa','btn-asistente-mapa'];
      ids.forEach(function(id){ var b=document.getElementById(id); if(b&&!_navActiva) b.style.display='flex'; });
      var b2=document.getElementById('map-ruta-panel'); if(b2){b2.style.display='flex';b2.style.flexDirection='column';}
      var b3=document.getElementById('map-radio-control'); if(b3) b3.style.display='flex';
    }, 350);
  }
}
function _addBusquedaRuta(nombreEnc, lat, lng) {
  var nombre = decodeURIComponent(nombreEnc);
  var tmpId = '_busq_' + lat.toString().replace('.','') + '_' + lng.toString().replace('.','');
  PUNTOS = PUNTOS.filter(function(p){ return p.id !== tmpId; });
  PUNTOS.push({ id:tmpId, nombre:nombre, lat:lat, lng:lng, categoria:'busqueda', emoji:'📍' });
  addToRoute(tmpId);
  mostrarToast('📍 ' + nombre + ' añadido a la ruta');
  // Restaurar botones del mapa siempre, independientemente del estado del popup
  setTimeout(function(){
    var ids = ['btn-add-poi-map','btn-alertas-toggle','btn-brujula-mapa','btn-sos-mapa',
               'btn-buscar-mapa','btn-meteo-mapa','btn-poi-drawer-mapa','btn-asistente-mapa'];
    ids.forEach(function(id){
      var b = document.getElementById(id);
      if (b && !_navActiva) b.style.display = 'flex';
    });
    var b2 = document.getElementById('map-ruta-panel');
    if (b2){ b2.style.display='flex'; b2.style.flexDirection='column'; }
    var b3 = document.getElementById('map-radio-control');
    if (b3) b3.style.display = 'flex';
  }, 350);
}
function _mostrarEnMapaConRuta(lat, lng, nombre) {
  mapa.closePopup();
  var tmpId = '_busq_' + lat.toString().replace('.','') + '_' + lng.toString().replace('.','');
  var nombreFinal = nombre || 'Destino';
  PUNTOS = PUNTOS.filter(function(p){ return p.id !== tmpId; });
  rutaPuntos = rutaPuntos.filter(function(p){ return p.id !== tmpId; });
  var tmp = { id:tmpId, nombre:nombreFinal, lat:lat, lng:lng, categoria:'busqueda', emoji:'📍' };
  PUNTOS.push(tmp);
  addToRoute(tmpId);
  // Marcador en el mapa con popup toggle
  if (!window._wizSearchMarkers) window._wizSearchMarkers = [];
  var mk = L.marker([lat, lng], { icon: iconoBusqueda }).addTo(mapa);
  mk.bindPopup('<div style="font-family:DM Sans,sans-serif;min-width:160px"><strong>' + nombreFinal + '</strong><br><div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap"><button onclick="_toggleBusquedaRuta(this,encodeURIComponent(\'' + nombreFinal.replace(/'/g,"\\'") + '\'),' + lat + ',' + lng + ');" style="background:#1D9E75;color:#fff;border:none;padding:5px 12px;border-radius:12px;font-size:12px;font-weight:600;cursor:pointer;font-family:DM Sans,sans-serif">✓ En ruta</button><button onclick="irACoordenadasNav(' + lat + ',' + lng + ')" style="background:#1D9E75;color:#fff;border:none;padding:5px 12px;border-radius:12px;font-size:12px;cursor:pointer;font-family:DM Sans,sans-serif">🗺️ Cómo llegar</button></div></div>');
  window._wizSearchMarkers.push(mk);
  // Vista radio 1km igual que el botón del mapa
  mapa.setView([lat, lng], 15);
  radioKm = 1;
  _aplicarEstadoRadioBtns(1);
  if (userLat) aplicarRadio(1);
  document.activeElement && document.activeElement.blur();
  setTimeout(function() {
    if (typeof dibujarLineaEstática === 'function') dibujarLineaEstática();
  }, 500);
  setTimeout(function(){
    var el = document.getElementById('map');
    if (el) {
      var rect = el.getBoundingClientRect();
      window.scrollTo({ top: Math.max(0, window.pageYOffset + rect.top - (window.innerHeight/2) + (rect.height/2)), behavior:'smooth' });
    }
  }, 700);
}

function irACoordenadasNav(lat,lng) {
  if(_bloquearSiLejos())return;
  mapa.closePopup();
  var tmpId = '_busqueda_tmp';
  PUNTOS = PUNTOS.filter(function(p){ return p.id !== tmpId; });
  rutaPuntos = rutaPuntos.filter(function(p){ return p.id !== tmpId; });
  var tmp = { id:tmpId, nombre:'Destino', lat:lat, lng:lng, categoria:'busqueda', emoji:'📍' };
  PUNTOS.push(tmp);
  addToRoute(tmpId);
  verEnMapa(lat, lng);
  setTimeout(function() { activarNavegacionVoz(); }, 600);
}

function irIndicaciones(lat,lng) {
  var url='https://www.google.com/maps/dir/?api=1&destination='+lat+','+lng;
  if (userLat) url+='&origin='+userLat+','+userLng;
  window.open(url,'_blank');
  actualizarBotonesRuta();
}
function filtrarCategoria(chip,categoria) {
  document.querySelectorAll('.cat-chip').forEach(function(c){c.classList.remove('active');});
  chip.classList.add('active');
  // Parar parpadeo al seleccionar alertas
  if (categoria === 'alerta') {
    var chipAlerta = document.getElementById('chip-alertas');
    if (chipAlerta) chipAlerta.style.animation = '';
  }
  renderCarrusel(categoria);
}

// MODALES
function abrirCripto(){document.getElementById('modal-cripto').classList.add('visible');}
function cerrarModal(id,e){if(e.target===document.getElementById(id))document.getElementById(id).classList.remove('visible');}
function revelarBizum(){
  var el=document.getElementById('bizum-num');
  var hint=document.getElementById('bizum-reveal-hint');
  if(el.textContent.indexOf('•')!==-1){
    el.textContent=el.getAttribute('data-real');
    if(hint)hint.style.visibility='hidden';
  } else {
    el.textContent='••• ••• •••';
    if(hint)hint.style.visibility='visible';
  }
}
function abrirBizum(){
  var el=document.getElementById('bizum-num');
  if(el){el.textContent='••• ••• •••';}
  var hint=document.getElementById('bizum-reveal-hint');
  if(hint)hint.style.visibility='visible';
  document.getElementById('modal-bizum').classList.add('visible');
}
function copiarBizum(){
  var el=document.getElementById('bizum-num');
  var num=el.getAttribute('data-real')||el.textContent.trim();
  if(navigator.clipboard)navigator.clipboard.writeText(num);
  var m=document.getElementById('bizum-copied');m.textContent='Numero copiado';
  setTimeout(function(){m.textContent='';},2000);
}
function copiarCripto(el){
  if(navigator.clipboard)navigator.clipboard.writeText(el.textContent.trim());
  var orig=el.textContent;el.textContent='Copiado';
  setTimeout(function(){el.textContent=orig;},2000);
}

// GENERADOR DE RUTA
// ── GEOFENCE DE RUTA ──────────────────────────────────────────────
// Si el usuario está a más de UMBRAL_LEJOS_KM del punto oficial del Camino
// más cercano, cualquier acción de ruta (añadir, navegar, modo oficial) se
// bloquea con un aviso flotante, para no dibujar trazados intercontinentales
// absurdos cuando se abre la app lejos de Galicia (p. ej. desde Australia).
var UMBRAL_LEJOS_KM = 200;

// true si hay posición GPS conocida y el Camino oficial más cercano queda a
// más de UMBRAL_LEJOS_KM. Sin GPS devuelve false (no podemos medir → no
// bloqueamos). Mide solo contra POIs del Camino real: excluye búsquedas OSM,
// el destino temporal y el punto sintético "volver a la ruta".
function _lejosDelCamino() {
  if (typeof userLat === 'undefined' || !userLat || typeof userLng === 'undefined' || !userLng) return false;
  if (typeof PUNTOS === 'undefined' || !PUNTOS.length) return false;
  var min = Infinity;
  for (var i = 0; i < PUNTOS.length; i++) {
    var p = PUNTOS[i];
    if (!p || p.lat == null || p.lng == null) continue;
    if (p.categoria === 'busqueda' || p.categoria === 'volver') continue;
    if (p.esUsuario) continue; // puntos del usuario: no cuentan como Camino oficial
    if (p.id === '_busqueda_tmp' || p.id === '_volver_ruta') continue;
    if (typeof p.id === 'string' && (p.id.indexOf('_busq_') === 0 || p.id.indexOf('u_') === 0)) continue;
    var d = haversine(userLat, userLng, p.lat, p.lng);
    if (d < min) min = d;
    if (min <= UMBRAL_LEJOS_KM) return false; // Camino cerca: salida rápida
  }
  return min > UMBRAL_LEJOS_KM;
}

// Modal flotante de aviso. Idempotente: nunca se apila.
function _avisoLejosCamino() {
  if (document.getElementById('aviso-lejos-camino')) return;
  var t = (typeof T !== 'undefined' && T[idiomaActual]) ? T[idiomaActual] : (typeof T !== 'undefined' ? T.es : {});
  var titulo = t.lejosTitulo || 'Estás muy lejos del Camino';
  var msg    = t.lejosMsg    || 'Estás demasiado lejos del Camino para trazar la ruta.';
  var preg   = t.lejosSimPregunta || '¿Quieres explorar el Camino en modo simulación?';
  var siTxt  = t.lejosSimSi  || 'Sí, simular';
  var noTxt  = t.lejosSimNo  || 'No, gracias';

  if (!document.getElementById('_lejosKeyframes')) {
    var st = document.createElement('style');
    st.id = '_lejosKeyframes';
    st.textContent = '@keyframes _lejosPop{from{opacity:0;transform:scale(.92)}to{opacity:1;transform:scale(1)}}';
    document.head.appendChild(st);
  }

  var ov = document.createElement('div');
  ov.id = 'aviso-lejos-camino';
  ov.style.cssText = 'position:fixed;inset:0;z-index:1000000;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;padding:1.2rem;box-sizing:border-box;font-family:DM Sans,sans-serif;-webkit-tap-highlight-color:transparent';

  var card = document.createElement('div');
  card.style.cssText = 'background:#fff;border-radius:18px;max-width:340px;width:100%;padding:26px 22px 20px;text-align:center;box-shadow:0 18px 50px rgba(0,0,0,0.35);animation:_lejosPop .22s ease-out';
  card.innerHTML =
    '<div style="font-size:44px;line-height:1;margin-bottom:12px">🧭</div>' +
    '<div style="font-size:18px;font-weight:700;color:#0F6E56;margin-bottom:8px">' + titulo + '</div>' +
    '<div style="font-size:14px;line-height:1.5;color:#555;margin-bottom:6px">' + msg + '</div>' +
    '<div style="font-size:14px;line-height:1.5;color:#1a1a1a;font-weight:600;margin-bottom:20px">' + preg + '</div>';

  function _cerrarAviso(){ try { document.body.removeChild(ov); } catch(e){} }

  var btnSim = document.createElement('button');
  btnSim.type = 'button';
  btnSim.textContent = '🧪 ' + siTxt;
  btnSim.style.cssText = 'width:100%;background:#DC2626;color:#fff;border:none;border-radius:12px;padding:12px;font-size:15px;font-weight:700;cursor:pointer;font-family:DM Sans,sans-serif;-webkit-appearance:none;margin-bottom:8px';
  btnSim.addEventListener('click', function(){ _cerrarAviso(); if (typeof _iniciarSimulacion === 'function') _iniciarSimulacion(); });

  var btnNo = document.createElement('button');
  btnNo.type = 'button';
  btnNo.textContent = noTxt;
  btnNo.style.cssText = 'width:100%;background:#f0f0f0;color:#555;border:none;border-radius:12px;padding:12px;font-size:15px;font-weight:600;cursor:pointer;font-family:DM Sans,sans-serif;-webkit-appearance:none';
  btnNo.addEventListener('click', _cerrarAviso);

  ov.addEventListener('click', function(e){ if (e.target === ov) _cerrarAviso(); });

  card.appendChild(btnSim);
  card.appendChild(btnNo);
  ov.appendChild(card);
  document.body.appendChild(ov);
}

// Devuelve true (y muestra el aviso) si hay que BLOQUEAR la acción de ruta.
function _bloquearSiLejos() {
  if (_lejosDelCamino()) { _avisoLejosCamino(); return true; }
  return false;
}

function addToRoute(id) {
  var todos = PUNTOS.concat(typeof PUNTOS_USUARIO !== 'undefined' ? PUNTOS_USUARIO : []);
  var p = todos.find(function(x){return x.id===id;});
  if(!p) return;
  var yaEsta=rutaPuntos.find(function(x){return x.id===id;});
  if(yaEsta){quitarDeRuta(id);return;}
  if(_bloquearSiLejos())return;
  rutaPuntos.push({id:p.id,nombre:p.nombre,lat:p.lat,lng:p.lng});
  actualizarRuta();
  actualizarBtnMapa(id, true);
  // Ajustar zoom: 1 km mínimo centrado en el punto, ampliando si el usuario está más lejos
  if (typeof mapa !== 'undefined' && mapa) {
    var tienePos = typeof userLat !== 'undefined' && userLat && typeof userLng !== 'undefined' && userLng;
    if (tienePos) {
      var bounds = L.latLngBounds([[p.lat, p.lng], [userLat, userLng]]);
      var dist = mapa.distance([p.lat, p.lng], [userLat, userLng]); // metros
      if (dist < 1000) {
        mapa.setView([p.lat, p.lng], 15, {animate: true}); // zoom ~1 km
      } else {
        mapa.fitBounds(bounds, {padding: [40, 40], maxZoom: 15, animate: true});
      }
    } else {
      mapa.setView([p.lat, p.lng], 15, {animate: true});
    }
  }
}

function actualizarBtnMapa(id, enRuta) {
  // Popup del mapa
  var mpbtn = document.getElementById('mpbtn-' + id);
  var t = T[idiomaActual] || T.es;
  if (mpbtn) {
    mpbtn.style.background = enRuta ? '#1D9E75' : '#E1F5EE';
    mpbtn.style.color      = enRuta ? '#fff'    : '#0F6E56';
    mpbtn.innerHTML        = enRuta ? '&#10003; ' + t.enRuta.replace('✓ ','') : (t.añadirRutaCorto||'+ ruta');
  }
  // Tarjeta POI sección
  var rbtn = document.getElementById('rbtn-' + id);
  if (rbtn) {
    rbtn.classList.toggle('en-ruta', !!enRuta);
    rbtn.innerHTML = enRuta ? '&#10003; ' + t.enRuta.replace('✓ ','') : t.añadirRuta;
    rbtn.style.background = enRuta ? '#1D9E75' : 'rgba(255,255,255,0.92)';
    rbtn.style.color      = enRuta ? '#fff'    : '#0F6E56';
    rbtn.style.border     = enRuta ? '1px solid #1D9E75' : '1px solid rgba(29,158,117,0.4)';
  }
}
function rutaPillDel(btn) { quitarDeRuta(btn.getAttribute('data-rid')); }
function quitarDeRuta(id) {
  if (typeof id !== 'string') id = id;
  rutaPuntos=rutaPuntos.filter(function(x){return x.id!==id;});
  // Borrar línea inmediatamente antes de redibujar para evitar trazado fantasma
  if (_rutaLinea) { mapa.removeLayer(_rutaLinea); _rutaLinea = null; }
  if (window._rutaFlechas) { window._rutaFlechas.forEach(function(m){ mapa.removeLayer(m); }); window._rutaFlechas = []; }
  actualizarRuta();
  actualizarBtnMapa(id, false);
}
// ── MODAL PERGAMINO REUTILIZABLE ────────────────────────────────────────────
// config: { id, titulo, subtitulo?, opciones:[{emoji,tit,sub?,accion,estilo?}], cancelTxt? }
function _modalPergamino(config) {
  var old = document.getElementById(config.id);
  if (old) old.remove();

  // Inyectar keyframe si no existe
  if (!document.getElementById('_casc-pulse-style-global')) {
    var st = document.createElement('style');
    st.id = '_casc-pulse-style-global';
    st.textContent = '@keyframes _casc-pulse{0%,100%{transform:scale(1) rotate(-3deg)}50%{transform:scale(1.08) rotate(3deg)}}';
    document.head.appendChild(st);
  }

  var overlay = document.createElement('div');
  overlay.id = config.id;
  overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.72);display:flex;align-items:center;justify-content:center;font-family:DM Sans,sans-serif';

  var box = document.createElement('div');
  box.className = 'pergamino-modal-box';
  box.style.cssText = 'background:radial-gradient(ellipse at 15% 20%,rgba(90,50,0,0.18) 0%,transparent 55%),radial-gradient(ellipse at 85% 75%,rgba(60,30,0,0.20) 0%,transparent 50%),linear-gradient(180deg,#c9933a 0%,#b87d28 40%,#a86d18 100%);border-radius:20px;padding:22px 20px 20px;width:min(320px,90vw);box-sizing:border-box;position:relative;border:2.5px solid #5a3008;box-shadow:0 8px 40px rgba(0,0,0,0.55),inset 0 0 40px rgba(60,25,0,0.2),inset 0 1px 0 rgba(255,220,120,0.15)';

  // Grid líneas
  var grid = document.createElement('div');
  grid.style.cssText = 'position:absolute;inset:0;border-radius:18px;background-image:repeating-linear-gradient(0deg,transparent,transparent 28px,rgba(139,105,20,0.07) 28px,rgba(139,105,20,0.07) 29px);pointer-events:none;opacity:0.7';
  box.appendChild(grid);

  // Handle decorativo
  var handle = document.createElement('div');
  handle.style.cssText = 'width:36px;height:3px;background:rgba(139,105,20,0.4);border-radius:2px;margin:0 auto 16px';
  box.appendChild(handle);

  var tieneSub = !!config.subtitulo;

  // Casco animado. Si hay subtítulo, acompaña a ESTE (el texto nace desde su
  // base); si no, vuelve junto al título con su dictado clásico.
  var cascoImg = document.createElement('img');
  cascoImg.src = 'https://i.postimg.cc/hP2mT0LN/casc6.webp';
  cascoImg.style.cssText = 'width:34px;height:34px;object-fit:contain;flex-shrink:0;animation:_casc-pulse 2.4s ease-in-out infinite';

  var titEl = document.createElement('div');
  if (tieneSub) {
    // Con subtítulo: título solo, sin casco y sin typewriter (texto inmediato).
    titEl.style.cssText = 'font-family:DM Sans,sans-serif;font-size:15px;font-weight:500;color:#1a0800;line-height:1.4;margin-bottom:24px;position:relative;z-index:1';
    box.appendChild(titEl);
  } else {
    // Sin subtítulo: casco + título dictado (comportamiento clásico).
    var cascoWrap = document.createElement('div');
    cascoWrap.style.cssText = 'display:flex;align-items:center;gap:10px;margin-bottom:10px;position:relative;z-index:1';
    titEl.style.cssText = 'font-family:DM Sans,sans-serif;font-size:15px;font-weight:500;color:#1a0800;line-height:1.4;flex:1';
    cascoWrap.appendChild(cascoImg);
    cascoWrap.appendChild(titEl);
    box.appendChild(cascoWrap);
  }

  // Subtítulo (opcional): el casco se ancla al COMIENZO con su base en la
  // primera línea (la línea nace de su base, como el saludo del asistente).
  // El casco solo reserva el alto de UNA línea: el resto del párrafo fluye
  // a ancho completo por debajo, sin que el casco abarque dos líneas.
  var subEl = null;
  if (tieneSub) {
    var subWrap = document.createElement('div');
    subWrap.style.cssText = 'margin:0 0 14px;position:relative;z-index:1;display:flow-root';
    // Caja flotante de 1 línea de alto; la imagen desborda hacia ARRIBA
    // (overflow visible) para verse a tamaño completo apoyada en esa línea.
    var cascoBox = document.createElement('span');
    cascoBox.style.cssText = 'float:left;width:30px;height:21px;margin:0 10px 0 0;overflow:visible';
    cascoImg.style.cssText = 'width:30px;height:30px;object-fit:contain;display:block;margin-top:-9px;animation:_casc-pulse 2.4s ease-in-out infinite';
    cascoBox.appendChild(cascoImg);
    subEl = document.createElement('p');
    subEl.style.cssText = 'font-size:15px;font-weight:500;color:rgba(26,8,0,0.82);text-align:left;margin:0;line-height:1.4';
    subWrap.appendChild(cascoBox);
    subWrap.appendChild(subEl);
    box.appendChild(subWrap);
  }

  // extraHtml opcional (bloque entre subtítulo y separador)
  if (config.extraHtml) {
    var extraEl = document.createElement('div');
    extraEl.style.cssText = 'position:relative;z-index:1;margin-bottom:12px';
    extraEl.innerHTML = config.extraHtml;
    box.appendChild(extraEl);
  }

  // Separador ornamental
  var orn = document.createElement('div');
  orn.style.cssText = 'text-align:center;color:#8b6914;letter-spacing:5px;font-size:12px;margin-bottom:12px;position:relative;z-index:1';
  orn.textContent = '✦ ✦ ✦';
  box.appendChild(orn);

  // Opciones (se insertan después del typewriter)
  var optsWrap = document.createElement('div');
  optsWrap.style.cssText = 'display:flex;flex-direction:column;gap:8px;position:relative;z-index:1';

  config.opciones.forEach(function(op) {
    var btn = document.createElement('button');
    var baseStyle = 'width:100%;border-radius:10px;padding:11px 14px;font-size:13px;cursor:pointer;font-family:DM Sans,sans-serif;text-align:left;display:flex;align-items:center;gap:10px;border:none;';
    btn.style.cssText = baseStyle + (op.estilo || 'background:rgba(255,255,255,0.18);border:1.5px solid #7a5010;');
    btn.innerHTML = '<span style="font-size:20px;flex-shrink:0">' + op.emoji + '</span>'
      + '<span><span style="display:block;font-weight:700;color:' + (op.colorTit||'#1a0800') + ';font-size:13px">' + op.tit + '</span>'
      + (op.sub ? '<span style="font-size:11px;color:' + (op.colorSub||'rgba(26,8,0,0.6)') + ';font-weight:400">' + op.sub + '</span>' : '')
      + '</span>';
    btn.addEventListener('click', function() { overlay.remove(); op.accion(); });
    optsWrap.appendChild(btn);
  });

  // Cancelar o X
  var cancelBtn = null;
  if (!config.xCerrar) {
    cancelBtn = document.createElement('button');
    cancelBtn.style.cssText = 'width:100%;background:none;border:none;padding:9px 0;font-size:13px;cursor:pointer;font-family:DM Sans,sans-serif;color:rgba(26,8,0,0.38);text-align:center;position:relative;z-index:1;margin-top:2px';
    cancelBtn.textContent = config.cancelTxt || 'Cancelar';
    cancelBtn.addEventListener('click', function(){ overlay.remove(); });
  } else {
    var btnX = document.createElement('button');
    btnX.textContent = '✕';
    btnX.style.cssText = 'position:absolute;top:10px;right:10px;width:28px;height:28px;background:rgba(0,0,0,0.18);border:1.5px solid #7a5010;border-radius:50%;color:#1a0800;font-size:13px;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:10;line-height:1;-webkit-appearance:none';
    btnX.addEventListener('click', function(){ overlay.remove(); });
    box.appendChild(btnX);
  }

  overlay.appendChild(box);
  document.body.appendChild(overlay);
  overlay.addEventListener('click', function(e){ if(e.target===overlay) overlay.remove(); });

  // Typewriter del casco con cadencia natural: ritmo pausado, micro-pausas
  // tras la puntuación y respiro en los saltos de párrafo. El casco y su
  // sonido se arman para TODA la duración (pausas incluidas), de modo que
  // animación y dictado quedan acompasados de principio a fin.
  function _pausaCad(ch) {
    if (ch === '\n') return 520;                                   // párrafo: respiro
    if (ch === '.' || ch === '!' || ch === '?' || ch === '\u2026') return 360; // fin de frase
    if (ch === ',' || ch === ';' || ch === ':') return 180;        // inciso
    return 0;
  }
  function _durCad(text, base) {
    var ms = 0;
    for (var k = 0; k < text.length; k++) { ms += base + _pausaCad(text[k]); }
    return ms / 1000 + 0.25; // a segundos, con margen de cola
  }
  function _twGlobal(el, html, speed, onDone) {
    var text = html.replace(/<[^>]+>/g, '');
    var base = speed || 45;
    var i = 0;
    function _rg() {
      var vis  = text.slice(0, i);
      var hide = text.slice(i);
      el.innerHTML = (vis  ? '<span>' + vis.replace(/&/g,'&amp;').replace(/</g,'&lt;') + '</span>' : '')
                   + (hide ? '<span style="visibility:hidden">' + hide.replace(/&/g,'&amp;').replace(/</g,'&lt;') + '</span>' : '');
    }
    _rg();
    cascoImg.style.animation = '_casc-pulse 2.4s ease-in-out infinite';
    if (window._cascoSonido) _cascoSonido(_durCad(text, base));
    function _fin() {
      el.innerHTML = html;
      cascoImg.style.animation = 'none';
      if (window._cascoSonidoStop) _cascoSonidoStop();
      if (onDone) onDone();
    }
    function _paso() {
      if (i >= text.length) { _fin(); return; }
      i++; _rg();
      var ch = text[i-1];
      if (ch !== ' ' && ch !== '\n' && window._cascoTick) window._cascoTick();
      setTimeout(_paso, base + _pausaCad(ch));
    }
    setTimeout(_paso, base);
  }

  // Título y subtítulo con la misma cadencia pausada, y un respiro entre
  // ambos como si el casco tomara aire antes de seguir.
  function _mostrarOpts() {
    setTimeout(function() { box.appendChild(optsWrap); if (cancelBtn) box.appendChild(cancelBtn); }, 140);
  }
  if (tieneSub) {
    // Título inmediato (sin typewriter); el casco dicta el subtítulo.
    titEl.innerHTML = config.titulo;
    _twGlobal(subEl, config.subtitulo, 44, _mostrarOpts);
  } else {
    _twGlobal(titEl, config.titulo, 44, _mostrarOpts);
  }
}

function limpiarRuta() {
  if (_navActiva) detenerNavegacionVoz();
  if (typeof _ocultarBtnComenzarNav==='function') _ocultarBtnComenzarNav();
  if (typeof _quitarMarkerVolver==='function') _quitarMarkerVolver();
  var hayActiva = rutaPuntos.length > 0;
  var hayGuardada = false;
  try { hayGuardada = !!localStorage.getItem('rutaGuardadaV2'); } catch(e) {}
  var hayBusqueda = (window._wizSearchMarkers && window._wizSearchMarkers.length > 0);
  // Solo hay resultados de búsqueda en el mapa (sin ruta activa ni guardada):
  // la papelera debe borrarlos directamente, sin modal de confirmación.
  if (!hayActiva && !hayGuardada && hayBusqueda) {
    try { window._wizSearchMarkers.forEach(function(m){ try{mapa.removeLayer(m);}catch(e){} }); } catch(e) {}
    window._wizSearchMarkers = [];
    try { PUNTOS = PUNTOS.filter(function(p){ return p.categoria !== 'busqueda'; }); } catch(e) {}
    _actualizarBtnLimpiar();
    mostrarToast('🗑️ Resultados de búsqueda borrados');
    return;
  }
  if (!hayActiva && !hayGuardada) return;
  var tl = T[idiomaActual] || T.es;
  // Sin ruta guardada: pedir confirmación antes de limpiar el mapa
  if (!hayGuardada) {
    _modalPergamino({
      id: 'modal-confirm-limpiar-simple',
      titulo: tl.confirmLimpiar || '¿Eliminar la ruta?',
      subtitulo: tl.confirmLimpiarSub || 'La ruta no está guardada en memoria. Este cambio no puede deshacerse.',
      cancelTxt: tl.cancelar || 'Cancelar',
      opciones: [
        { emoji:'🗑️', tit: tl.confirmLimpiarOk || 'Sí, eliminar la ruta',
          colorTit:'#7a1a1a', estilo:'background:rgba(120,30,30,0.18);border:1.5px solid rgba(160,60,60,0.6);',
          accion: function(){ _ejecutarLimpiarRutaSoloMapa(true); } }
      ]
    });
    return;
  }
  var opciones = [];
  if (hayActiva) {
    opciones.push({ emoji:'🗺️', tit: tl.limpiarOptMapaTit||'Limpiar solo el mapa',
      sub: tl.limpiarOptMapaSub||'Ruta guardada permanece disponible',
      colorTit:'#1a0800', colorSub:'rgba(26,8,0,0.75)',
      estilo:'background:rgba(255,255,255,0.18);border:1.5px solid #7a5010;',
      accion: function(){ _ejecutarLimpiarRutaSoloMapa(); } });
  }
  opciones.push({ emoji:'🧹', tit: tl.limpiarOptMemoriaTit||'Borrar solo la memoria',
    sub: tl.limpiarOptMemoriaSub||'El mapa y la ruta activa no cambian',
    colorTit:'#854d0e', colorSub:'#a16207',
    estilo:'background:rgba(254,252,232,0.35);border:1.5px solid #b8860b;',
    accion: function(){ _borrarSoloMemoria(); } });
  opciones.push({ emoji:'🗑️', tit: tl.limpiarOptTodoTit||'Limpiar memoria y mapa',
    sub: tl.limpiarOptTodoSub||'Borra todo — mapa y memoria guardada',
    colorTit:'#7a1a1a', colorSub:'rgba(140,50,50,0.85)',
    estilo:'background:rgba(120,30,30,0.18);border:1.5px solid rgba(160,60,60,0.6);',
    accion: function(){ _ejecutarLimpiarRuta(); } });
  _modalPergamino({
    id: 'modal-confirm-limpiar',
    titulo: tl.limpiarTitulo || '¿Qué deseas limpiar?',
    cancelTxt: tl.cancelar || 'Cancelar',
    opciones: opciones
  });
}
function _actualizarBtnLimpiar() {
  var btnClr = document.getElementById('ruta-bar-btn-clear');
  if (!btnClr) return;
  var hayRuta = rutaPuntos.length > 0;
  var hayBusqueda = window._wizSearchMarkers && window._wizSearchMarkers.length > 0;
  if (hayRuta || hayBusqueda) {
    btnClr.style.display = 'block';
    btnClr.disabled = false;
  } else {
    btnClr.style.display = 'none';
  }
}
function _borrarSoloMemoria() {
  try { localStorage.removeItem('rutaGuardadaV2'); } catch(e) {}
  _actualizarBtnGuardarRestaurar();
  mostrarToast('🧹 Memoria borrada — ruta activa conservada');
}
function _ejecutarLimpiarRuta() {
  _verRutaMapa = false;
  try { localStorage.removeItem('rutaGuardadaV2'); } catch(e) {}
  _actualizarBtnRestauraRuta();
  try {
    if (_rutaLinea && typeof mapa !== 'undefined' && mapa) { mapa.removeLayer(_rutaLinea); _rutaLinea = null; }
  } catch(e) { _rutaLinea = null; }
  try {
    if (window._rutaFlechas) { window._rutaFlechas.forEach(function(m){ try{mapa.removeLayer(m);}catch(e){} }); window._rutaFlechas = []; }
  } catch(e) { window._rutaFlechas = []; }
  try {
    if (window._wizSearchMarkers) { window._wizSearchMarkers.forEach(function(m){ try{mapa.removeLayer(m);}catch(e){} }); window._wizSearchMarkers = []; }
  } catch(e) { window._wizSearchMarkers = []; }
  _actualizarBtnLimpiar();
  var btnVer=document.getElementById('ruta-bar-btn-ver');
  if(btnVer) btnVer.style.background='#185FA5';
  var panel=document.getElementById('map-ruta-panel');
  if(panel) { panel.style.display='flex'; panel.style.flexDirection='column'; }
  rutaPuntos=[];
  // Forzar reset de TODOS los botones directamente, sin depender de actualizarRuta
  var btnClrBar = document.getElementById('ruta-bar-btn-clear');
  if(btnClrBar) { btnClrBar.style.display='none'; btnClrBar.disabled=false; }
  var btnGoBar  = document.getElementById('ruta-bar-btn-go');
  if(btnGoBar)  { btnGoBar.style.opacity='0.5'; btnGoBar.style.cursor='default'; btnGoBar.disabled=true; }
  var btnNavBar = document.getElementById('ruta-nav-btn');
  if(btnNavBar) btnNavBar.style.display='none';
  _actualizarBtnGuardarRestaurar();
  var emptyEl   = document.getElementById('ruta-bar-empty');
  if(emptyEl) emptyEl.style.display='';
  var infoEl    = document.getElementById('ruta-bar-info');
  if(infoEl)  infoEl.style.display='none';
  var puntEl    = document.getElementById('ruta-bar-puntos');
  if(puntEl)  puntEl.innerHTML='';
  // Sync POI generator
  var statsEl = document.getElementById('poi-ruta-stats');
  var vaciaEl = document.getElementById('poi-ruta-vacia');
  var listaEl = document.getElementById('poi-ruta-lista2');
  var btnIr   = document.getElementById('poi-ruta-btn-ir');
  var btnClr2 = document.getElementById('poi-ruta-btn-clear');
  if (statsEl) statsEl.style.display = 'none';
  if (vaciaEl) vaciaEl.style.display = 'block';
  if (listaEl) { listaEl.style.display = 'none'; listaEl.innerHTML = ''; var t=document.getElementById('ruta-scroll-track');if(t)t.style.display='none'; }
  if (btnIr)   { btnIr.style.opacity = '0.4'; btnIr.style.cursor = 'default'; }
  if (btnClr2) { btnClr2.style.opacity = '0.4'; btnClr2.style.cursor = 'default'; }
  // Resetear visual de botones mpbtn- de popups del mapa
  try {
    var tl2=T[idiomaActual]||T.es;
    document.querySelectorAll('[id^="mpbtn-"]').forEach(function(btn){
      btn.style.background='#E1F5EE'; btn.style.color='#0F6E56';
      btn.innerHTML=tl2.añadirRutaCorto||'+ ruta';
    });
  } catch(e) {}
  try { actualizarRuta(); } catch(e) { console.warn('limpiarRuta: actualizarRuta falló', e); }
  try { actualizarBotonesRuta(); } catch(e) {}
  // Retomar vista centrada en posición del usuario con radio 1km
  try {
    if (typeof mapa !== 'undefined' && mapa) {
      radioKm = 1;
      _aplicarEstadoRadioBtns(1);
      if (typeof aplicarRadio === 'function') aplicarRadio(1);
      var lat = (typeof userLat !== 'undefined' && userLat) ? userLat : 42.2328;
      var lng = (typeof userLng !== 'undefined' && userLng) ? userLng : -8.7226;
      mapa.setView([lat, lng], 15, {animate: true});
    }
  } catch(e) {}
}

var _rutaLinea = null;

var _verRutaMapa = false;

function toggleVerRutaMapa() {
  if (rutaPuntos.length < 1) return;
  var btn = document.getElementById('ruta-bar-btn-ver');
  _verRutaMapa = !_verRutaMapa;
  if (_verRutaMapa) {
    if (btn) { btn.style.background = '#0a3d6b'; }
    dibujarLineaEstática();
    mostrarToast('🗺️ Ruta trazada');
  } else {
    if (btn) { btn.style.background = '#185FA5'; }
    if (_rutaLinea) { mapa.removeLayer(_rutaLinea); _rutaLinea = null; }
    mostrarToast('🗺️ Ruta ocultada');
  }
}


function ordenarRutaPorCercania(origen) {
  if (rutaPuntos.length < 2) return rutaPuntos.slice();
  var puntos = rutaPuntos.slice();
  var ordenados = [];
  var actual = { lat: origen.lat, lng: origen.lng };
  while (puntos.length > 0) {
    var minDist = Infinity, minIdx = 0;
    for (var i = 0; i < puntos.length; i++) {
      var d = haversine(actual.lat, actual.lng, puntos[i].lat, puntos[i].lng);
      if (d < minDist) { minDist = d; minIdx = i; }
    }
    ordenados.push(puntos[minIdx]);
    actual = puntos[minIdx];
    puntos.splice(minIdx, 1);
  }
  return ordenados;
}

function dibujarFlechas(latlngs) {
  if (window._rutaFlechas) {
    window._rutaFlechas.forEach(function(m){ mapa.removeLayer(m); });
  }
  window._rutaFlechas = [];
  // Espaciado adaptativo según zoom — más zoom = más flechas, menos zoom = menos
  var z = mapa.getZoom();
  var espaciado = z >= 17 ? 40 : z >= 15 ? 80 : z >= 13 ? 200 : z >= 11 ? 800 : z >= 9 ? 2500 : 6000;
  var acumulado = 0;
  // Pre-count total arrows for gradient
  var totalFlechas = 0, acum2 = 0;
  for (var j = 0; j < latlngs.length - 1; j++) {
    var aa = L.latLng(latlngs[j][0], latlngs[j][1]);
    var bb = L.latLng(latlngs[j+1][0], latlngs[j+1][1]);
    acum2 += aa.distanceTo(bb);
    if (acum2 >= espaciado) { totalFlechas++; acum2 = 0; }
  }
  var flechaIdx = 0;
  for (var i = 0; i < latlngs.length - 1; i++) {
    var a = L.latLng(latlngs[i][0], latlngs[i][1]);
    var b = L.latLng(latlngs[i+1][0], latlngs[i+1][1]);
    var segDist = a.distanceTo(b);
    acumulado += segDist;
    if (acumulado >= espaciado) {
      acumulado = 0;
      // Ángulo: Norte=0, Este=90 — Leaflet usa lat/lng
      var dLat = latlngs[i+1][0] - latlngs[i][0];
      var dLng = latlngs[i+1][1] - latlngs[i][1];
      // Convertir a bearing: ángulo desde el norte en sentido horario
      var bearing = Math.atan2(dLng * Math.cos(latlngs[i][0] * Math.PI/180), dLat) * 180 / Math.PI;
      var mid = [(latlngs[i][0]+latlngs[i+1][0])/2, (latlngs[i][1]+latlngs[i+1][1])/2];
      // Degradado: verde inicio → amarillo → naranja → rojo final
      var progreso = totalFlechas > 0 ? flechaIdx / totalFlechas : 0;
      var r, g, b;
      if (progreso < 0.33) {
        // Verde → Amarillo
        var t = progreso / 0.33;
        r = Math.round(34 + (255-34)*t);
        g = Math.round(197 + (215-197)*t);
        b = Math.round(94 * (1-t));
      } else if (progreso < 0.66) {
        // Amarillo → Naranja
        var t = (progreso - 0.33) / 0.33;
        r = 255;
        g = Math.round(215 - (215-140)*t);
        b = 0;
      } else {
        // Naranja → Rojo
        var t = (progreso - 0.66) / 0.34;
        r = 255;
        g = Math.round(140 * (1-t));
        b = 0;
      }
      var fill = 'rgb('+r+','+g+','+b+')';
      // Tamaño de flecha según zoom: más pequeña a zoom lejano para no saturar
      var sz = z >= 17 ? 20 : z >= 15 ? 18 : z >= 13 ? 14 : z >= 11 ? 11 : 9;
      var half = Math.round(sz / 2);
      var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="'+sz+'" height="'+sz+'" viewBox="0 0 20 20">' +
        '<polygon points="10,1 18,18 10,13 2,18" fill="'+fill+'" stroke="rgba(0,0,0,0.4)" stroke-width="1.2" stroke-linejoin="round"/>' +
        '</svg>';
      flechaIdx++;
      var arrow = L.marker(mid, {
        icon: L.divIcon({
          className: '',
          html: '<div style="transform:rotate('+bearing+'deg);transform-origin:center;width:'+sz+'px;height:'+sz+'px;filter:drop-shadow(0 1px 3px rgba(0,0,0,0.6))">'+svg+'</div>',
          iconSize: [sz, sz],
          iconAnchor: [half, half]
        }),
        interactive: false,
        zIndexOffset: 100
      }).addTo(mapa);
      window._rutaFlechas.push(arrow);
    }
  }
}

function dibujarLineaEstática() {
  if (_navActiva) return; // nunca interferir durante navegación activa
  if (_rutaLinea) { mapa.removeLayer(_rutaLinea); _rutaLinea = null; }
  if (window._rutaFlechas) { window._rutaFlechas.forEach(function(m){ mapa.removeLayer(m); }); window._rutaFlechas = []; }
  if (rutaPuntos.length < 1) return;
  // Ordenar puntos por proximidad (vecino más cercano desde posición usuario)
  var origen = (userLat && userLng) ? {lat:userLat, lng:userLng} : {lat:rutaPuntos[0].lat, lng:rutaPuntos[0].lng};
  var puntosOrdenados = ordenarRutaPorCercania(origen);
  var osrmCoords = puntosOrdenados.map(function(p){ return p.lng+','+p.lat; });
  if (userLat && userLng) osrmCoords.unshift(userLng+','+userLat);
  if (osrmCoords.length < 2) return; // línea ya borrada arriba, con 1 punto no hay trazado
  var endpoints = [
    'https://routing.openstreetmap.de/routed-foot/route/v1/foot/' + osrmCoords.join(';') + '?overview=full&geometries=geojson&steps=true',
    'https://router.project-osrm.org/route/v1/foot/' + osrmCoords.join(';') + '?overview=full&geometries=geojson&steps=true'
  ];
  _navOrdenadosCache = puntosOrdenados.slice(); // guardar orden para navegación
  function dibujarGeoJSON2(geojson) {
    if (_navActiva) return; // navegación activa: no sobreescribir línea verde
    if (_rutaLinea) { mapa.removeLayer(_rutaLinea); _rutaLinea = null; }
    var z = mapa.getZoom();
    var lineWeight = z >= 17 ? 6 : z >= 15 ? 5 : z >= 13 ? 4 : 3;
    _rutaLinea = L.geoJSON(geojson, {
      style: { color:'#FFD700', weight:lineWeight, opacity:0.9, dashArray:'14 6', lineJoin:'round', lineCap:'round' }
    }).addTo(mapa);
    // Dibujar flechas amarillas sobre la línea
    var coords = geojson.coordinates;
    if (coords && coords.length > 1) {
      var latlngs = coords.map(function(c){ return [c[1],c[0]]; });
      dibujarFlechas(latlngs);
    }
  }
  function fallback2() {
    if (_navActiva) return;
    // Sin conexión OSRM: trazar línea recta entre tu posición y los puntos,
    // pero CON las flechas de colores, para que offline también se vea el rumbo.
    var coords2 = [];
    if (userLat && userLng) coords2.push([userLat, userLng]);
    puntosOrdenados.forEach(function(p){ coords2.push([p.lat, p.lng]); });
    if (coords2.length < 2) { coords2 = rutaPuntos.map(function(p){ return [p.lat, p.lng]; }); }
    if (_rutaLinea) mapa.removeLayer(_rutaLinea);
    var z = mapa.getZoom();
    var lineWeight = z >= 17 ? 6 : z >= 15 ? 5 : z >= 13 ? 4 : 3;
    _rutaLinea = L.polyline(coords2, {color:'#FFD700',weight:lineWeight,opacity:0.85,dashArray:'14 6',lineJoin:'round',lineCap:'round'}).addTo(mapa);
    // Dibujar las flechas de colores sobre la línea recta
    if (coords2.length > 1) dibujarFlechas(coords2);
  }
  function intentar2(i) {
    // Sin conexión: no perder tiempo esperando OSRM, dibujar recta+flechas ya.
    if (typeof navigator !== 'undefined' && navigator.onLine === false) { fallback2(); return; }
    if (i >= endpoints.length) { fallback2(); return; }
    fetch(endpoints[i]).then(function(r){ return r.json(); })
      .then(function(data) {
        if (data.routes && data.routes[0]) {
          // Cachear pasos y geometría para navegación por voz
          _navPasosCache = [];
          window._navGeomCache = data.routes[0].geometry;
          data.routes[0].legs.forEach(function(leg) {
            leg.steps.forEach(function(step) {
              var man = step.maneuver;
              _navPasosCache.push({
                tipo: man.type + (man.modifier ? '-' + man.modifier : ''),
                calle: step.name || '',
                distancia: step.distance,
                lat: man.location[1],
                lng: man.location[0]
              });
            });
          });
          dibujarGeoJSON2(data.routes[0].geometry);
        }
        else intentar2(i+1);
      }).catch(function(){ intentar2(i+1); });
  }
  intentar2(0);
}

function actualizarLineaRuta() {
  if (_rutaLinea) { mapa.removeLayer(_rutaLinea); _rutaLinea = null; }
  if (!_modoSeguimiento || rutaPuntos.length < 1) {
    if (window._rutaFlechas) { window._rutaFlechas.forEach(function(m){ mapa.removeLayer(m); }); window._rutaFlechas = []; }
    return;
  }
  // Ordenar puntos por proximidad desde posición usuario
  var origen2 = (userLat && userLng) ? {lat:userLat, lng:userLng} : {lat:rutaPuntos[0].lat, lng:rutaPuntos[0].lng};
  var puntosOrd2 = ordenarRutaPorCercania(origen2);
  var osrmCoords = puntosOrd2.map(function(p){ return p.lng+','+p.lat; });
  if (userLat && userLng) osrmCoords.unshift(userLng+','+userLat);
  if (osrmCoords.length < 2) return;
  // Intentar varios servidores OSRM con perfil a pie
  var endpoints = [
    'https://routing.openstreetmap.de/routed-foot/route/v1/foot/' + osrmCoords.join(';') + '?overview=full&geometries=geojson&steps=true',
    'https://router.project-osrm.org/route/v1/foot/' + osrmCoords.join(';') + '?overview=full&geometries=geojson&steps=true'
  ];
  _navOrdenadosCache = puntosOrdenados.slice(); // guardar orden para navegación

  function dibujarGeoJSON(geojson) {
    if (_rutaLinea) { mapa.removeLayer(_rutaLinea); _rutaLinea = null; }
    _rutaLinea = L.geoJSON(geojson, {
      style: { color:'#185FA5', weight:4, opacity:0.85, dashArray:'12 6', lineJoin:'round' }
    }).addTo(mapa);
  }

  function fallbackLinea() {
    var coords2 = [];
    if (userLat && userLng) coords2.push([userLat, userLng]);
    rutaPuntos.forEach(function(p){ coords2.push([p.lat, p.lng]); });
    if (_rutaLinea) mapa.removeLayer(_rutaLinea);
    _rutaLinea = L.polyline(coords2, {color:'#185FA5',weight:3,opacity:0.7,dashArray:'10 8'}).addTo(mapa);
  }

  function intentarEndpoint(i) {
    if (i >= endpoints.length) { fallbackLinea(); return; }
    fetch(endpoints[i])
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data.routes && data.routes[0]) {
          dibujarGeoJSON(data.routes[0].geometry);
        } else {
          intentarEndpoint(i + 1);
        }
      })
      .catch(function() { intentarEndpoint(i + 1); });
  }

  intentarEndpoint(0);
}

// Cuando un POI está en la ruta activa, lo sacamos del grupo de clustering
// para que aparezca siempre como marcador individual, sin fundirse con la
// burbuja de POIs vecinos cercanos.
function _sincMarcadoresRuta() {
  if (!window._cluster || typeof mapa === 'undefined' || !mapa || typeof PUNTOS === 'undefined') return;
  // Si los marcadores aún se están creando (troceado), esperar a que terminen
  // para no operar sobre un conjunto incompleto y dejar POIs fuera del cluster.
  if (!window._marcadoresListos) {
    window.addEventListener('marcadores-listos', function _once(){
      window.removeEventListener('marcadores-listos', _once);
      _sincMarcadoresRuta();
    });
    return;
  }
  var idsRuta = {};
  rutaPuntos.forEach(function(p){ idsRuta[p.id] = true; });
  PUNTOS.forEach(function(p) {
    if (!p.marker) return;
    var enRuta = !!idsRuta[p.id];
    if (enRuta) {
      if (window._cluster.hasLayer(p.marker)) window._cluster.removeLayer(p.marker);
      if (!mapa.hasLayer(p.marker)) p.marker.addTo(mapa);
    } else {
      if (mapa.hasLayer(p.marker) && !window._cluster.hasLayer(p.marker)) mapa.removeLayer(p.marker);
      if (!window._cluster.hasLayer(p.marker)) window._cluster.addLayer(p.marker);
    }
  });
  if (window._cluster && typeof window._cluster.refreshClusters === 'function') {
    try { window._cluster.refreshClusters(); } catch(e){}
  }
  // Al repintar todos los POI, el filtro real pasa a ser "Todos": sincronizar
  // el chip activo del carrusel para que el color no se quede en el filtro previo.
  var _chipTodos = document.getElementById('chip-mapa-todos');
  if (_chipTodos) {
    document.querySelectorAll('#mapa-cat-bar .mapa-cat-chip').forEach(function(b){
      var activo = b === _chipTodos;
      b.style.background = activo ? 'linear-gradient(135deg,#2d4a1e,#1e3212)' : 'rgba(255,245,210,0.85)';
      b.style.color = activo ? '#f5e6c8' : '#3d2000';
      b.style.borderColor = activo ? '#1a2e0f' : '#a07828';
      b.style.fontWeight = activo ? '600' : '500';
      b.style.boxShadow = activo ? '0 1px 4px rgba(0,0,0,0.3)' : 'none';
    });
  }
}

function actualizarRuta() {
  _sincMarcadoresRuta();
  actualizarLineaRuta();
  var panel = document.getElementById('map-ruta-panel');
  var empty  = document.getElementById('ruta-bar-empty');
  var info   = document.getElementById('ruta-bar-info');
  var distEl = document.getElementById('ruta-bar-dist');
  var timeEl = document.getElementById('ruta-bar-time');
  var puntEl = document.getElementById('ruta-bar-puntos');
  var btnGo  = document.getElementById('ruta-bar-btn-go');
  var btnClr = document.getElementById('ruta-bar-btn-clear');
  if (rutaPuntos.length === 0) {
    // El panel permanece visible siempre; solo ajustamos estado de botones
    if(panel) { panel.style.display='flex'; panel.style.flexDirection='column'; }
    if(empty) empty.style.display = '';
    if(info) info.style.display  = 'none';
    var countEl0=document.getElementById('ruta-bar-count'); if(countEl0) countEl0.textContent='0 \uD83D\uDCCD';
    var distEl0=document.getElementById('ruta-bar-dist'); if(distEl0) distEl0.textContent='0 km';
    var timeEl0=document.getElementById('ruta-bar-time'); if(timeEl0) timeEl0.textContent='0 min';
    if(btnGo) { btnGo.style.opacity='0.5'; btnGo.style.cursor='default'; btnGo.disabled=true; }
    if(btnClr){ btnClr.style.display='none'; btnClr.disabled=true; }
    var btnNav=document.getElementById('ruta-nav-btn');if(btnNav)btnNav.style.display='none';
    _actualizarBtnGuardarRestaurar();
    var btnMapaPoi2=document.getElementById('poi-ruta-btn-mapa');if(btnMapaPoi2)btnMapaPoi2.style.opacity='0.4';
    // Limpiar también el generador de ruta POI
    var statsEl0=document.getElementById('poi-ruta-stats');if(statsEl0)statsEl0.style.display='none';
    var vaciaEl0=document.getElementById('poi-ruta-vacia');if(vaciaEl0)vaciaEl0.style.display='block';
    var listaEl0=document.getElementById('poi-ruta-lista2');if(listaEl0){listaEl0.style.display='none';listaEl0.innerHTML='';}
    var btnIr0=document.getElementById('poi-ruta-btn-ir');if(btnIr0){btnIr0.style.opacity='0.4';btnIr0.style.cursor='default';}
    var btnClrPoi0=document.getElementById('poi-ruta-btn-clear');if(btnClrPoi0){btnClrPoi0.style.opacity='0.4';btnClrPoi0.style.cursor='default';}
    actualizarBotonesRuta(); return;
  }
  empty.style.display = 'none';
  if(info) info.style.display  = 'flex';

  var distTotal = 0;
  // Si tenemos ubicación del usuario, añadir distancia hasta el primer punto
  if (userLat && rutaPuntos.length > 0) {
    distTotal += haversine(userLat, userLng, rutaPuntos[0].lat, rutaPuntos[0].lng);
  }
  rutaPuntos.forEach(function(p, i) {
    if (i > 0) distTotal += haversine(rutaPuntos[i-1].lat, rutaPuntos[i-1].lng, p.lat, p.lng);
  });
  var tMin = Math.round(distTotal / 4 * 60);
  distEl.textContent = distTotal < 1 ? Math.round(distTotal*1000)+' m' : distTotal.toFixed(1)+' km';
  var countEl = document.getElementById('ruta-bar-count');
  if (countEl) countEl.textContent = rutaPuntos.length + ' 📍';

  // Sync mini route box in POI section
  var statsEl = document.getElementById('poi-ruta-stats');
  var vaciaEl = document.getElementById('poi-ruta-vacia');
  var listaEl = document.getElementById('poi-ruta-lista2');
  var btnIr   = document.getElementById('poi-ruta-btn-ir');
  var btnClrPoi = document.getElementById('poi-ruta-btn-clear');
  var cnt2    = document.getElementById('poi-ruta-count');
  var dst2    = document.getElementById('poi-ruta-dist2');
  var tim2    = document.getElementById('poi-ruta-time2');

  if (rutaPuntos.length === 0) {
    if (statsEl)  { statsEl.style.display  = 'none'; }
    if (vaciaEl)  { vaciaEl.style.display  = 'block'; }
    if (listaEl)  { listaEl.style.display  = 'none'; }
    if (btnIr)    { btnIr.style.opacity  = '0.4'; btnIr.style.cursor  = 'default'; }
    if (btnClrPoi){ btnClrPoi.style.opacity = '0.4'; btnClrPoi.style.cursor = 'default'; }
  } else {
    if (statsEl)  { statsEl.style.display  = 'flex'; }
    if (vaciaEl)  { vaciaEl.style.display  = 'none'; }
    if (listaEl)  { listaEl.style.display  = 'flex';
      listaEl.innerHTML = rutaPuntos.map(function(p, i) {
        return '<div style="display:flex;align-items:center;gap:8px;font-size:14px;padding:4px 8px;background:var(--fondo);border-radius:8px">' +
          '<span style="width:18px;height:18px;border-radius:50%;background:var(--verde);color:#fff;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0">'+(i+1)+'</span>' +
          '<span style="flex:1;font-weight:500;color:var(--texto)">'+p.nombre+'</span>' +
          '</div>';
      }).join('');
      var track=document.getElementById('ruta-scroll-track');
      if(track) track.style.display=rutaPuntos.length>5?'block':'none';
    }
    if (btnIr)    { btnIr.style.opacity  = '1'; btnIr.style.cursor  = 'pointer'; }
    var btnMapa=document.getElementById('poi-ruta-btn-mapa');if(btnMapa){btnMapa.style.opacity='1';btnMapa.style.cursor='pointer';}
    if (btnClrPoi){ btnClrPoi.style.opacity = '1'; btnClrPoi.style.cursor = 'pointer'; }
    if (cnt2) cnt2.textContent = rutaPuntos.length + ' 📍';
    if (dst2) dst2.textContent = distEl ? distEl.textContent : '';
    if (tim2) tim2.textContent = timeEl ? timeEl.textContent : '';
  }
  if(timeEl) timeEl.textContent = tMin >= 60 ? Math.floor(tMin/60)+'h '+(tMin%60)+'min' : tMin+' min';
  if(puntEl) { puntEl.innerHTML = '';
  rutaPuntos.forEach(function(p, i) {
    var pill = document.createElement('span');
    pill.className = 'ruta-bar-punto';
    var shortName = p.nombre.split(' ').slice(0,3).join(' ');
    pill.innerHTML = '<span>'+(i+1)+'. '+shortName+'</span>'+
      '<button class="ruta-pill-del" data-rid="'+p.id+'" onclick="rutaPillDel(this)">&#x2715;</button>';
    puntEl.appendChild(pill);
  }); }
  if(btnGo)  { btnGo.disabled  = rutaPuntos.length < 2; }
  if(btnClr) { btnClr.disabled = false; btnClr.style.display='block'; }
  var btnNavEl=document.getElementById('ruta-nav-btn');if(btnNavEl&&!_navActiva){btnNavEl.style.display='block';}
  _sincronizarBtnGuardar();
  actualizarBotonesRuta();
  // Auto-dibujar siempre que hay puntos
  if (rutaPuntos.length >= 1) { setTimeout(dibujarLineaEstática, 150); }
  else if (_rutaLinea) { mapa.removeLayer(_rutaLinea); _rutaLinea = null; }
}
function actualizarBotonesRuta() {
  // Tarjetas POI sección — solo actualizar si el estado cambió
  document.querySelectorAll('.poi-ruta-btn').forEach(function(btn){
    var id=btn.getAttribute('data-poi');
    var enRuta=!!rutaPuntos.find(function(x){return x.id===id;});
    var yaActivo = btn.classList.contains('en-ruta');
    if (enRuta === yaActivo) return; // sin cambio — no tocar el DOM
    btn.classList.toggle('en-ruta', enRuta);
    var _tl=T[idiomaActual]||T.es; btn.textContent = enRuta ? _tl.enRuta||'✓ En ruta' : _tl.añadirRuta||'+ Añadir a ruta';
    btn.style.background = enRuta ? '#1D9E75' : 'rgba(255,255,255,0.92)';
    btn.style.color      = enRuta ? '#fff'    : '#0F6E56';
    btn.style.border     = enRuta ? '1px solid #1D9E75' : '1px solid rgba(29,158,117,0.4)';
  });
  // Botones popup del mapa (mpbtn-)
  document.querySelectorAll('[id^="mpbtn-"]').forEach(function(btn){
    var id=btn.id.replace('mpbtn-','');
    var enRuta=!!rutaPuntos.find(function(x){return x.id===id;});
    var tl=T[idiomaActual]||T.es;
    btn.style.background = enRuta ? '#1D9E75' : '#E1F5EE';
    btn.style.color      = enRuta ? '#fff'    : '#0F6E56';
    btn.innerHTML        = enRuta ? '&#10003; '+tl.enRuta.replace('✓ ','') : (tl.añadirRutaCorto||'+ ruta');
  });
}
function irAlMapaConRuta() {
  if (rutaPuntos.length < 1) return;
  // Ir a sección mapa y activar línea
  var mb = document.getElementById('map-block');
  if (mb) mb.scrollIntoView({behavior:'smooth', block:'start'});
  setTimeout(function() {
    _verRutaMapa = true;
    dibujarLineaEstática();
  }, 600);
}


function guardarRuta() {
  if (rutaPuntos.length === 0) return;
  try {
    // Formato nuevo: { puntos, sim }. Si la ruta se está creando en modo
    // simulación, guardamos también el punto rojo de origen, para poder
    // regenerarla luego desde el mismo lugar.
    var payload = { puntos: rutaPuntos, sim: null };
    if (window._simulacion && typeof userLat !== 'undefined' && userLat && typeof userLng !== 'undefined' && userLng) {
      payload.sim = { lat: userLat, lng: userLng };
    }
    localStorage.setItem('rutaGuardadaV2', JSON.stringify(payload));
    _actualizarBtnRestauraRuta();
    var btn = document.getElementById('btn-guardar-restaurar');
    if (btn) { btn.style.background='#4f46e5'; btn.textContent='✅'; }
    setTimeout(function() { _actualizarBtnGuardarRestaurar(); }, 2000);
    var tC = T[idiomaActual] || T.es;
    _modalPergamino({
      id: 'modal-ruta-guardada',
      titulo: tC.guardandoRuta || 'Ruta guardada ✓',
      subtitulo: tC.guardandoRutaSub || 'Esta guía es gratuita y sin publicidad. Solo el apoyo de peregrinos como tú hace posible que siga creciendo. 🙏',
      xCerrar: true,
      opciones: [
        { emoji:'💚', tit: tC.asistApoyo || 'Apoyar la guía',
          colorTit:'#1a3d12',
          estilo:'background:linear-gradient(135deg,rgba(45,74,30,0.35),rgba(30,50,18,0.35));border:1.5px solid #5a8040;',
          accion: function(){ abrirDonacionesDrawer(); } }
      ]
    });
  } catch(e) { mostrarToast('\u26a0\ufe0f No se pudo guardar'); }
}

function cargarRutaGuardada(restaurarSim) {
  try {
    var saved = localStorage.getItem('rutaGuardadaV2');
    if (!saved) return;
    var parsed = JSON.parse(saved);
    // Compatibilidad: formato antiguo = array suelto; nuevo = { puntos, sim }
    var puntos, simOrigen = null;
    if (Array.isArray(parsed)) { puntos = parsed; }
    else { puntos = parsed.puntos || []; simOrigen = parsed.sim || null; }
    if (!puntos || puntos.length === 0) return;
    // Si la ruta se guardó en simulación y se pide restaurar su contexto
    // (restauración explícita con el botón ↩), recolocamos el punto rojo de
    // origen ANTES de dibujar la ruta, para que se regenere desde el mismo
    // lugar donde se creó. En el arranque normal (restaurarSim falsy) NO se
    // entra en simulación: solo se cargan los puntos.
    if (restaurarSim && simOrigen && simOrigen.lat != null && simOrigen.lng != null
        && typeof _simColocar === 'function' && typeof mapa !== 'undefined' && mapa) {
      _simColocar(simOrigen.lat, simOrigen.lng, true);
    }
    // Enriquecer con datos actuales del array PUNTOS si están disponibles
    rutaPuntos = puntos.map(function(p) {
      var full = PUNTOS.find(function(x){ return x.id === p.id; });
      return full || p;
    });
    // Reinsertar puntos de búsqueda en PUNTOS para que la ruta funcione
    rutaPuntos.forEach(function(p) {
      if (p.categoria === 'busqueda' && !PUNTOS.find(function(x){ return x.id === p.id; })) {
        PUNTOS.push(p);
      }
    });
    actualizarRuta();
    // Recrear marcadores en el mapa para los puntos de búsqueda
    var iconoBusc = (typeof iconoBusqueda !== 'undefined') ? iconoBusqueda
      : L.divIcon({ html:'<div style="background:#DC2626;color:#fff;width:32px;height:32px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.25)"><span style="transform:rotate(45deg);font-size:16px">🔍</span></div>', className:'', iconSize:[32,32], iconAnchor:[16,32], popupAnchor:[0,-32] });
    if (!window._wizSearchMarkers) window._wizSearchMarkers = [];
    rutaPuntos.forEach(function(p) {
      if (p.categoria !== 'busqueda' || !p.lat || !p.lng) return;
      var mk = L.marker([p.lat, p.lng], { icon: iconoBusc }).addTo(mapa);
      mk.bindPopup('<div style="font-family:DM Sans,sans-serif;min-width:160px"><strong>' + esc(p.nombre) + '</strong><br><div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap"><button onclick="_toggleBusquedaRuta(this,encodeURIComponent(\'' + escAttr(p.nombre).replace(/'/g,"\\'") + '\'),' + p.lat + ',' + p.lng + ');" style="background:#E1F5EE;color:#0F6E56;border:1px solid rgba(29,158,117,0.4);padding:5px 12px;border-radius:12px;font-size:12px;font-weight:600;cursor:pointer;font-family:DM Sans,sans-serif">➕ Añadir a ruta</button><button onclick="irACoordenadasNav(' + p.lat + ',' + p.lng + ')" style="background:#1D9E75;color:#fff;border:none;padding:5px 12px;border-radius:12px;font-size:12px;cursor:pointer;font-family:DM Sans,sans-serif">🗺️ Cómo llegar</button></div></div>');
      window._wizSearchMarkers.push(mk);
    });
    mostrarToast('📍 Ruta restaurada (' + rutaPuntos.length + ' puntos)');
    _actualizarBtnRestauraRuta();
  } catch(e) { console.warn('Error cargando ruta:', e); }
}


function _actualizarBtnRestauraRuta() { _actualizarBtnGuardarRestaurar(); }
function _sincronizarBtnGuardar()     { _actualizarBtnGuardarRestaurar(); }
function _actualizarBtnGuardarRestaurar() {
  var btn = document.getElementById('btn-guardar-restaurar');
  if (!btn) return;
  if (_navActiva) { btn.style.display = 'none'; return; }
  var hayActiva = (typeof rutaPuntos !== 'undefined') && rutaPuntos.length > 0;
  var hayGuardada = false;
  try { hayGuardada = !!localStorage.getItem('rutaGuardadaV2'); } catch(e) {}
  if (hayGuardada) {
    // Modo restaurar: siempre visible, verde
    btn.style.display = 'flex';
    btn.style.background = '#059669';
    btn.style.border = '2px solid rgba(255,255,255,0.3)';
    btn.textContent = '↩';
    btn.title = 'Restaurar última ruta guardada';
    btn._modo = 'restaurar';
  } else if (hayActiva) {
    // Modo guardar: visible solo si hay puntos
    btn.style.display = 'flex';
    btn.style.background = '#6366f1';
    btn.style.border = '2px solid rgba(255,255,255,0.3)';
    btn.textContent = '💾';
    btn.title = 'Guardar ruta';
    btn._modo = 'guardar';
  } else {
    btn.style.display = 'none';
    btn._modo = '';
  }
}
function _accionGuardarRestaurar() {
  // Leer estado real en el momento del click, sin depender de _modo
  var hayGuardada = false;
  try { hayGuardada = !!localStorage.getItem('rutaGuardadaV2'); } catch(e) {}
  if (hayGuardada) { _restaurarRutaGuardada(); }
  else { guardarRuta(); }
}
function _restaurarRutaGuardada() {
  if (typeof rutaPuntos !== 'undefined' && rutaPuntos.length > 0) {
    _ejecutarLimpiarRutaSoloMapa();
  }
  cargarRutaGuardada(true); // true → si la ruta era simulada, recoloca el punto rojo
  _actualizarBtnRestauraRuta();
}
function _ejecutarLimpiarRutaSoloMapa(silencioso) {
  _verRutaMapa = false;
  try { if (_rutaLinea && mapa) { mapa.removeLayer(_rutaLinea); _rutaLinea = null; } } catch(e) { _rutaLinea = null; }
  try { if (window._rutaFlechas) { window._rutaFlechas.forEach(function(m){ try{mapa.removeLayer(m);}catch(e){}; }); window._rutaFlechas = []; } } catch(e) {}
  try { if (window._wizSearchMarkers) { window._wizSearchMarkers.forEach(function(m){ try{mapa.removeLayer(m);}catch(e){}; }); window._wizSearchMarkers = []; } } catch(e) {}
  _actualizarBtnLimpiar();
  rutaPuntos = [];
  var btnClrBar = document.getElementById('ruta-bar-btn-clear'); if(btnClrBar){ btnClrBar.style.display='none'; btnClrBar.disabled=false; }
  var btnNavBar = document.getElementById('ruta-nav-btn'); if(btnNavBar) btnNavBar.style.display='none';
  _actualizarBtnGuardarRestaurar();
  var panel=document.getElementById('map-ruta-panel'); if(panel){ panel.style.display='flex'; panel.style.flexDirection='column'; }
  // Resetear visual de todos los botones mpbtn- de popups del mapa
  try {
    var tl=T[idiomaActual]||T.es;
    document.querySelectorAll('[id^="mpbtn-"]').forEach(function(btn){
      btn.style.background='#E1F5EE'; btn.style.color='#0F6E56';
      btn.innerHTML=tl.añadirRutaCorto||'+ ruta';
    });
  } catch(e) {}
  try { actualizarRuta(); } catch(e) {}
  try { actualizarBotonesRuta(); } catch(e) {}
  _actualizarBtnRestauraRuta();
  if (!silencioso) mostrarToast('🗺️ Mapa limpiado — ruta guardada disponible');
}
// ═══════════════════════════════════════════════
//  NAVEGACIÓN POR VOZ CON OSRM
// ═══════════════════════════════════════════════
var _navActiva = false;
var _navVozActiva = false; // voz apagada por defecto
var _navPasos = [];
var _navPasosCache = []; // pasos guardados por dibujarLineaEstática
var _navOrdenadosCache = []; // orden de puntos guardado        // pasos OSRM [{instruccion, distancia, lat, lng}]
var _navPasoActual = 0;
var _navWatchId = null;
var _navWakeLock = null;
var _navAnunciado = {};    // evitar repetir el mismo anuncio
var _navVoz = null;

function hablar(texto) {
  if (!window.speechSynthesis) return;
  if (_navActiva && !_navVozActiva) return; // voz desactivada durante navegación
  window.speechSynthesis.cancel();
  var u = new SpeechSynthesisUtterance(texto);
  // Elegir voz en el idioma activo
  var lang = idiomaActual === 'en' ? 'en' : idiomaActual === 'gl' ? 'gl-ES' : 'es-ES';
  u.lang = lang;
  u.rate = 0.95;
  u.pitch = 1;
  // Intentar voz local preferida
  var voces = window.speechSynthesis.getVoices();
  var voz = voces.find(function(v){ return v.lang.startsWith(lang.substring(0,2)) && v.localService; })
         || voces.find(function(v){ return v.lang.startsWith(lang.substring(0,2)); });
  if (voz) u.voice = voz;
  window.speechSynthesis.speak(u);
}

function traducirManiobra(tipo, nombre) {
  var t = T[idiomaActual] || T.es;
  var calle = nombre ? ('" ' + nombre + '"') : '';
  var mapa_man = {
    'turn-left':        (t.navGiraIzq   || 'Gira a la izquierda') + calle,
    'turn-right':       (t.navGiraDer   || 'Gira a la derecha') + calle,
    'turn-slight-left': (t.navLigIzq    || 'Gira ligeramente a la izquierda') + calle,
    'turn-slight-right':(t.navLigDer    || 'Gira ligeramente a la derecha') + calle,
    'turn-sharp-left':  (t.navFuerteIzq || 'Gira fuerte a la izquierda') + calle,
    'turn-sharp-right': (t.navFuerteDer || 'Gira fuerte a la derecha') + calle,
    'uturn':            (t.navMedia     || 'Da media vuelta'),
    'roundabout':       (t.navRota      || 'Toma la rotonda') + calle,
    'straight':         (t.navRecto     || 'Continúa recto') + calle,
    'depart':           (t.navSalida    || 'Inicia la ruta') + calle,
    'arrive':           (t.navLlegada   || 'Has llegado a tu destino')
  };
  return mapa_man[tipo] || ((t.navDirigete || 'Dirígete hacia') + calle);
}

function distanciaTexto(m) {
  var tn = T[idiomaActual]||T.es;
  if (m < 50)   return null; // demasiado cerca, no anunciar
  if (m < 100)  return tn.nav50m  ||'50 metros';
  if (m < 200)  return tn.nav100m ||'100 metros';
  if (m < 400)  return tn.nav200m ||'200 metros';
  if (m < 800)  return tn.nav400m ||'400 metros';
  if (m < 1500) return tn.nav1km  ||'1 kilómetro';
  return Math.round(m/1000) + (tn.navKms||' kilómetros');
}

function activarNavegacionVoz() {
  // En modo simulación la navegación por voz real (GPS) no tiene sentido: el
  // usuario está sobre un punto ficticio. Avisamos con un modal y ofrecemos
  // salir de la simulación. Cubre TODAS las vías de entrada a la navegación.
  if (window._simulacion) {
    var _ts = T[idiomaActual] || T.es;
    _modalPergamino({
      id: 'modal-nav-en-simulacion',
      titulo: _ts.navSimTit || 'La navegación por voz no está disponible mientras simulas tu posición. Sal de la simulación para iniciar la navegación real con tu GPS.',
      cancelTxt: _ts.navSimOk || 'Entendido',
      opciones: [
        { emoji:'🧪', tit: _ts.navSimSalir || 'Salir de la simulación',
          sub: _ts.navSimSalirSub || 'Vuelve a tu posición real',
          colorTit:'#7a1a1a', colorSub:'rgba(140,50,50,0.85)',
          estilo:'background:rgba(120,30,30,0.18);border:1.5px solid rgba(160,60,60,0.6);',
          accion: function(){
            var ov = document.getElementById('modal-nav-en-simulacion'); if (ov) ov.remove();
            if (typeof _salirSimulacion === 'function') _salirSimulacion();
          } }
      ]
    });
    return;
  }
  if(_bloquearSiLejos())return;
  if (typeof _ocultarBtnComenzarNav==='function') _ocultarBtnComenzarNav();
  if (rutaPuntos.length < 1) { mostrarToast((T[idiomaActual]||T.es).navAnnadePunto||'Añade al menos 1 punto a la ruta'); return; }
  // --- Sin motor de routing offline ---
  // Si no hay red y no tenemos pasos cacheados de una sesión online previa,
  // es imposible calcular turn-by-turn (OSRM necesita conexión). En vez de
  // fallar, conservamos la guía estática que ya pinta dibujarLineaEstática()/
  // fallback2() —línea amarilla + flechas + chincheta violeta— y avisamos al
  // usuario, SIN entrar en navegación por voz: no tocamos _navActiva ni
  // pausamos Ruta Oficial, así el estado queda limpio.
  if (typeof navigator!=='undefined' && navigator.onLine===false && (!_navPasosCache || _navPasosCache.length === 0)) {
    if (typeof dibujarLineaEstática==='function') dibujarLineaEstática();
    mostrarToast((T[idiomaActual]||T.es).navOfflineGuia||'Modo sin conexión · sigue la línea para alcanzar el destino');
    // Offline no hay turn-by-turn, pero sí podemos darte rumbo: activamos la
    // brújula (triángulo azul sobre tu punto) lanzando el permiso de orientación
    // DENTRO de este gesto del usuario (iOS lo exige). Solo si no estaba ya
    // activa, para no apagarla con el propio toggle de pedirOrientacion().
    if (!window._orientacionActiva){
      if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function' && window._orientacionConcedida !== true){
        mostrarToast((T[idiomaActual]||T.es).navBrujulaActivar||'Modo sin conexión · sigue la línea para alcanzar el destino');
      } else if (typeof pedirOrientacion==='function'){
        pedirOrientacion();
      }
    }
    return;
  }
  // Pausar Ruta Oficial mientras dura la navegación
  if (window.RutaOficial && window.RutaOficial.estaActivo()) {
    window._rutaOficialPausada = true;
    window.RutaOficial.desactivar();
  } else {
    window._rutaOficialPausada = false;
  }

  // Ordenar puntos por cercanía al usuario
  var origen = (userLat && userLng) ? {lat:userLat, lng:userLng} : {lat:rutaPuntos[0].lat, lng:rutaPuntos[0].lng};
  var ordenados = ordenarRutaPorCercania(origen);

  // Guard: si la ruta quedó vacía o el primer punto es nulo/corrupto
  // (restauración incompleta, punto sin datos), abortamos limpiamente
  // ANTES de tocar la UI o activar el GPS. Evita el crash
  // "undefined is not an object (evaluating 'primerPunto.nombre')".
  if (!ordenados.length || !ordenados[0] || !ordenados[0].nombre) {
    mostrarToast((T[idiomaActual]||T.es).navAnnadePunto||'Añade al menos 1 punto a la ruta');
    return;
  }

  // Construir waypoints para OSRM
  var coords = [];
  if (userLat && userLng) coords.push(userLng + ',' + userLat);
  ordenados.forEach(function(p){ coords.push(p.lng + ',' + p.lat); });
  mostrarToast('🗺️ Iniciando navegación...');
  if (window._navRestoreTimeout) { clearTimeout(window._navRestoreTimeout); window._navRestoreTimeout = null; }
  _navActiva = true; // bloquear dibujarLineaEstática desde ya
  var _btnCascoNav = document.getElementById('btn-asistente-mapa'); if (_btnCascoNav) _btnCascoNav.style.display = 'none';


  // Función interna que activa la navegación con los pasos dados
  function _iniciarConPasos(pasos) {
    _navPasos = pasos;
    _navPasoActual = 0;
    _navAnunciado = {};

    // UI: ocultar IR, mostrar STOP
    var btnIr   = document.getElementById('ruta-nav-btn');
    var btnStop = document.getElementById('ruta-nav-stop');
    var btnClr  = document.getElementById('ruta-bar-btn-clear');
    if (btnIr)   btnIr.style.display   = 'none';
    if (btnStop) btnStop.style.display = 'block';
    var btnVoz = document.getElementById('ruta-nav-voz');
    if (btnVoz) { _navVozActiva = false; btnVoz.style.display = 'block'; btnVoz.style.background = '#444'; btnVoz.innerHTML = (T[idiomaActual]||T.es).navVozOff||'🔇 Voz'; }
    if (btnClr)  btnClr.style.display  = 'none';
    var btnGR = document.getElementById('btn-guardar-restaurar'); if (btnGR) btnGR.style.display = 'none';

    // Agrandar mapa sin cambiar position (no destruye Leaflet)
    var mapEl = document.getElementById('map');
    if (mapEl) { mapEl._origHeight = mapEl.style.height; mapEl.style.height = '100dvh'; }
    var mapTitleBlock = document.querySelector('.map-title-block');
    if (mapTitleBlock) { mapTitleBlock._origDisplay = mapTitleBlock.style.display; mapTitleBlock.style.display = 'none'; }
    var searchUnder = document.querySelector('.search-under-map');
    if (searchUnder) { searchUnder._origDisplay = searchUnder.style.display; searchUnder.style.display = 'none'; }

    // Scroll al mapa
    var mapBlock = document.getElementById('map-block');
    if (mapBlock) mapBlock.scrollIntoView({behavior:'smooth', block:'start'});

    // Ocultar botones del mapa salvo brújula
    _actualizarBtnGuardarRestaurar();
    // Mover brújula al panel de ruta
    var btnOrMap = document.getElementById('btn-brujula-mapa');
    if (btnOrMap) btnOrMap.style.display = 'none';
    var btnOrPanel = document.getElementById('ruta-nav-orientacion');
    if (btnOrPanel) btnOrPanel.style.display = 'block';
    ['btn-add-poi-map','map-radio-control','btn-alertas-toggle','btn-sos-mapa','btn-meteo-mapa','btn-buscar-mapa','btn-poi-drawer-mapa','btn-expandir-mapa','btn-ruta-oficial','btn-descargar-mapa','btn-simular-mapa'].forEach(function(id){
      var el=document.getElementById(id); if(el) el.style.display='none';
    });

    ['ruta-bar-count','ruta-bar-dist','ruta-bar-time'].forEach(function(id){
      var el=document.getElementById(id); if(el) el.style.display='none';
    });

    // Bloquear interacción
    mapa.dragging.disable();
    mapa.touchZoom.disable();
    mapa.scrollWheelZoom.disable();
    mapa.doubleClickZoom.disable();
    mapa.boxZoom.disable();
    mapa.keyboard.disable();
    window._navBloqPopups = true;

    // Centrar en usuario
    if (userLat && userLng) mapa.setView([userLat, userLng], 18, {animate:true});

    // Wake Lock
    if (navigator.wakeLock) {
      navigator.wakeLock.request('screen').then(function(wl){ _navWakeLock = wl; }).catch(function(){});
    }

    // Anuncio primer punto
    var primerPunto = ordenados[0];
    hablar(((T[idiomaActual]||T.es).navIniciadaMsg||'Navegación iniciada. Dirígete hacia ') + primerPunto.nombre);

    // Iniciar GPS
    if (window._navWatchId) navigator.geolocation.clearWatch(window._navWatchId);
    window._navWatchId = navigator.geolocation.watchPosition(
      function(pos) { _navTick(pos); },
      function() {},
      {enableHighAccuracy:true, maximumAge:1500, timeout:10000}
    );

    mostrarToast('🔇 Navegación activa · voz desactivada');
    // (La vigilancia de desvío vive SOLO en el Modo Ruta Oficial)
  }  // fin _iniciarConPasos

  // Usar cache si disponible, si no hacer fetch
  if (_navPasosCache.length > 0) {
    // Redibujar ruta desde cache (por si dibujarLineaEstática la había borrado)
    if (!_rutaLinea && window._navGeomCache) {
      var z = mapa.getZoom(); var lw = z>=17?6:z>=15?5:z>=13?4:3;
      _rutaLinea = L.geoJSON(window._navGeomCache, {style:{color:'#FFD700',weight:lw,opacity:0.9,dashArray:'14 6',lineJoin:'round',lineCap:'round'}}).addTo(mapa);
      var ll = window._navGeomCache.coordinates.map(function(c){return[c[1],c[0]];});
      dibujarFlechas(ll);
    }
    _iniciarConPasos(_navPasosCache.slice());
  } else {
    // Cache vacío: calcular ruta ahora
    mostrarToast((T[idiomaActual]||T.es).navCalcRuta||'🔄 Calculando ruta...');
    var navEps = [
      'https://routing.openstreetmap.de/routed-foot/route/v1/foot/' + coords.join(';') + '?overview=full&geometries=geojson&steps=true',
      'https://router.project-osrm.org/route/v1/foot/' + coords.join(';') + '?overview=full&geometries=geojson&steps=true'
    ];
    function _navFetchFallback(i) {
      if (i >= navEps.length) {
        // OSRM no responde (offline real, portal cautivo o servidores caídos)
        // y no hay pasos cacheados. No dejamos el estado a medias: restauramos
        // para que la guía estática (línea + flechas + chincheta) pueda volver a
        // dibujarse, y avisamos. No reactivamos Ruta Oficial automáticamente,
        // coherente con detenerNavegacionVoz(): la reactiva el usuario a mano.
        _navActiva = false;
        window._rutaOficialPausada = false;
        var _bcN = document.getElementById('btn-asistente-mapa'); if (_bcN) _bcN.style.display = 'flex';
        if (typeof dibujarLineaEstática==='function') dibujarLineaEstática();
        mostrarToast((T[idiomaActual]||T.es).navOfflineGuia||'Modo sin conexión · sigue la línea para alcanzar el destino');
        return;
      }
      fetch(navEps[i]).then(function(r){ return r.json(); }).then(function(data) {
        if (!data.routes || !data.routes[0]) { _navFetchFallback(i+1); return; }
        var route = data.routes[0];
        // Extraer pasos
        var pasos = [];
        route.legs.forEach(function(leg) {
          leg.steps.forEach(function(step) {
            var man = step.maneuver;
            pasos.push({ tipo: man.type+(man.modifier?'-'+man.modifier:''), calle: step.name||'', distancia: step.distance, lat: man.location[1], lng: man.location[0] });
          });
        });
        _navPasosCache = pasos;
        window._navGeomCache = route.geometry; // guardar geometría para reuso
        // Dibujar trazado amarillo con flechas directamente desde esta respuesta
        if (_rutaLinea) { mapa.removeLayer(_rutaLinea); _rutaLinea = null; }
        if (window._rutaFlechas) { window._rutaFlechas.forEach(function(m){ mapa.removeLayer(m); }); window._rutaFlechas = []; }
        var z = mapa.getZoom();
        var lw = z>=17?6:z>=15?5:z>=13?4:3;
        _rutaLinea = L.geoJSON(route.geometry, {
          style:{color:'#FFD700',weight:lw,opacity:0.9,dashArray:'14 6',lineJoin:'round',lineCap:'round'}
        }).addTo(mapa);
        var latlngs = route.geometry.coordinates.map(function(c){return[c[1],c[0]];});
        dibujarFlechas(latlngs);
        _iniciarConPasos(pasos);
      }).catch(function(){ _navFetchFallback(i+1); });
    }
    _navFetchFallback(0);
  }
}

// Distancia en metros de un punto a un segmento (para detectar desvío)
function _distPuntoSegmento(plat, plng, alat, alng, blat, blng) {
  var R = 6371000;
  var dx = (blng-alng)*Math.cos((alat+blat)*Math.PI/360);
  var dy = blat-alat;
  var len2 = dx*dx+dy*dy;
  var px = (plng-alng)*Math.cos((alat+plat)*Math.PI/360);
  var py = plat-alat;
  var t = len2>0 ? Math.max(0,Math.min(1,(px*dx+py*dy)/len2)) : 0;
  var ex = px-t*dx; var ey = py-t*dy;
  return Math.sqrt(ex*ex+ey*ey)*R*Math.PI/180;
}

function _navRecalcular(lat, lng) {
  if (!_navActiva || window._navRecalculando) return;
  window._navRecalculando = true;
  mostrarCartelVoz((T[idiomaActual]||T.es).navRecalcRuta||'🔄 Recalculando ruta...');
  var coords = [lng + ',' + lat];
  // Añadir puntos de ruta restantes desde el paso actual en adelante
  var puntosRestantes = (_navOrdenadosCache.length > 0 ? _navOrdenadosCache : rutaPuntos);
  puntosRestantes.forEach(function(p){ coords.push(p.lng + ',' + p.lat); });
  var eps = [
    'https://routing.openstreetmap.de/routed-foot/route/v1/foot/' + coords.join(';') + '?overview=full&geometries=geojson&steps=true',
    'https://router.project-osrm.org/route/v1/foot/' + coords.join(';') + '?overview=full&geometries=geojson&steps=true'
  ];
  function tryEp(i) {
    if (i >= eps.length) { window._navRecalculando = false; return; }
    fetch(eps[i]).then(function(r){ return r.json(); }).then(function(data) {
      if (!data.routes || !data.routes[0]) { tryEp(i+1); return; }
      var route = data.routes[0];
      // Actualizar pasos
      _navPasos = [];
      route.legs.forEach(function(leg) {
        leg.steps.forEach(function(step) {
          var man = step.maneuver;
          _navPasos.push({ tipo: man.type+(man.modifier?'-'+man.modifier:''), calle: step.name||'', distancia: step.distance, lat: man.location[1], lng: man.location[0] });
        });
      });
      _navPasoActual = 0;
      _navAnunciado = {};
      _navPasosCache = _navPasos.slice();
      window._navGeomCache = route.geometry;
      // Redibujar trazado
      if (_rutaLinea) { mapa.removeLayer(_rutaLinea); _rutaLinea = null; }
      if (window._rutaFlechas) { window._rutaFlechas.forEach(function(m){ mapa.removeLayer(m); }); window._rutaFlechas = []; }
      var z = mapa.getZoom(); var lw = z>=17?6:z>=15?5:z>=13?4:3;
      _rutaLinea = L.geoJSON(route.geometry, { style:{color:'#FFD700',weight:lw,opacity:0.9,dashArray:'14 6',lineJoin:'round',lineCap:'round'} }).addTo(mapa);
      var ll = route.geometry.coordinates.map(function(c){return[c[1],c[0]];});
      dibujarFlechas(ll);
      window._navRecalculando = false;
      if (_navVozActiva) hablar((T[idiomaActual]||T.es).navRecalculada||'Ruta recalculada.');
    }).catch(function(){ tryEp(i+1); });
  }
  tryEp(0);
}

function _navTick(pos) {
  if (!_navActiva) return;
  var lat = pos.coords.latitude;
  var lng = pos.coords.longitude;
  userLat = lat; userLng = lng;
  if (window._albumCheckProximidad) window._albumCheckProximidad(lat, lng, pos.coords.accuracy);

  // Centrar mapa en usuario
  mapa.panTo([lat, lng], {animate:true, duration:0.8});
  if (window._userMarker) window._userMarker.setLatLng([lat, lng]);

  if (_navPasoActual >= _navPasos.length) return;

  var paso = _navPasos[_navPasoActual];
  var distAlPaso = haversine(lat, lng, paso.lat, paso.lng) * 1000; // metros

  // Detectar desvío: distancia > 20m a la línea de ruta actual
  if (!window._navRecalculando && window._navGeomCache) {
    var coords = window._navGeomCache.coordinates;
    var minDist = Infinity;
    for (var i = 0; i < coords.length - 1; i++) {
      var d = _distPuntoSegmento(lat, lng, coords[i][1], coords[i][0], coords[i+1][1], coords[i+1][0]);
      if (d < minDist) minDist = d;
    }
    if (minDist > 20) { _navRecalcular(lat, lng); return; }
  }

  // Si llegamos al paso actual (< 25m), avanzar al siguiente y anunciar
  if (distAlPaso < 25) {
    _navPasoActual++;
    _navAnunciado = {}; // reset para el nuevo paso
    if (_navPasoActual >= _navPasos.length) {
      // Fin de ruta
      hablar((T[idiomaActual]||T.es).navFin || '¡Has llegado a tu destino! Buen Camino.');
      detenerNavegacionVoz();
      return;
    }
    paso = _navPasos[_navPasoActual];
  }

  // Anunciar según distancia al siguiente giro
  var distTexto = distanciaTexto(distAlPaso);
  if (distTexto && !_navAnunciado[distTexto]) {
    _navAnunciado[distTexto] = true;
    var instruccion = traducirManiobra(paso.tipo, paso.calle);
    hablar(((T[idiomaActual]||T.es).navEn||'En ') + distTexto + ', ' + instruccion);
  }
}

function mostrarCartelVoz(texto) {
  var cartel = document.getElementById('nav-voz-cartel');
  if (!cartel) {
    cartel = document.createElement('div');
    cartel.id = 'nav-voz-cartel';
    cartel.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:99999;background:rgba(0,0,0,0.88);color:#fff;padding:14px 28px;border-radius:14px;font-family:DM Sans,sans-serif;font-size:15px;font-weight:700;text-align:center;pointer-events:none;transition:opacity 0.4s;';
    document.body.appendChild(cartel);
  }
  cartel.textContent = texto;
  cartel.style.opacity = '1';
  clearTimeout(cartel._t);
  cartel._t = setTimeout(function(){ cartel.style.opacity = '0'; }, 2000);
}

function toggleVozNav() {
  _navVozActiva = !_navVozActiva;
  var btn = document.getElementById('ruta-nav-voz');
  if (btn) {
    btn.style.background = _navVozActiva ? '#1D9E75' : '#444';
    var _tn=T[idiomaActual]||T.es; btn.innerHTML = _navVozActiva ? (_tn.navVozOn||'🔊 Voz') : (_tn.navVozOff||'🔇 Voz');
  }
  if (_navVozActiva) {
    hablar((T[idiomaActual]||T.es).navVozActivada||'Guía por voz activada.');
  } else {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
  }
}

function detenerNavegacionVoz() {
  _navActiva = false;
  if (typeof _ocultarBtnComenzarNav==='function') _ocultarBtnComenzarNav();
  // Limpiar SOLO el punto sintético "volver a la ruta oficial" (chincheta +
  // su línea/flechas). El resto de puntos de la ruta del usuario se respetan.
  if (typeof _limpiarVolverRuta==='function') _limpiarVolverRuta();
  else if (typeof _quitarMarkerVolver==='function') _quitarMarkerVolver();
  // Al salir de navegación NO se reactiva el Modo Ruta Oficial automáticamente:
  // queda apagado y será el usuario quien lo vuelva a activar desde el botón.
  window._rutaOficialPausada = false;
  var _btnCascoStop = document.getElementById('btn-asistente-mapa'); if (_btnCascoStop) _btnCascoStop.style.display = 'flex';

  // Guardar estado brújula antes de detener
  var brujulaEstaba = !!window._orientacionActiva;

  // Detener GPS
  if (window._navWatchId) { navigator.geolocation.clearWatch(window._navWatchId); window._navWatchId = null; }

  // Liberar wake lock
  if (_navWakeLock) { _navWakeLock.release().catch(function(){}); _navWakeLock = null; }

  // Silenciar voz
  if (window.speechSynthesis) window.speechSynthesis.cancel();

  // Restaurar interacción del mapa
  mapa.dragging.enable();
  mapa.dragging.enable();
  mapa.touchZoom.enable();
  mapa.scrollWheelZoom.enable();
  mapa.doubleClickZoom.enable();
  mapa.boxZoom.enable();
  mapa.keyboard.enable();
  window._navBloqPopups = false;

  // Restaurar tamaño del mapa
  var mapEl = document.getElementById('map');
  if (mapEl && mapEl._origHeight !== undefined) mapEl.style.height = mapEl._origHeight || '';
  var mapTitleBlock = document.querySelector('.map-title-block');
  if (mapTitleBlock && mapTitleBlock._origDisplay !== undefined) mapTitleBlock.style.display = mapTitleBlock._origDisplay;
  var searchUnder = document.querySelector('.search-under-map');
  if (searchUnder && searchUnder._origDisplay !== undefined) searchUnder.style.display = searchUnder._origDisplay;

  // Restaurar botones del mapa
  ['btn-add-poi-map','map-radio-control','btn-alertas-toggle','btn-descargar-mapa','btn-simular-mapa'].forEach(function(id){
    var el=document.getElementById(id); if(el) el.style.display='flex';
  });
  var _btnRofRst=document.getElementById('btn-ruta-oficial'); if(_btnRofRst) _btnRofRst.style.display='';
  // Restaurar stats del panel ruta
  ['ruta-bar-count','ruta-bar-dist','ruta-bar-time'].forEach(function(id){
    var el=document.getElementById(id); if(el) el.style.display='';
  });

  // UI: mostrar IR, ocultar STOP
  var btnIr   = document.getElementById('ruta-nav-btn');
  var btnStop = document.getElementById('ruta-nav-stop');
  var btnClr  = document.getElementById('ruta-bar-btn-clear');
  if (btnIr   && rutaPuntos.length >= 1) btnIr.style.display = 'block';
  _sincronizarBtnGuardar();
  // Restaurar brújula en mapa
  var btnOrMapRst = document.getElementById('btn-brujula-mapa');
  if (btnOrMapRst) btnOrMapRst.style.display = 'flex';
  ['btn-sos-mapa','btn-meteo-mapa','btn-buscar-mapa','btn-poi-drawer-mapa'].forEach(function(id){
    var b=document.getElementById(id); if(b) b.style.display='flex';
  });
  var btnOrPanelRst = document.getElementById('ruta-nav-orientacion');
  if (btnOrPanelRst) btnOrPanelRst.style.display = 'none';
  if (btnStop) btnStop.style.display = 'none';
  var btnVozOff = document.getElementById('ruta-nav-voz'); if(btnVozOff) btnVozOff.style.display = 'none';
  _navVozActiva = false;
  if (btnClr  && rutaPuntos.length > 0)  btnClr.style.display = 'block';

  // Restaurar trazado estático con flechas
  if (window._navRestoreTimeout) clearTimeout(window._navRestoreTimeout);
  if (rutaPuntos.length >= 1) window._navRestoreTimeout = setTimeout(dibujarLineaEstática, 300);
  // scroll desbloqueado (no se bloqueó al entrar en modo navegación)
  // Restaurar brújula si estaba encendida
  if (brujulaEstaba) setTimeout(pedirOrientacion, 300);
  // Restaurar radio 1km y zoom
  radioKm = 1;
  _aplicarEstadoRadioBtns(1);
  if (userLat) {
    aplicarRadio(1);
    mapa.setView([userLat, userLng], 15, {animate: true});
  }
  mostrarToast('⏹ Navegación detenida');
}
// ═══════════════════════════════════════════════
function iniciarRuta() {
  if(rutaPuntos.length<2)return;
  // Ocultar buscador si está abierto


  // Ordenar por vecino más cercano desde posición usuario
  var origenCoord = (userLat&&userLng) ? {lat:userLat,lng:userLng} : {lat:rutaPuntos[0].lat,lng:rutaPuntos[0].lng};
  var ordenados = ordenarRutaPorCercania(origenCoord);
  var inicio = (userLat&&userLng) ? userLat+','+userLng : ordenados[0].lat+','+ordenados[0].lng;
  var fin = ordenados[ordenados.length-1].lat+','+ordenados[ordenados.length-1].lng;
  var url='https://www.google.com/maps/dir/?api=1&origin='+inicio+'&destination='+fin+'&travelmode=walking';
  var wpArr = (userLat&&userLng) ? ordenados : ordenados.slice(1, ordenados.length-1);
  if(wpArr.length>0){
    var wp=wpArr.map(function(p){return p.lat+','+p.lng;}).join('|');
    url+='&waypoints='+encodeURIComponent(wp);
  }
  window.open(url,'_blank');
}

// GALERIA HERO
var GALERIA_IMGS=[
  {src:'https://i.postimg.cc/T1x3mHdk/graffiticoia.webp',alt:'Marcas gremiales Coia'},
  {src:'https://i.postimg.cc/nzBLXtx8/fortalezacastro.webp',alt:'Monte do Castro'},
  {src:'https://i.postimg.cc/RFK0WzBw/IMG-0229.webp',alt:'Estela Templaria'},
  {src:'https://i.postimg.cc/Kjb8LscZ/bembrive.webp',alt:'Santiago de Bembrive'},
  {src:'https://i.postimg.cc/zvNGWPz6/casaceta.webp',alt:'Casa de Ceta'},
  {src:'https://i.postimg.cc/D0hwsYfv/iglesiateis.webp',alt:'Iglesia Teis'},
  {src:'https://i.postimg.cc/nrxh7wVC/escudoamorcortes.webp',alt:'Escudo Amor Cortés'},
  {src:'https://i.postimg.cc/MHCNTPDJ/balaidos.jpg',alt:'Puente de Balaidos'},
  {src:'https://i.postimg.cc/L5S8f09r/concatedral.webp',alt:'Concatedral de Santa María'},
  {src:'https://i.postimg.cc/qqrvnZBT/iglesiacastrelos.webp',alt:'Santa María de Castrelos'},
  {src:'https://i.postimg.cc/vBfm4dsN/losaestrelladavid.webp',alt:'Losa Estrella de David'},
  {src:'https://i.postimg.cc/Bb3nDwZj/IMG-4705.webp',alt:'Cruz Paté Figueirido'},
  {src:'https://i.postimg.cc/Hnmk5PWk/olivo.webp',alt:'Olivo Templario'},
  {src:'https://i.postimg.cc/XqWYFDN4/laxe.webp',alt:'Petroglifos Da Laxe'},
  {src:'https://i.postimg.cc/rsTwWYVf/freixo.webp',alt:'Ermita San Xoan do Freixo'},
  {src:'https://i.postimg.cc/J08zJd7W/iglesiabembrive.webp',alt:'Iglesia de Bembrive'},
  {src:'https://i.postimg.cc/63nQ8NXh/IMG-1179.webp',alt:'Concatedral'},
  {src:'https://i.postimg.cc/DZLzSKTR/IMG-E1212.webp',alt:'Patrimonio templario'}
];
var galeria_idx = 0;   // siguiente imagen a cargar
var galeria_slot = 0;  // slot que cambia en este turno (0, 1 o 2)
var galeria_slots = [null, null, null]; // img actual en cada slot

var _galeriaIniciada = false;
function iniciarGaleria() {
  if (window.innerWidth < 769) return;
  if (_galeriaIniciada) return;
  _galeriaIniciada = true;
  // Cargar las 3 imágenes iniciales
  for (var i = 0; i < 3; i++) {
    cargarEnSlot(i, galeria_idx % GALERIA_IMGS.length);
    galeria_idx = (galeria_idx + 1) % GALERIA_IMGS.length;
  }
  // Cada 4 segúndos cambia UN slot de manera alterna
  setInterval(function() {
    var slotIdx = galeria_slot;
    var nextImg = galeria_idx;
    galeria_slot = (galeria_slot + 1) % 3;
    galeria_idx = (galeria_idx + 1) % GALERIA_IMGS.length;
    // Desvanecer la imagen actual del slot
    var slot = document.getElementById('gallery-slot-' + slotIdx);
    if (!slot) return;
    var imgActual = slot.querySelector('.hero-gallery-img');
    if (imgActual) {
      imgActual.classList.remove('visible');
      // Tras la transición, reemplazar con la nueva
      setTimeout(function() {
        cargarEnSlot(slotIdx, nextImg);
      }, 1000);
    } else {
      cargarEnSlot(slotIdx, nextImg);
    }
  }, 8000);
}

// ── CARRUSEL DEL TELÉFONO DEL HERO (landing escritorio) ─────────────
// Mantiene la primera captura fija y va rotando el resto con su leyenda
// arriba (las mismas imágenes y textos que la galería "La app en acción").
var _dlPhoneIniciado = false;
function iniciarPhoneCarrusel() {
  if (window.innerWidth < 769) return;
  if (_dlPhoneIniciado) return;
  var slides = document.querySelectorAll('.dl-phone-slide');
  if (slides.length < 2) return;
  _dlPhoneIniciado = true;
  var caption = document.getElementById('dl-phone-caption');
  var idx = 0;
  setInterval(function() {
    idx = (idx + 1) % slides.length;
    for (var i = 0; i < slides.length; i++) {
      slides[i].classList.toggle('active', i === idx);
    }
    if (caption) {
      var capKey = slides[idx].getAttribute('data-cap');
      if (capKey) {
        var dl = (window._dlT && (window._dlT[idiomaActual] || window._dlT.es)) || {};
        caption.textContent = dl[capKey] || '';
        caption.classList.add('visible');
      } else {
        caption.classList.remove('visible');
      }
    }
  }, 3500);
}

function cargarEnSlot(slotIdx, imgIdx) {
  var slot = document.getElementById('gallery-slot-' + slotIdx);
  if (!slot) return;
  slot.innerHTML = '';
  var img = document.createElement('img');
  img.src = GALERIA_IMGS[imgIdx].src;
  img.alt = GALERIA_IMGS[imgIdx].alt;
  img.className = 'hero-gallery-img';
  img.loading = 'lazy';
  slot.appendChild(img);
  setTimeout(function() { img.classList.add('visible'); }, 50);
}

// FRASES ROTANTES
var FRASES={
  es:['Puntos de interés, rutas y experiencias únicas cerca de ti','¿Sabías que la vieira jacobea nació en las aguas de Bouzas?','El Temple gobernó estas tierras durante más de un siglo','El olivo del escudo de Vigo lo plantaron los Caballeros Templarios','La bailía de Coia controlaba todo el sur de Galicia','El Camino de Santiago pasa por el corazón de Vigo','La pentalfa de la estela de Coia sigue mirando a los peregrinos','La Casa de Ceta es la vivienda más antigua conservada de Vigo','Bouzas: donde la leyenda del Caballero de las Conchas se hizo símbolo','En la Rúa Real se esconden marcas gremiales templarias del siglo XIII'],
  gl:['Puntos de interése, rutas e experiencias únicas preto de ti','¿Sabías que a vieira xacobea naceu nas augas de Bouzas?','O Temple gobernou estas terras durante máis dun século','O olivo do escudo de Vigo plantonárono os Cabaleiros Templarios','A encomenda de Coia controlaba todo o sur de Galicia','O Camiño de Santiago pasa polo corazón de Vigo','A pentalfa da estela de Coia segue mirando aos peregrinos','A Casa de Ceta é a vivenda máis antiga conservada de Vigo','Bouzas: onde a lenda do Cabaleiro das Cunchas se fixo símbolo','Na Rúa Real agóchanse marcas gremiais templarias do século XIII'],
  en:['Points of interest, routes and unique experiences near you','Did you know the Jacobean shell was born in the waters of Bouzas?','The Knights Templar governed these lands for over a century','The olive tree on Vigos coat of arms was planted by the Templars','The commandery of Coia controlled all of southern Galicia','The Portuguese Coastal Way passes through the heart of Vigo','The pentagram on the Coia stele still watches over pilgrims','Casa de Ceta is the oldest preserved dwelling in Vigo','Bouzas: where the legend of the Knight of the Shells became a symbol','Templar guild marks from the 13th century are hidden in Rua Real']
};
var fraseIdx=0;
function iniciarFrases(){
  setInterval(function(){
    var el=document.getElementById('hero-sub');if(!el)return;
    el.classList.add('oculto');
    setTimeout(function(){
      var lista=FRASES[idiomaActual]||FRASES.es;
      fraseIdx=(fraseIdx+1)%lista.length;
      el.textContent=lista[fraseIdx];
      el.classList.remove('oculto');
    },500);
  },5000);
}

// IDIOMAS
// ── TRADUCCIONES LANDING DESKTOP ────────────────────────────
window._dlT = {
  es:{
    eyebrow:'Guía Xacobea Interactiva',
    heroTitle:'Tu compañera en el <em>Camino</em>',
    heroDesc:'Xacobeapp es una guía completamente gratuita para el Camino de Santiago, intuitiva y de muy fácil manejo, que te mostrará todo el patrimonio xacobeo a tu alrededor. Mapas interactivos con navegación GPS incluso sin cobertura, creador de rutas, etapas diarias, avisos de emergencia en tiempo real, POIs exclusivos con descripciones especializadas, brújula… y otras muchas utilidades pensadas para el peregrino, pero también para todos los que disfrutan conociendo y explorando nuevos espacios. Toda una navaja suiza del peregrino en tu bolsillo, a tu servicio. Xacobeapp no mejora el Camino, pero sí lo hará más seguro, completo e inmersivo.',
    btnMovil:'📱 Abrir en tu móvil',
    metaGratis:'Gratuita', metaGratis2:' y sin anuncios', metaGratis3:', impulsada por la comunidad de peregrinos',
    metaRutas:'📍 Los principales caminos jacobeos, con sus etapas y POIs exclusivos',
    metaOffline:'funciona sin red',
    statPoi:'Puntos de interés especializados', statEtapas:'Etapas diarias de los 6 principales caminos', statCoste:'Coste para el peregrino',
    featTitle:'Todo lo que necesitas en el Camino', featSub:'Diseñada para usarse en el móvil mientras caminas',
    f0badge:'Nuevo',f0t:'Mapa de trazados oficiales',f0d:'Todos los Caminos oficiales (Francés, Norte, Inglés, Primitivo, Portugués…) dibujados sobre el mapa con los trazados certificados del CNIG. Activa el modo Ruta Oficial y la guía vigila por voz que no te salgas de la senda.',
    fsimbadge:'Nuevo',fsimt:'Simulador de posición',fsimd:'Coloca un punto ficticio en cualquier lugar del Camino y muévete por él como si estuvieras allí. Planifica etapas desde casa, comprueba distancias y tiempos, descubre qué lugares te quedan cerca de cada tramo y prueba toda la app sin moverte del sofá.',
    f1t:'Mapa interactivo offline',f1d:'Tiles de OpenStreetMap cacheadas. Navega sin conexión a lo largo de toda la ruta, con tu posición GPS en tiempo real.',
    f2t:'Navegación por voz',f2d:'Indicaciones habladas en gallego, español e inglés. El móvil te avisa de cada giro sin tener que mirar la pantalla.',
    f3t:'Patrimonio jacobeo',f3d:'Iglesias, monasterios, castros y vestigios arqueológicos documentados con textos históricos y POIs exclusivos especializados en el patrimonio xacobeo.',
    f4t:'Juego de la Oca Jacobeo',f4d:'63 casillas, cromos coleccionables que se desbloquean por GPS al pasar cerca de los puntos. Tu peregrinación tiene ahora una dimensión lúdica.',
    f5t:'Albergues y servicios',f5d:'Albergues, fuentes, farmacias y puntos de servicio geolocalizados. Búsqueda en tiempo real con radio expandible.',
    f6t:'Trilingüe',f6d:'Interfaz completa en gallego, castellano e inglés. Cambia el idioma en cualquier momento sin reiniciar.',
    f7t:'Emergencias de acceso rápido',f7d:'Sección de emergencias siempre a un toque, con números útiles y recursos para cualquier inconveniente que pueda surgir en el Camino.',
    f8t:'Guía por flechas de color',f8d:'Sistema de navegación visual mediante flechas de color que te orientan en cada momento, sin perderte ni un giro del Camino.',
    f9t:'Crea y guarda tu ruta',f9d:'Selecciona los puntos que quieres visitar, construye tu ruta personalizada y guárdala para consultarla cuando la necesites.',
    f10t:'Tus propios puntos en el mapa',f10d:'Crea puntos de interés personalizados y añádelos directamente a tu ruta. Tu Camino, a tu manera.',
    f11t:'Y mucho más…',f11d:'Otras muchas y sorprendentes utilidades para que tu Camino pueda ser más atractivo y seguro. Descúbrelas tú mismo.',
    galTitle:'La app en acción', galSub:'Capturas reales desde el móvil',
    gal1:'Añade tus propios puntos',gal1i:'Mapa interactivo',gal2:'Patrimonio',gal2i:'Historia y patrimonio',
    gal3:'Etapas de los principales caminos',gal3i:'Juego de la Oca',gal4:'Brújula',gal4i:'Brújula y navegación',
    gal5:'Asistente',gal5i:'Asistente virtual',gal6:'Crea y recibe alertas en tiempo real',gal7:'Descripciones especializadas',
    galHint:'✨ Escanea el QR para ver la app real en tu móvil',
    rutTitle:'Rutas cubiertas', rutSub:'Cinco caminos jacobeos con etapas, POIs y navegación GPS',
    rut1:'Camino Portugués de la Costa',rut2:'Camino Francés',rut3:'Camino del Norte',rut4:'Camino Primitivo',rut5:'Camino Inglés',
    qrEyebrow:'📱 Versión móvil', qrTitle:'La app está diseñada para tu móvil',
    qrDesc:'Xacobeapp es una Progressive Web App optimizada para pantallas de móvil. Escanea el QR con la cámara de tu teléfono para abrirla directamente, sin descargas.',
    qrS1:'Abre la cámara de tu móvil',qrS2:'Apunta al código QR de la derecha',qrS3:'Toca el enlace que aparece → xacobeapp.com',qrS4:'Instálala como app desde el navegador',
    footSub:'Guía gratuita del Camino de Santiago · Hecha con ❤️ en Galicia',
    footVersion:'App gratuita, sin publicidad. Versión {VER} · Disponible como PWA en iOS y Android',
    navFunciones:'Funciones',navCapturas:'Capturas',navRutas:'Rutas',navQr:'Ver en móvil →',
    badge:'🐚 Gratuita · Sin publicidad'
  },
  gl:{
    eyebrow:'Guía Xacobea Interactiva',
    heroTitle:'A túa compañeira no <em>Camiño</em>',
    heroDesc:'Xacobeapp é unha guía completamente gratuíta para o Camiño de Santiago, intuitiva e moi fácil de usar, que che mostrará todo o patrimonio xacobeo ao teu redor. Mapas interactivos con navegación GPS mesmo sen cobertura, creador de rutas, etapas diarias, avisos de emerxencia en tempo real, POIs exclusivos con descricións especializadas, brúxula… e moitas outras utilidades pensadas para o peregrino, pero tamén para todos os que gozan coñecendo e explorando novos espazos. Toda unha navalla suíza do peregrino no teu peto, ao teu servizo. Xacobeapp non mellora o Camiño, pero si o fará máis seguro, completo e inmersivo.',
    btnMovil:'📱 Abrir no teu móbil',
    metaGratis:'Gratuíta', metaGratis2:' e sen anuncios', metaGratis3:', impulsada pola comunidade de peregrinos',
    metaRutas:'📍 Os principais camiños xacobeos, coas súas etapas e POIs exclusivos',
    metaOffline:'funciona sen rede',
    statPoi:'Puntos de interese especializados', statEtapas:'Etapas diarias dos 6 camiños principais', statCoste:'Custo para o peregrino',
    featTitle:'Todo o que precisas no Camiño', featSub:'Deseñada para usarse no móbil mentres camiñas',
    f0badge:'Novo',f0t:'Mapa de trazados oficiais',f0d:'Todos os Camiños oficiais (Francés, Norte, Inglés, Primitivo, Portugués…) debuxados sobre o mapa cos trazados certificados do CNIG. Activa o modo Ruta Oficial e a guía vixía por voz que non te saias da senda.',
    fsimbadge:'Novo',fsimt:'Simulador de posición',fsimd:'Coloca un punto ficticio en calquera lugar do Camiño e móvete por el coma se estiveses alí. Planifica etapas desde a casa, comproba distancias e tempos, descobre que lugares che quedan preto de cada tramo e proba toda a app sen moverte do sofá.',
    f1t:'Mapa interactivo sen conexión',f1d:'Tiles de OpenStreetMap en caché. Navega sen conexión ao longo de toda a ruta, coa túa posición GPS en tempo real.',
    f2t:'Navegación por voz',f2d:'Indicacións faladas en galego, español e inglés. O móbil avísate de cada xiro sen ter que mirar a pantalla.',
    f3t:'Patrimonio xacobeo',f3d:'Igrexas, mosteiros, castros e vestixios arqueolóxicos documentados con textos históricos e POIs exclusivos especializados no patrimonio xacobeo.',
    f4t:'Xogo da Oca Xacobeo',f4d:'63 casillas, cromos coleccionables que se desbloquean por GPS ao pasar preto dos puntos. A túa peregrinación ten agora unha dimensión lúdica.',
    f5t:'Albergues e servizos',f5d:'Albergues, fontes, farmacias e puntos de servizo xeolocalizados. Busca en tempo real con radio expandible.',
    f6t:'Trilingüe',f6d:'Interface completa en galego, castelán e inglés. Cambia o idioma en calquera momento sen reiniciar.',
    f7t:'Emerxencias de acceso rápido',f7d:'Sección de emerxencias sempre a un toque, con números útiles e recursos para calquera imprevisto que poida xurdir no Camiño.',
    f8t:'Guía por frechas de cor',f8d:'Sistema de navegación visual mediante frechas de cor que te orientan en cada momento, sen perderte nin un xiro do Camiño.',
    f9t:'Crea e garda a túa ruta',f9d:'Selecciona os puntos que queres visitar, constrúe a túa ruta personalizada e gárdaa para consultala cando a necesites.',
    f10t:'Os teus propios puntos no mapa',f10d:'Crea puntos de interese personalizados e engádeos directamente á túa ruta. O teu Camiño, ao teu xeito.',
    f11t:'E moito máis…',f11d:'Moitas outras e sorprendentes utilidades para que o teu Camiño sexa máis atractivo e seguro. Descúbrenas ti mesmo.',
    galTitle:'A app en acción', galSub:'Capturas reais desde o móbil',
    gal1:'Engade os teus propios puntos',gal1i:'Mapa interactivo',gal2:'Patrimonio',gal2i:'Historia e patrimonio',
    gal3:'Etapas dos principais camiños',gal3i:'Xogo da Oca',gal4:'Brúxula',gal4i:'Brúxula e navegación',
    gal5:'Asistente',gal5i:'Asistente virtual',gal6:'Crea e recibe alertas en tempo real',gal7:'Descricións especializadas',
    galHint:'✨ Escanea o QR para ver a app real no teu móbil',
    rutTitle:'Rutas cubertas', rutSub:'Cinco camiños xacobeos con etapas, POIs e navegación GPS',
    rut1:'Camiño Portugués da Costa',rut2:'Camiño Francés',rut3:'Camiño do Norte',rut4:'Camiño Primitivo',rut5:'Camiño Inglés',
    qrEyebrow:'📱 Versión móbil', qrTitle:'A app está deseñada para o teu móbil',
    qrDesc:'Xacobeapp é unha Progressive Web App optimizada para pantallas de móbil. Escanea o QR coa cámara do teu teléfono para abrila directamente, sen descargas.',
    qrS1:'Abre a cámara do teu móbil',qrS2:'Apunta ao código QR da dereita',qrS3:'Toca a ligazón que aparece → xacobeapp.com',qrS4:'Instálaa como app desde o navegador',
    footSub:'Guía gratuíta do Camiño de Santiago · Feita con ❤️ en Galicia',
    footVersion:'App gratuíta, sen publicidade. Versión {VER} · Dispoñible como PWA en iOS e Android',
    navFunciones:'Funcións',navCapturas:'Capturas',navRutas:'Rutas',navQr:'Ver no móbil →',
    badge:'🐚 Gratuíta · Sen publicidade'
  },
  en:{
    eyebrow:'Interactive Jacobean Guide',
    heroTitle:'Your companion on the <em>Camino</em>',
    heroDesc:'Xacobeapp is a completely free guide to the Camino de Santiago — intuitive and easy to use — showing you all the Jacobean heritage around you. Interactive maps with GPS navigation even without signal, route builder, daily stages, real-time emergency alerts, exclusive POIs with specialised descriptions, compass… and many more utilities designed for pilgrims and for everyone who enjoys discovering and exploring new places. A true Swiss army knife for the pilgrim, right in your pocket. Xacobeapp doesn\'t improve the Camino, but it will make it safer, more complete and more immersive.',
    btnMovil:'📱 Open on your phone',
    metaGratis:'Free', metaGratis2:' and ad-free', metaGratis3:', powered by the pilgrim community',
    metaRutas:'📍 The main Jacobean routes, with their stages and exclusive POIs',
    metaOffline:'works offline',
    statPoi:'Specialised points of interest', statEtapas:'Daily stages across the 6 main routes', statCoste:'Cost for the pilgrim',
    featTitle:'Everything you need on the Camino', featSub:'Designed to be used on your phone while you walk',
    f0badge:'New',f0t:'Official route map',f0d:'All the official Ways (French, Northern, English, Primitive, Portuguese…) drawn on the map with CNIG-certified tracks. Turn on Official Route mode and the guide watches by voice that you stay on the path.',
    fsimbadge:'New',fsimt:'Position simulator',fsimd:'Drop a fictitious point anywhere on the Camino and move around it as if you were there. Plan stages from home, check distances and times, see which places lie near each section and try the whole app without leaving your sofa.',
    f1t:'Offline interactive map',f1d:'Cached OpenStreetMap tiles. Navigate without a connection along the entire route, with your GPS position in real time.',
    f2t:'Voice navigation',f2d:'Spoken directions in Galician, Spanish and English. Your phone alerts you to every turn without needing to look at the screen.',
    f3t:'Jacobean heritage',f3d:'Churches, monasteries, hillforts and archaeological remains documented with historical texts and exclusive POIs specialising in Jacobean heritage.',
    f4t:'Jacobean Goose Game',f4d:'63 squares, collectible stickers unlocked by GPS when you pass near points of interest. Your pilgrimage now has a playful dimension.',
    f5t:'Hostels and services',f5d:'Geolocated hostels, fountains, pharmacies and service points. Real-time search with expandable radius.',
    f6t:'Trilingual',f6d:'Full interface in Galician, Spanish and English. Change language at any time without restarting.',
    f7t:'Quick-access emergencies',f7d:'Emergency section always one tap away, with useful numbers and resources for any incident that may arise on the Camino.',
    f8t:'Colour-arrow guide',f8d:'Visual navigation system using colour arrows to guide you at every moment, so you never miss a turn on the Camino.',
    f9t:'Create and save your route',f9d:'Select the points you want to visit, build your personalised route and save it to consult whenever you need it.',
    f10t:'Your own points on the map',f10d:'Create personalised points of interest and add them directly to your route. Your Camino, your way.',
    f11t:'And much more…',f11d:'Many more surprising features to make your Camino more enjoyable and safer. Discover them for yourself.',
    galTitle:'The app in action', galSub:'Real screenshots from the phone',
    gal1:'Add your own points',gal1i:'Interactive map',gal2:'Heritage',gal2i:'History and heritage',
    gal3:'Stages of the main routes',gal3i:'Goose Game',gal4:'Compass',gal4i:'Compass and navigation',
    gal5:'Assistant',gal5i:'Virtual assistant',gal6:'Create and receive real-time alerts',gal7:'Specialized descriptions',
    galHint:'✨ Scan the QR to see the real app on your phone',
    rutTitle:'Routes covered', rutSub:'Five Jacobean routes with stages, POIs and GPS navigation',
    rut1:'Portuguese Coastal Way',rut2:'French Way',rut3:'Northern Way',rut4:'Primitive Way',rut5:'English Way',
    qrEyebrow:'📱 Mobile version', qrTitle:'The app is designed for your phone',
    qrDesc:'Xacobeapp is a Progressive Web App optimised for mobile screens. Scan the QR with your phone camera to open it directly, no download needed.',
    qrS1:'Open your phone camera',qrS2:'Point it at the QR code on the right',qrS3:'Tap the link that appears → xacobeapp.com',qrS4:'Install it as an app from your browser',
    footSub:'Free guide to the Camino de Santiago · Made with ❤️ in Galicia',
    footVersion:'Free app, no ads. Version {VER} · Available as PWA on iOS and Android',
    navFunciones:'Features',navCapturas:'Screenshots',navRutas:'Routes',navQr:'Open on phone →',
    badge:'🐚 Free · No ads'
  }
};

function cambiarIdioma(lang){
  idiomaActual=lang;fraseIdx=0;
  try{localStorage.setItem('idiomaActual',lang);}catch(e){}
  if(typeof mapa!=='undefined'&&mapa)mapa.closePopup();
  document.querySelectorAll('.lang-btn').forEach(function(b){b.classList.remove('activo');});
  var btn=document.getElementById('btn-'+lang);if(btn)btn.classList.add('activo');
  var btnM=document.getElementById('btn-'+lang+'-m');if(btnM)btnM.classList.add('activo');
  var btnH=document.getElementById('btn-'+lang+'-h');if(btnH)btnH.classList.add('activo');
  var btnHd=document.getElementById('btn-'+lang+'-hd');if(btnHd)btnHd.classList.add('activo');
  var t=T[lang]||T.es;
  // Hero
  var el=document.getElementById('hero-sub');if(el)el.textContent=FRASES[lang][0];
  el=document.querySelector('.hero h1');if(el)el.textContent=t.h1;
  el=document.getElementById('hero-tag-text');if(el)el.textContent=t.heroTag;
  el=document.getElementById('hero-tag-mobile');if(el)el.textContent=t.heroTag;
  // Nav desktop
  el=document.getElementById('nav-inicio');if(el)el.textContent='🏠 '+t.navInicio;
  el=document.getElementById('nav-historia');if(el)el.textContent='🐚 '+t.navHistoria;
  el=document.getElementById('nav-puntos');if(el)el.textContent='🏅 '+t.navPuntos;
  el=document.getElementById('nav-emergencias');if(el)el.textContent='🆘 '+t.navEmergencias.replace(/^🆘\s*/,'');
  el=document.getElementById('nav-comousar');if(el)el.textContent='📖 '+t.navComoUsar;
  el=document.getElementById('nav-brujula');if(el)el.textContent='🧭 '+t.navBrujula;
  el=document.getElementById('nav-mapa');if(el)el.textContent='🗺️ '+t.navMapa;
  el=document.getElementById('nav-m-comousar');if(el)el.innerHTML='<span style="font-size:20px;margin-right:8px">📖</span>'+t.navComoUsar;
  el=document.getElementById('nav-contacto');if(el)el.textContent='✉️ '+t.navContacto;
  // Nav móvil
  el=document.getElementById('nav-m-inicio');if(el)el.innerHTML='<span style="font-size:20px;margin-right:8px">🏠</span>'+t.navInicio;
  el=document.getElementById('nav-m-historia');if(el)el.innerHTML='<span style="font-size:20px;margin-right:8px">🐚</span>'+t.navHistoria;
  el=document.getElementById('nav-m-puntos');if(el)el.innerHTML='<span style="font-size:20px;margin-right:8px">🏅</span>'+t.navPuntos;
  el=document.getElementById('nav-m-emergencias');if(el)el.innerHTML='<span style="font-size:20px;margin-right:8px">🆘</span>'+(t.navEmergencias||'Emergencias').replace(/^🆘\s*/,'');
  el=document.getElementById('nav-m-comousar');if(el)el.innerHTML='<span style="font-size:20px;margin-right:8px">📖</span>'+t.navComoUsar;
  el=document.getElementById('nav-m-contacto');if(el)el.innerHTML='<span style="font-size:20px;margin-right:8px">✉️</span>'+t.navContacto;
  el=document.getElementById('nav-m-mapa');if(el)el.innerHTML='<span style="font-size:20px;margin-right:8px">🗺️</span>'+t.navMapa;
  el=document.getElementById('nav-m-brujula');if(el)el.innerHTML='<span style="font-size:20px;margin-right:8px">🧭</span>'+t.navBrujula;
  el=document.getElementById('nav-m-donaciones');if(el)el.innerHTML='<span style="font-size:20px;margin-right:8px">🙏</span>'+t.navDonaciones;
  // Secciones
  el=document.getElementById('puntos-h2');if(el)el.textContent=t.puntosH2;
  el=document.getElementById('historia-h2');if(el)el.textContent=t.historiaH2;
  el=document.getElementById('emergencias-h2');if(el)el.textContent=t.emergenciasH2;
  el=document.getElementById('emergencias-sub');if(el)el.textContent=t.emergenciasSub;
  el=document.getElementById('comousar-h2');if(el)el.textContent=t.comoUsarH2;
  el=document.getElementById('comousar-sub');if(el)el.textContent=t.comoUsarSub;
  el=document.getElementById('donaciones-h2');if(el)el.innerHTML=t.donacionesH2;
  el=document.getElementById('footer-desc');if(el)el.textContent=t.footerDesc;
  el=document.getElementById('footer-explora');if(el)el.textContent=t.footerExplora;
  el=document.getElementById('footer-info');if(el)el.textContent=t.footerInfo;
  // Buscador
  el=document.getElementById('buscar-input');if(el)el.placeholder=t.buscarPlaceholder;
  el=document.getElementById('buscar-btn');if(el)el.innerHTML=t.buscarBtn;
  // POI section
  el=document.getElementById('poi-sub1');if(el)el.textContent=t.poiSub1;
  el=document.getElementById('poi-sub2');if(el)el.textContent=t.poiSub2;
  el=document.getElementById('chip-todos-txt');if(el)el.textContent=t.chipTodos||'Todos';
  el=document.getElementById('chip-naturaleza');if(el)el.textContent=t.chipNaturaleza;
  el=document.getElementById('chip-monumentos');if(el)el.textContent=t.chipMonumento;
  el=document.getElementById('chip-albergues');if(el)el.textContent=t.chipAlbergue;
  el=document.getElementById('chip-miradores');if(el)el.textContent=t.chipMirador;
  el=document.getElementById('chip-etapas-txt');if(el)el.textContent=t.chipEtapa||'Etapas';
  el=document.getElementById('chip-usuario-txt');if(el)el.textContent=t.chipUsuario||'Mis puntos';
  el=document.getElementById('chip-etapas-txt');if(el)el.textContent=t.chipEtapa||'Etapas';
  el=document.getElementById('chip-usuario-txt');if(el)el.textContent=t.chipUsuario||'Mis puntos';
  // Ruta bar
  el=document.getElementById('ruta-label');if(el)el.textContent=t.rutaLabel;
  el=document.getElementById('map-ruta-titulo');if(el)el.textContent=t.mapRutaTitulo||'RUTA';
  el=document.getElementById('poi-ruta-drawer-label');if(el)el.textContent=t.poiRutaDrawerLabel||'Ruta';
  el=document.getElementById('ruta-bar-empty');if(el&&el.style.display!=='none')el.textContent=t.rutaVacio;
  el=document.getElementById('poi-ruta-btn-ir');if(el)el.innerHTML=t.poiRutaBtnIr||'▶ Ir';
  el=document.getElementById('poi-ruta-btn-mapa');if(el)el.innerHTML=t.poiVerMapa||'🗺️ Ver en mapa';
  el=document.getElementById('poi-ruta-titulo');if(el)el.textContent=t.poiRutaTitulo||t.rutaLabel;
  el=document.getElementById('poi-ruta-vacia');if(el)el.textContent=t.poiRutaVacia||t.rutaVacio;
  el=document.getElementById('ruta-stat-label');if(el)el.textContent=t.rutaStatLabel;
  // Radio
  el=document.getElementById('radio-label');if(el)el.textContent=t.radioLabel;
  // Hero donate
  el=document.getElementById('hero-donate-title');if(el)el.textContent=t.heroDonateTitle;
  el=document.getElementById('hero-donate-sub');if(el)el.textContent=t.heroDonateSubu;
  el=document.getElementById('bizum-detail');if(el)el.textContent=t.bizumDetail;
  // Historia
  el=document.getElementById('historia-tag');if(el)el.textContent=t.historiaTag;
  el=document.getElementById('historia-sub');if(el)el.textContent=t.historiaSub;
  el=document.getElementById('historia-h3a');if(el)el.innerHTML=t.historiaH3a;
  el=document.getElementById('historia-h3b');if(el)el.innerHTML=t.historiaH3b;
  // Donaciones
  el=document.getElementById('don-sub');if(el)el.textContent=t.donSub;
  el=document.getElementById('footer-don-title');if(el){el.textContent=t.footerDonTitle;aplicarOndaTitulo('footer-don-title');}
  el=document.getElementById('donaciones-h2');if(el){el.innerHTML=t.donacionesH2;var fl=el.querySelector('div');if(fl){fl.id='donaciones-h2-title';aplicarOndaTitulo('donaciones-h2-title');}}
  el=document.getElementById('footer-don-sub');if(el)el.textContent=t.footerDonSub;
  el=document.getElementById('hero-donate-title');if(el)el.innerHTML=t.heroDonateTitle;
  // Instrucciones - títulos de tarjeta
  el=document.getElementById('instr-t1');if(el)el.textContent=t.instrT1;
  el=document.getElementById('instr-t2');if(el)el.textContent=t.instrT2;
  el=document.getElementById('instr-t3');if(el)el.textContent=t.instrT3;
  el=document.getElementById('instr-t4');if(el)el.textContent=t.instrT4;
  el=document.getElementById('instr-t5');if(el)el.textContent=t.instrT5;
  el=document.getElementById('instr-t6');if(el)el.textContent=t.instrT6;
  // Instrucciones - cuerpos de tarjeta
  el=document.getElementById('instr-b1');if(el)el.innerHTML=t.instrB1;
  el=document.getElementById('instr-b2');if(el)el.innerHTML=t.instrB2;
  el=document.getElementById('instr-b3');if(el)el.innerHTML=t.instrB3;
  el=document.getElementById('instr-b4');if(el)el.innerHTML=t.instrB4;
  el=document.getElementById('instr-b5');if(el)el.innerHTML=t.instrB5;
  el=document.getElementById('instr-b6');if(el)el.innerHTML=t.instrB6;
  el=document.getElementById('instr-t7');if(el)el.textContent=t.instrT7;
  el=document.getElementById('instr-b7');if(el)el.innerHTML=t.instrB7;
  el=document.getElementById('instr-t8');if(el)el.textContent=t.instrT8;
  el=document.getElementById('instr-b8');if(el)el.innerHTML=t.instrB8;
  el=document.getElementById('instr-t9');if(el)el.textContent=t.instrT9;
  el=document.getElementById('instr-b9');if(el)el.innerHTML=t.instrB9;
  el=document.getElementById('instr-t10');if(el)el.textContent=t.instrT10;
  el=document.getElementById('instr-b10');if(el)el.innerHTML=t.instrB10;
  el=document.getElementById('instr-t11');if(el)el.textContent=t.instrT11;
  el=document.getElementById('instr-b11');if(el)el.innerHTML=t.instrB11;
  if(typeof window._actualizarBotonRutaOficial==='function') window._actualizarBotonRutaOficial();
  // Instrucciones - móvil
  el=document.getElementById('instr-mobile-title');if(el)el.textContent=t.instrMobileTitle;
  el=document.getElementById('instr-ios-title');if(el)el.textContent=t.instrIosTitle;
  el=document.getElementById('instr-android-title');if(el)el.textContent=t.instrAndroidTitle;
  el=document.getElementById('instr-app-note');if(el)el.textContent=t.instrAppNote;
  // Historia párrafos
  el=document.getElementById('hist-p1');if(el)el.innerHTML=t.histP1;
  el=document.getElementById('hist-p2');if(el)el.innerHTML=t.histP2;
  el=document.getElementById('hist-p3');if(el)el.innerHTML=t.histP3;
  el=document.getElementById('hist-dest1');if(el)el.innerHTML=t.histDest1;
  el=document.getElementById('hist-p4');if(el)el.innerHTML=t.histP4;
  el=document.getElementById('hist-p5');if(el)el.innerHTML=t.histP5;
  el=document.getElementById('hist-p6');if(el)el.innerHTML=t.histP6;
  el=document.getElementById('hist-dest2');if(el)el.innerHTML=t.histDest2;
  el=document.getElementById('hist-p7');if(el)el.innerHTML=t.histP7;
  el=document.getElementById('hist-nota');if(el)el.innerHTML=t.histNota;
  // Mapa - título dinámico
  var hasGeo = typeof userLat !== 'undefined' && userLat;
  el=document.getElementById('map-title');if(el)el.innerHTML=(hasGeo?t.mapTitle:t.mapTitleNoGeo)+" <svg width='22' height='30' viewBox='0 0 22 30' fill='none' xmlns='http://www.w3.org/2000/svg' style='animation:bounceDownArrow 1.4s ease-in-out infinite;flex-shrink:0;display:inline-block;vertical-align:middle;'><path d='M11 2 L11 22 M3 15 L11 24 L19 15' stroke='#dc2626' stroke-width='4' stroke-linecap='round' stroke-linejoin='round'/></svg>";
  el=document.getElementById('map-subtitle');if(el)el.textContent=hasGeo?t.mapSubtitle:t.mapSubtitleNoGeo;
  el=document.getElementById('map-status-text');if(el&&el.textContent)el.textContent=t.mapStatus;
  // Share buttons
  el=document.getElementById('share-label-m');if(el)el.textContent=t.shareLabel;
  el=document.getElementById('share-label-hero');if(el)el.textContent=t.shareLabel;
  el=document.getElementById('share-label-footer');if(el)el.textContent=t.shareLabel;
  ['share-wa-d','share-wa-m'].forEach(function(id){var e=document.getElementById(id);if(e)e.title=t.shareWa;});
  ['share-fb-d','share-fb-m'].forEach(function(id){var e=document.getElementById(id);if(e)e.title=t.shareFb;});
  ['share-x-d','share-x-m'].forEach(function(id){var e=document.getElementById(id);if(e)e.title=t.shareX;});
  ['share-tg-d','share-tg-m'].forEach(function(id){var e=document.getElementById(id);if(e)e.title=t.shareTg;});
  // Emergencias
  el=document.getElementById('emg-univ-label');if(el)el.textContent=t.emgUnivLabel;
  el=document.getElementById('emg-pac-label');if(el)el.textContent=t.emgPacLabel;
  el=document.getElementById('emg-hosp-label');if(el)el.textContent=t.emgHospLabel;
  el=document.getElementById('emg-tip');if(el){var strong=el.querySelector('strong');var txt=t.emgTip+' ';el.textContent=txt;if(strong){el.appendChild(strong);}}
  el=document.getElementById('emg-112-label');if(el)el.innerHTML=t.emg112.replace('\n','<br/>');
  el=document.getElementById('emg-061-label');if(el)el.innerHTML=t.emg061.replace('\n','<br/>');
  el=document.getElementById('emg-062-label');if(el)el.innerHTML=t.emg062.replace('\n','<br/>');
  el=document.getElementById('emg-016-label');if(el)el.innerHTML=t.emg016.replace('\n','<br/>');
  // iOS/Android steps
  el=document.getElementById('instr-ios-steps');if(el)el.innerHTML=t.iosSteps;
  el=document.getElementById('instr-android-steps');if(el)el.innerHTML=t.androidSteps;
  // Renderizar carrusel con nuevo idioma
  renderCarrusel(categoriaActiva);
  // Actualizar botón instalar/notificaciones con el nuevo idioma
  actualizarBtnPrincipal();
  // Traducir botón y formulario añadir POI
  el=document.getElementById('btn-add-poi-txt');if(el)el.textContent=t.addPoi||'Punto';
  el=document.getElementById('btn-add-poi-map-txt');if(el)el.textContent=t.addPoi||'Punto';
  el=document.getElementById('modal-poi-title');if(el)el.textContent=t.modalPoiTitle||'📍 Añadir un punto';
  el=document.getElementById('modal-poi-sub');if(el)el.textContent=t.modalPoiSub||'';
  el=document.getElementById('lbl-poi-nombre');if(el)el.textContent=t.lblNombre||'Nombre *';
  el=document.getElementById('lbl-poi-desc');if(el)el.textContent=t.lblDesc||'Descripción';
  el=document.getElementById('lbl-poi-cat');if(el)el.textContent=t.lblCat||'Categoría *';
  el=document.getElementById('btn-alerta-label');if(el)el.textContent=t.btnAlerta||'Alerta';
  el=document.getElementById('btn-control-label');if(el)el.textContent=t.btnControl||'Control';
  el=document.getElementById('btn-recomendar-label');if(el)el.textContent=t.btnRecomendar||'Recomendar';
  // Tipo de alerta label
  el=document.getElementById('lbl-tipo-alerta');if(el)el.textContent=t.tipoAlertaLabel||'Tipo de alerta *';
  // Botones tipo alerta
  el=document.getElementById('btn-tipo-via');if(el)el.querySelector('span:last-child').textContent=t.viaCortada||'Vía cortada';
  el=document.getElementById('btn-tipo-mal');if(el)el.querySelector('span:last-child').textContent=t.malEstado||'Mal estado';
  el=document.getElementById('btn-tipo-alb');if(el)el.querySelector('span:last-child').textContent=t.albergueCerrado||'Albergue cerrado';
  // Chips caminos
  el=document.getElementById('chip-etapa-costa-btn');if(el)el.textContent=t.chipCosta||'🔵 Costa';
  el=document.getElementById('chip-etapa-interior-btn');if(el)el.textContent=t.chipInterior||'🟢 Interior';
  el=document.getElementById('chip-etapa-frances-btn');if(el)el.textContent=t.chipFrances||'🔴 Francés';
  el=document.getElementById('chip-etapa-norte-btn');if(el)el.textContent=t.chipNorte||'🟠 Norte';
  el=document.getElementById('chip-etapa-primitivo-btn');if(el)el.textContent=t.chipPrimitivo||'🟣 Primitivo';
  el=document.getElementById('chip-etapa-ingles-btn');if(el)el.textContent=t.chipIngles||'🟡 Inglés';
  // Panel Ranking
  el=document.getElementById('album-panel-titulo');if(el)el.textContent=t.rankingTitulo||'Ranking del Peregrino';
  if(el&&!el.textContent.match(/\d/)){el=document.getElementById('album-panel-contador');if(el)el.textContent=t.rankingContador||'Visita lugares del Camino para avanzar en el ranking';}
  el=document.getElementById('ranking-logros-label');if(el)el.textContent=t.rankingLogros||'Logros';
  el=document.getElementById('ranking-stats-label');if(el)el.textContent=t.rankingEstadisticas||'Estadísticas';
  el=document.getElementById('tablero-hard-reset-btn');if(el)el.textContent=t.rankingHardReset||'🗑️ Borrar cromos y visitas';
  el=document.getElementById('album-panel-volver');if(el)el.textContent=t.btnVolver||'← Volver';
  el=document.getElementById('tablero-panel-volver');if(el)el.textContent=t.btnVolver||'← Volver';
  var _elSigInit=document.getElementById('ap-rank-siguiente');
  if(_elSigInit&&_elSigInit.textContent&&!_elSigInit.textContent.match(/\d/))_elSigInit.textContent=t.rankingPrimer||'Visita tu primer lugar para comenzar';
  var _elCountInit=document.getElementById('ap-rank-count');
  if(_elCountInit&&_elCountInit.textContent==='0 visitas')_elCountInit.textContent='0 '+(t.rankingVisitas||'visitas');
  // Panel Colección
  el=document.getElementById('tablero-super-titulo');if(el)el.textContent=t.coleccionSuper||'Juego de la Oca Jacobeo';
  el=document.getElementById('tablero-titulo');if(el)el.textContent=t.coleccionTitulo||'🐚 Colección del Peregrino';
  if(el){el=document.getElementById('tablero-contador');if(el&&!el.textContent.match(/\d/))el.textContent=t.coleccionVacio||'Visita lugares para obtener cromos';}
  // Chips poi-drawer barra inferior
  el=document.getElementById('chip-album-drawer');if(el)el.textContent=t.chipAlbum||'📷 Mi Álbum';
  el=document.getElementById('chip-alerta-drawer');if(el)el.textContent=t.chipAlertas||'🚨 Alertas';
  el=document.getElementById('chip-ranking-drawer');if(el)el.textContent=t.chipRankingDrawer||'🏅 Ranking';
  el=document.getElementById('chip-ruta-drawer');if(el)el.textContent=t.chipRutaDrawer||'🗺️ Ruta';
  // Chips categoría poi-drawer-filtros
  el=document.getElementById('chip-todos-drawer');if(el)el.textContent=t.chipTodos2||'📍 Todos';
  el=document.getElementById('chip-naturaleza-drawer');if(el)el.textContent=t.chipNaturaleza2||'🌿 Naturaleza';
  el=document.getElementById('chip-monumento-drawer');if(el)el.textContent=t.chipMonumento2||'🏛️ Monumentos';
  el=document.getElementById('chip-religiosa-drawer');if(el)el.textContent=t.chipReligiosa||'⛪ Religiosa';
  el=document.getElementById('chip-historica-drawer');if(el)el.textContent=t.chipHistorica||'📜 Histórica';
  el=document.getElementById('chip-arqueologico-drawer');if(el)el.textContent=t.chipArqueologico||'🔍 Arqueológico';
  el=document.getElementById('chip-albergue-drawer');if(el)el.textContent=t.chipAlbergue2||'🏠 Albergues';
  el=document.getElementById('chip-mirador-drawer');if(el)el.textContent=t.chipMirador2||'🔭 Miradores';
  // Chips mapa (visitados/sin visitar/usuario/alertas)
  el=document.getElementById('chip-usuario-mapa');if(el)el.innerHTML='👤 '+(t.chipUsuario||'Mis puntos');
  el=document.getElementById('chip-usuario-drawer');if(el)el.innerHTML='👤 '+(t.chipUsuario||'Mis puntos');
  el=document.getElementById('chip-alerta-mapa');if(el)el.textContent=t.chipAlertas||'🚨 Alertas';
  // Chips mapa visitados/sin visitar - update all static buttons by text match
  // Chips mapa estáticos — por ID directo
  el=document.getElementById('chip-mapa-todos');if(el)el.textContent=t.chipTodos2||'📍 Todos';
  el=document.getElementById('chip-mapa-visitados');if(el)el.textContent=t.chipVisitados||'👁️ Visitados';
  el=document.getElementById('chip-mapa-sinvisitar');if(el)el.textContent=t.chipSinVisitar||'🔒 Sin visitar';
  el=document.getElementById('chip-mapa-costa');if(el)el.textContent=t.chipCosta||'🔵 Costa';
  el=document.getElementById('chip-mapa-interior');if(el)el.textContent=t.chipInterior||'🟢 Interior';
  el=document.getElementById('chip-mapa-frances');if(el)el.textContent=t.chipFrances||'🔴 Francés';
  el=document.getElementById('chip-mapa-norte');if(el)el.textContent=t.chipNorte||'🟠 Norte';
  el=document.getElementById('chip-mapa-primitivo');if(el)el.textContent=t.chipPrimitivo||'🟣 Primitivo';
  el=document.getElementById('chip-mapa-ingles');if(el)el.textContent=t.chipIngles||'🟡 Inglés';
  el=document.getElementById('chip-mapa-religiosa');if(el)el.textContent=t.chipReligiosa||'⛪ Religiosa';
  el=document.getElementById('chip-mapa-arq');if(el)el.textContent=t.chipArqueologico||'🔍 Arqueológico';
  el=document.getElementById('chip-mapa-albergue');if(el)el.textContent=t.chipAlbergue2||'🏠 Albergues';
  el=document.getElementById('chip-mapa-hist');if(el)el.textContent=t.chipHistorica||'📜 Histórica';
  el=document.getElementById('chip-mapa-loc');if(el)el.textContent=t.chipHist||'📜 Localizaciones';
  el=document.getElementById('chip-mapa-mon');if(el)el.textContent=t.chipMonumento2||'🏛️ Monumentos';
  el=document.getElementById('chip-mapa-mir');if(el)el.textContent=t.chipMirador2||'🔭 Miradores';
  el=document.getElementById('chip-mapa-nat');if(el)el.textContent=t.chipNaturaleza2||'🌿 Naturaleza';
  // Botones ranking panel
  document.querySelectorAll('#album-panel button').forEach(function(b){
    var txt=b.textContent.trim();
    if(txt.includes('Colecci')) b.textContent='🐚 '+(t.btnColeccion||'Colección');
    if(txt.includes('lbum')&&!txt.includes('Volver')) b.textContent='📷 '+(t.btnAlbumRec||'Álbum');
    if(txt.includes('Por ver')||txt.includes('To visit')||txt.includes('ver')) b.textContent='🔒 '+(t.btnPorVer||'Por ver');
  });
  // Panel ranking título y contador
  el=document.getElementById('album-panel-titulo');if(el)el.textContent=t.rankingTitulo||'Ranking del Peregrino';
  el=document.getElementById('album-panel-contador');if(el&&!el.textContent.match(/\d/))el.textContent=t.rankingContador||'Visita lugares del Camino para avanzar en el ranking';
  el=document.getElementById('ranking-stats-label');if(el)el.textContent=t.rankingEstadisticas||'Estadísticas';
  el=document.getElementById('tablero-hard-reset-btn');if(el)el.textContent=t.rankingHardReset||'🗑️ Borrar cromos y visitas';
  el=document.getElementById('album-panel-volver');if(el)el.textContent=t.btnVolver||'← Volver';
  el=document.getElementById('tablero-panel-volver');if(el)el.textContent=t.btnVolver||'← Volver';
  var _elSigInit2=document.getElementById('ap-rank-siguiente');
  if(_elSigInit2&&_elSigInit2.textContent&&!_elSigInit2.textContent.match(/\d/))_elSigInit2.textContent=t.rankingPrimer||'Visita tu primer lugar para comenzar';
  var _elCountInit2=document.getElementById('ap-rank-count');
  if(_elCountInit2&&_elCountInit2.textContent&&!_elCountInit2.textContent.match(/[1-9]/))_elCountInit2.textContent='0 '+(t.rankingVisitas||'visitas');
  // Panel álbum recuerdos vacío
  el=document.getElementById('album-rec-vacio');if(el){var vt=el.querySelector('div:nth-child(2)');if(vt)vt.textContent=t.albumVacio||'Tu álbum está vacío';}
  // Botones volver álbum recuerdos
  el=document.querySelector('#album-recuerdos-drawer button');if(el&&el.textContent.includes('Volver')||el&&el.textContent.includes('Back'))el.textContent=t.btnVolver||'← Volver';
  // Botones Volver (todos los drawers)
  var volverTxt = t.btnVolver||'← Volver';
  ['brujula-panel-volver','sos-panel-volver','meteo-panel-volver','historia-panel-volver-top',
   'tablero-panel-volver',
   'historia-panel-volver-bot','poi-panel-volver','don-panel-volver','addpoi-panel-volver',
   'comousar-panel-volver-top','comousar-panel-volver-bot','contacto-panel-volver',
   'contacto-panel-volver-bot','album-panel-volver','album-drawer-volver'
  ].forEach(function(id){el=document.getElementById(id);if(el)el.textContent=volverTxt;});
  // Álbum vacío
  el=document.getElementById('album-vacio-txt');if(el)el.textContent=t.albumVacio||'Tu álbum está vacío';
  el=document.getElementById('ap-album-vacio-txt');if(el)el.textContent=t.albumVacio||'Tu álbum está vacío';
  // Contadores álbum
  el=document.getElementById('album-contador');if(el&&!el.textContent.match(/\d/))el.textContent=t.albumContador||'Visita lugares para desbloquear cromos';
  el=document.getElementById('album-panel-contador');if(el&&!el.textContent.match(/\d/))el.textContent=t.albumContador||'Visita lugares para desbloquear cromos';
  el=document.getElementById('lbl-poi-ubic');if(el)el.textContent=t.lblUbic||'Ubicación *';
  el=document.getElementById('btn-mi-ubic-txt');if(el)el.textContent=t.btnMiUbic||'Usar mi ubicación';
  el=document.getElementById('btn-marcar-mapa-txt');if(el)el.textContent=t.btnMarcarMapa||'Marcar en el mapa';
  el=document.getElementById('btn-poi-cancelar');if(el)el.textContent=t.btnCancelar||'Cancelar';
  el=document.getElementById('btn-poi-guardar-txt');if(el)el.textContent=t.btnGuardar||'Guardar punto';
  // Paneles — botones Volver al mapa
  ['brujula-panel-volver','sos-panel-volver','meteo-panel-volver','historia-panel-volver-top','historia-panel-volver-bot','don-panel-volver','addpoi-panel-volver','comousar-panel-volver-top','comousar-panel-volver-bot','contacto-panel-volver','contacto-panel-volver-bot'].forEach(function(id){
    var e=document.getElementById(id);if(e)e.textContent=t.volverMapa||'← Volver';
  });
  // Panel POI — botón ← Mapa y botón Ruta
  el=document.getElementById('poi-panel-volver');if(el)el.textContent=t.volverMapaCorto||'← Mapa';
  // Panel Brújula — etiquetas
  el=document.getElementById('brujula-norte-label');if(el)el.textContent=t.brujulaNorte||'Norte';
  el=document.getElementById('brujula-stgo-label');if(el)el.textContent=t.brujulaSantiago||'Santiago';
  el=document.getElementById('brujula-casco-txt');if(el)el.innerHTML=t.brujulaAvisoFlechas||'La aguja a Santiago marca la <strong>dirección en línea recta</strong>, no el trazado del Camino. Sigue siempre las <strong>flechas amarillas</strong> y el trazado oficial del mapa: rodean ríos, montes y vías intransitables.';
  el=document.getElementById('brujula-h2');if(el)el.textContent=t.brujulaTitulo||'Brújula';
  el=document.getElementById('historia-drawer-title');if(el)el.textContent=t.historiaDrawerTitulo||'Historia Xacobea';
  el=document.getElementById('historia-drawer-sub');if(el)el.textContent=t.historiaDrawerSub||'Vieira, Temple y el Camino de Santiago';
  el=document.getElementById('comousar-panel-sub');if(el)el.textContent=t.comoUsarPanelSub||t.comoUsarSub||'Instrucciones básicas';
  el=document.getElementById('meteo-header-loc');if(el)el.textContent=t.meteoPrevision||'🌤️ Previsión';
  el=document.getElementById('brujula-panel-volver');if(el)el.textContent=t.btnVolver||'← Volver';
  el=document.getElementById('sos-panel-volver');if(el)el.textContent=t.btnVolver||'← Volver';
  el=document.getElementById('don-panel-volver');if(el)el.textContent=t.btnVolver||'← Volver';
  el=document.getElementById('contacto-panel-volver');if(el)el.textContent=t.btnVolver||'← Volver';
  el=document.getElementById('contacto-panel-volver-bot');if(el)el.textContent=t.btnVolver||'← Volver';
  el=document.getElementById('historia-panel-volver-top');if(el)el.textContent=t.btnVolver||'← Volver';
  el=document.getElementById('historia-panel-volver-bot');if(el)el.textContent=t.btnVolver||'← Volver';
  el=document.getElementById('btn-porver-ranking');if(el)el.textContent='🔒 '+(t.btnPorVer||'Por ver');
  el=document.getElementById('btn-album-ranking');if(el)el.textContent='📷 '+(t.btnAlbumRec||'Álbum');
  el=document.getElementById('btn-ranking-coleccion');if(el)el.textContent='🐚 '+(t.btnColeccion||'Colección');
  el=document.getElementById('tablero-vacio-txt');if(el)el.textContent=t.tablerovacioTxt||t.coleccionVacio||'Visita lugares del Camino para obtener cromos';
  el=document.getElementById('brujula-sub');if(el)el.textContent=t.brujulaSub||'Norte magnético y rumbo a Santiago';
  el=document.getElementById('brujula-drawer-label');if(el&&el.textContent!=='Desactivar')el.textContent=t.brujulaActivar||'Activar';
  el=document.getElementById('btn-refrescar-brujula');if(el&&el.style.display!=='none')el.textContent=t.brujulaRecalibrar||'↺ Recalibrar';
  // Panel Meteo
  el=document.getElementById('meteo-resumen-dia-label');if(el)el.textContent=t.meteoResumenDia||'Resumen del día';
  // Panel SOS — Cruz Roja label
  el=document.getElementById('sos-cruzroja-label');if(el)el.textContent=t.cruzRojaLabel||'Cruz Roja · Camino de Santiago';
  // Panel Cómo usar
  el=document.getElementById('comousar-h2-panel');if(el)el.textContent=t.comoUsarPanelTitulo||t.comoUsarH2;

  // ── LANDING DESKTOP ──────────────────────────────────────
  var dl = window._dlT && window._dlT[lang] ? window._dlT[lang] : window._dlT && window._dlT.es;
  if(dl){
    var _s=function(id,txt){var e=document.getElementById(id);if(e)e.textContent=txt;};
    var _h=function(id,txt){var e=document.getElementById(id);if(e)e.innerHTML=txt;};
    var _dlEy=document.getElementById('dl-eyebrow');
    if(_dlEy){var _et=_dlEy.querySelector('.ey-text');if(_et)_et.textContent=dl.eyebrow;}
    // _s('dl-eyebrow', dl.eyebrow); — gestionado por spans internos
    _h('dl-hero-title',    dl.heroTitle);
    _s('dl-hero-desc',     dl.heroDesc);
    _s('dl-btn-movil',     dl.btnMovil);
    _s('dl-meta-gratis',   dl.metaGratis);
    _s('dl-meta-gratis2',  dl.metaGratis2);
    _s('dl-meta-gratis3',  dl.metaGratis3);
    _s('dl-meta-rutas',    dl.metaRutas);
    _s('dl-meta-offline',  dl.metaOffline);
    _s('dl-stat-poi',      dl.statPoi);
    _s('dl-stat-etapas',   dl.statEtapas);
    _s('dl-stat-coste',    dl.statCoste);
    _s('dl-feat-title',    dl.featTitle);
    _s('dl-feat-sub',      dl.featSub);
    _s('dl-f0-t',dl.f0t);_s('dl-f0-d',dl.f0d);_s('dl-f0-badge',dl.f0badge);
    _s('dl-fsim-t',dl.fsimt);_s('dl-fsim-d',dl.fsimd);_s('dl-fsim-badge',dl.fsimbadge);
    _s('dl-f1-t',dl.f1t);_s('dl-f1-d',dl.f1d);
    _s('dl-f2-t',dl.f2t);_s('dl-f2-d',dl.f2d);
    _s('dl-f3-t',dl.f3t);_s('dl-f3-d',dl.f3d);
    _s('dl-f4-t',dl.f4t);_s('dl-f4-d',dl.f4d);
    _s('dl-f5-t',dl.f5t);_s('dl-f5-d',dl.f5d);
    _s('dl-f6-t',dl.f6t);_s('dl-f6-d',dl.f6d);
    _s('dl-f7-t',dl.f7t);_s('dl-f7-d',dl.f7d);
    _s('dl-f8-t',dl.f8t);_s('dl-f8-d',dl.f8d);
    _s('dl-f9-t',dl.f9t);_s('dl-f9-d',dl.f9d);
    _s('dl-f10-t',dl.f10t);_s('dl-f10-d',dl.f10d);
    _s('dl-f11-t',dl.f11t);_s('dl-f11-d',dl.f11d);
    _s('dl-gal-title',   dl.galTitle);
    _s('dl-gal-sub',     dl.galSub);
    _s('dl-gal1',dl.gal1);_s('dl-gal1-inner',dl.gal1i);
    _s('dl-gal2',dl.gal2);_s('dl-gal2-inner',dl.gal2i);
    _s('dl-gal3',dl.gal3);_s('dl-gal3-inner',dl.gal3i);
    _s('dl-gal4',dl.gal4);_s('dl-gal4-inner',dl.gal4i);
    _s('dl-gal5',dl.gal5);_s('dl-gal5-inner',dl.gal5i);
    _s('dl-gal6',dl.gal6);
    _s('dl-gal7',dl.gal7);
    _s('dl-gal-hint',    dl.galHint);
    _s('dl-rut-title',   dl.rutTitle);
    _s('dl-rut-sub',     dl.rutSub);
    _s('dl-rut1',dl.rut1);_s('dl-rut2',dl.rut2);_s('dl-rut3',dl.rut3);
    _s('dl-rut4',dl.rut4);_s('dl-rut5',dl.rut5);
    _s('dl-qr-eyebrow',  dl.qrEyebrow);
    _s('dl-qr-title',    dl.qrTitle);
    _s('dl-qr-desc',     dl.qrDesc);
    _s('dl-qr-s1',dl.qrS1);_s('dl-qr-s2',dl.qrS2);
    _s('dl-qr-s3',dl.qrS3);_s('dl-qr-s4',dl.qrS4);
    _s('dl-foot-sub',    dl.footSub);
    // Nav header desktop landing
    var _dlNav=document.querySelector('.dl-header-nav');
    if(_dlNav){
      var _na=_dlNav.querySelectorAll('a');
      if(_na[0])_na[0].textContent=dl.navFunciones;
      if(_na[1])_na[1].textContent=dl.navCapturas;
      if(_na[2])_na[2].textContent=dl.navRutas;
      if(_na[3])_na[3].textContent=dl.navQr;
    }
    // Badge header
    var _badge=document.querySelector('.dl-header-badge');
    if(_badge)_badge.textContent=dl.badge;
  }
}

// ============================================================
// WIDGET DEL TIEMPO — previsión 4 horas — Open-Meteo
// ============================================================
var WMO_ICONS = {
  0:'☀️',1:'🌤️',2:'⛅',3:'☁️',
  45:'🌫️',48:'🌫️',
  51:'🌦️',53:'🌦️',55:'🌧️',
  61:'🌦️',63:'🌧️',65:'🌧️',
  71:'🌨️',73:'❄️',75:'❄️',
  80:'🌦️',81:'🌧️',82:'⛈️',
  95:'⛈️',96:'⛈️',99:'⛈️'
};

function cargarTiempo(lat, lng) {
  // Actualizar header del panel meteo con ubicación y fecha
  var locEl = document.getElementById('meteo-header-loc');
  var fechaEl = document.getElementById('meteo-header-fecha');
  // fecha movida al bloque del casco
  if (locEl) {
    // Geocodificación inversa ligera con Nominatim
    fetch('https://nominatim.openstreetmap.org/reverse?lat='+lat+'&lon='+lng+'&format=json&accept-language=es')
      .then(function(r){return r.json();})
      .then(function(d){
        var lugar = d.address && (d.address.city || d.address.town || d.address.village || d.address.municipality) || '';
        if (locEl) locEl.textContent = (lugar ? '📍 ' + lugar : '🌤️ Previsión');
      }).catch(function(){});
  }
  var url = 'https://api.open-meteo.com/v1/forecast?latitude=' + lat +
    '&longitude=' + lng +
    '&hourly=temperature_2m,weathercode,precipitation_probability' +
    '&timezone=Europe/Madrid&forecast_days=1';
  var xhr = new XMLHttpRequest();
  xhr.open('GET', url, true);
  xhr.onreadystatechange = function() {
    if (xhr.readyState !== 4 || xhr.status !== 200) return;
    try {
      var data = JSON.parse(xhr.responseText);
      var widget = document.getElementById('weather-widget');
      if (!widget) return;

      // Encontrar la hora actual en el array
      var now = new Date();
      var horaActual = now.getHours();
      var times = data.hourly.time;
      var currentIdx = 0;
      for (var i = 0; i < times.length; i++) {
        var h = parseInt(times[i].split('T')[1].split(':')[0]);
        if (h === horaActual) { currentIdx = i; break; }
      }

      // Construir las 4 horas (ahora + 3 siguientes)
      var html = '';
      for (var j = 0; j < 4; j++) {
        var idx = currentIdx + j;
        if (idx >= times.length) break;
        var hora = times[idx].split('T')[1].substring(0,5);
        var temp = Math.round(data.hourly.temperature_2m[idx]);
        var code = data.hourly.weathercode[idx];
        var prob = data.hourly.precipitation_probability[idx];
        var icon = WMO_ICONS[code] || '🌡️';
        var etiqueta = j === 0 ? 'Ahora' : hora;
        html +=
          '<div class="weather-hora">' +
            '<span class="weather-hora-label">' + etiqueta + '</span>' +
            '<span class="weather-hora-icon">' + icon + '</span>' +
            '<span class="weather-hora-temp">' + temp + '°</span>' +
            (prob > 20 ? '<span class="weather-hora-lluvia">💧' + prob + '%</span>' : '') +
          '</div>';
      }
      widget.innerHTML = html;
      widget.title = 'Previsión en ' + (lat === 42.2328 ? 'Vigo' : 'tu ubicación');
      var rowM = document.getElementById('weather-row-mobile');
      if (rowM) {
        var htmlM = '';
        for (var k = 0; k < 8; k++) {
          var im = currentIdx + k;
          if (im >= times.length) break;
          var hm = times[im].split('T')[1].substring(0,5);
          var tm = Math.round(data.hourly.temperature_2m[im]);
          var cm = data.hourly.weathercode[im];
          var pm = data.hourly.precipitation_probability[im];
          htmlM += '<div class="weather-hora">' +
            '<span class="weather-hora-label">' + (k===0?'Ahora':hm) + '</span>' +
            '<span class="weather-hora-icon">' + (WMO_ICONS[cm]||'&#127749;') + '</span>' +
            '<span class="weather-hora-temp">' + tm + '&deg;</span>' +
            (pm>20?'<span class="weather-hora-lluvia">&#128167;'+pm+'%</span>':'') +
            '</div>';
        }
        rowM.innerHTML = htmlM;
      }
      // En móvil: mostrar más horas (hasta 8) para rellenar el ancho
      var widgetMobile = document.getElementById('weather-widget-mobile');
      if (widgetMobile) {
        var htmlMobile = '';
        for (var k = 0; k < 8; k++) {
          var idxM = currentIdx + k;
          if (idxM >= times.length) break;
          var horaM = times[idxM].split('T')[1].substring(0,5);
          var tempM = Math.round(data.hourly.temperature_2m[idxM]);
          var codeM = data.hourly.weathercode[idxM];
          var probM = data.hourly.precipitation_probability[idxM];
          var iconM = WMO_ICONS[codeM] || '🌡️';
          var etiquetaM = k === 0 ? 'Ahora' : horaM;
          htmlMobile +=
            '<div class="weather-hora">' +
              '<span class="weather-hora-label">' + etiquetaM + '</span>' +
              '<span class="weather-hora-icon">' + iconM + '</span>' +
              '<span class="weather-hora-temp">' + tempM + '°</span>' +
              (probM > 20 ? '<span class="weather-hora-lluvia">💧' + probM + '%</span>' : '') +
            '</div>';
        }
        widgetMobile.innerHTML = htmlMobile;
      }
    } catch(e) {
      var w = document.getElementById('weather-widget');
      if (w) w.style.display = 'none';
    }
  };
  xhr.send();
}

function iniciarTiempo() {
  cargarTiempo(42.2328, -8.7243); // Vigo por defecto
  setInterval(function() {
    cargarTiempo(userLat || 42.2328, userLng || -8.7243);
  }, 1800000);
}

// ── CONTADOR ANIMADO DE STATS (landing desktop) ─────────────
function _dlAnimarStat(el) {
  if (!el || el.dataset.dlDone) return;
  el.dataset.dlDone = '1';
  var target = parseInt(el.getAttribute('data-target'), 10) || 0;
  var valueEl = el.querySelector('.dl-stat-num-value');
  if (!valueEl) return;
  var duration = 900; // sube rápido
  var startTime = null;
  function _step(ts) {
    if (!startTime) startTime = ts;
    var progress = Math.min((ts - startTime) / duration, 1);
    var eased = 1 - Math.pow(1 - progress, 3); // ease-out
    valueEl.textContent = Math.floor(eased * target);
    if (progress < 1) {
      requestAnimationFrame(_step);
    } else {
      valueEl.textContent = target;
      el.classList.add('dl-pulse-end');
      setTimeout(function () { el.classList.remove('dl-pulse-end'); }, 600);
    }
  }
  requestAnimationFrame(_step);
}
document.addEventListener('DOMContentLoaded', function () {
  var statsWrap = document.querySelector('.dl-stats');
  if (!statsWrap) return;
  var nums = statsWrap.querySelectorAll('.dl-stat-num[data-target]');
  if (!nums.length) return;
  if ('IntersectionObserver' in window) {
    var _dlObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          nums.forEach(function (n) { _dlAnimarStat(n); });
          _dlObs.disconnect();
        }
      });
    }, { threshold: 0.3 });
    _dlObs.observe(statsWrap);
  } else {
    nums.forEach(function (n) { _dlAnimarStat(n); });
  }
});

// ARRANCAR
// Siempre comenzar en el hero al cargar o refrescar
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
// Atajo teclado para moderación: Ctrl + Shift + M
document.addEventListener('keydown', function(e) {
  if (e.ctrlKey && e.shiftKey && e.key === 'M') { e.preventDefault(); abrirAdmin(); }
});
// Solo reseteamos el scroll en la carga inicial (persisted=true significa
// que viene del bfcache/background — en ese caso NO tocamos el scroll).
window.addEventListener('pageshow', function(e) {
  if (!e.persisted) window.scrollTo(0, 0);
});
// Acceso por URL: guiabuencamino.blogspot.com#moderacion
window.addEventListener('hashchange', function() {
  if (window.location.hash === '#moderacion') { window.location.hash = ''; abrirAdmin(); }
});
if (window.location.hash === '#moderacion') { window.location.hash = ''; setTimeout(abrirAdmin, 1500); }

document.addEventListener('DOMContentLoaded', function() {
  // Pintar botón campana según estado inicial (notifActivadas puede ser false)
  setTimeout(function(){ _actualizarBtnAlertas(); }, 100);
  // Bloquear orientación portrait en Android standalone
  if (screen.orientation && screen.orientation.lock) {
    screen.orientation.lock('portrait').catch(function(){});
  }
  // Arrancar en modo pantalla completa en móvil/app
  if ((window.innerWidth <= 768 || window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches) && window.innerWidth < 900) {
    setTimeout(function(){ if (!_mapaExpandido) { _toggleMapaExpandido(); cambiarIdioma(idiomaActual); } }, 300);
  }
  var input=document.getElementById('buscar-input');
  if(input)input.addEventListener('keydown',function(e){if(e.key==='Enter')ejecutarBusqueda();});
  var c=document.getElementById('carousel');
  if(c){
    // Arrastrar
    var isDown=false,startX,scrollLeft,dragged=false;
    c.addEventListener('mousedown',function(e){isDown=true;dragged=false;startX=e.pageX-c.offsetLeft;scrollLeft=c.scrollLeft;});
    c.addEventListener('mouseleave',function(){isDown=false;});
    c.addEventListener('mouseup',function(){isDown=false;});
    // Close expanded cards on native scroll (touch swipe on mobile)
    c.addEventListener('scroll',function(){
      c.querySelectorAll('.poi-desc.expanded').forEach(function(d){
        d.classList.remove('expanded');
        var btn=d.nextElementSibling;
        if(btn&&btn.classList.contains('poi-leer-mas'))
          btn.innerHTML=(T[idiomaActual]||T.es).leerMas;
      });
      // Restaurar botón añadir punto al colapsar por scroll
      var btnAdd = document.getElementById('btn-add-poi-map');
      if (btnAdd && !_navActiva) btnAdd.style.display = 'flex';
    });
    c.addEventListener('mousemove',function(e){if(!isDown)return;e.preventDefault();
      if(!dragged){
        // Close any open leer-mas card when drag starts
        c.querySelectorAll('.poi-leer-mas.open').forEach(function(btn){btn.click();});
        var openDescs=c.querySelectorAll('.poi-extra[style*="block"]');
        openDescs.forEach(function(d){d.style.display='none';d.style.maxHeight='0';});
      }
      dragged=true;c.scrollLeft=scrollLeft-(e.pageX-c.offsetLeft-startX)*1.5;});
    // Delegacion de eventos — estrellas, enviar, ruta, llegar
    c.addEventListener('click', function(e) {
      var tgt = e.target;
      // Estrella
      if (tgt.classList.contains('star')) {
        e.stopPropagation();
        votar(tgt); return;
      }
      // Botón enviar opinión
      if (tgt.classList.contains('opinion-send')) {
        e.stopPropagation();
        enviarOpinion(tgt); return;
      }
      // Botón añadir a ruta
      if (tgt.classList.contains('poi-ruta-btn') || tgt.closest('.poi-ruta-btn')) {
        e.stopPropagation();
        var btn = tgt.classList.contains('poi-ruta-btn') ? tgt : tgt.closest('.poi-ruta-btn');
        addToRoute(btn.getAttribute('data-poi')); return;
      }
      // Botón cómo llegar
      if (tgt.classList.contains('poi-btn')) {
        e.stopPropagation();
        irDesdeCarrusel(tgt.getAttribute('data-id') || ''); return;
      }
      // Input opinión — no propagar al card
      if (tgt.classList.contains('opinion-input')) {
        e.stopPropagation(); return;
      }
      // Click en card — ir al mapa (excepto zona de imagen)
      var card = tgt.closest('.poi-card');
      if (card && !dragged) {
        if (tgt.closest('.poi-img')) return; // click en imagen: no hacer nada
        var lat = card.querySelector('.poi-btn') ? parseFloat(card.querySelector('.poi-btn').getAttribute('data-lat')) : null;
        // No hacer nada si no hay lat — el card hace verEnMapa por su propio onclick
      }
    });
  }
  // Trabajo pesado del MAPA (Leaflet + cluster + 774 marcadores + Firebase).
  // Esto es lo que disparaba un Total Blocking Time enorme en móvil: antes se
  // ejecutaba de golpe y síncrono durante la carga, aunque el mapa ni siquiera
  // estuviera a la vista. Ahora lo diferimos hasta que el contenedor del mapa
  // se acerca al viewport (IntersectionObserver). Así el hilo principal queda
  // libre durante el primer pintado y la métrica de interactividad mejora.
  function _initMapaPesada() {
    if (window._mapaPesadaArrancada) return;
    window._mapaPesadaArrancada = true;
    initMapa();
    cargarDatosFirebase();
    cargarPOIsUsuario();
    cargarPOIsFirebase();
    iniciarTiempo();
  }

  // Trabajo ligero y visible de inmediato: el carrusel de POIs de la portada.
  renderCarrusel('todos');

  (function _programarMapa() {
    var cont = document.getElementById('map-block') || document.getElementById('map');
    // Si no hay contenedor o no hay IntersectionObserver, caemos a un diferido
    // por tiempo de inactividad para no bloquear el arranque.
    if (!cont || !('IntersectionObserver' in window)) {
      if (window.requestIdleCallback) requestIdleCallback(_initMapaPesada, { timeout: 3000 });
      else setTimeout(_initMapaPesada, 1500);
      return;
    }
    var obs = new IntersectionObserver(function(entries) {
      for (var i = 0; i < entries.length; i++) {
        if (entries[i].isIntersecting) {
          obs.disconnect();
          _initMapaPesada();
          break;
        }
      }
    }, { rootMargin: '600px' });  // arranca un poco antes de que entre en pantalla
    obs.observe(cont);
    // Red de seguridad: si el usuario nunca llega al mapa, lo arrancamos en
    // segundo plano tras unos segundos de inactividad para que esté listo si
    // navega por anclas o usa el buscador.
    if (window.requestIdleCallback) {
      requestIdleCallback(function(){ _initMapaPesada(); }, { timeout: 8000 });
    } else {
      setTimeout(_initMapaPesada, 6000);
    }
  })();
  iniciarGaleria();
  iniciarPhoneCarrusel();

  // Relanzar galería al girar pantalla (iPad landscape)
  window.addEventListener('resize', function() {
    if (!_galeriaIniciada && window.innerWidth >= 769) {
      iniciarGaleria();
    }
  });
  iniciarFrases();
  cambiarIdioma(idiomaActual);
  actualizarBtnPrincipal();
  // Segunda pasada para elementos que cargan tarde
  setTimeout(function(){ cambiarIdioma(idiomaActual); }, 800);
  // Mantener chip-mapa-todos traducido (se puede resetear por orden de init)
  setInterval(function(){
    var el=document.getElementById('chip-mapa-todos');
    if(!el) return;
    var t=T[idiomaActual]||T.es;
    var expected=t.chipTodos2||'📍 Todos';
    if(el.textContent!==expected) el.textContent=expected;
  }, 500);
  setTimeout(actualizarBtnPrincipal, 500);

  // LISTENER GLOBAL para elementos interactivos de tarjetas
  // Funciona aunque Blogger bloquee onclick inline en HTML dinámico
  document.addEventListener('click', function(e) {
    var t = e.target;
    if (t.getAttribute && t.getAttribute('data-star'))
    // Usar classList.contains para máxima compatibilidad
    // Mismo patrón que test-estrellas.html que funciona
    if (t.getAttribute('data-star') === '1') {
      votarEstrella(t.getAttribute('data-id'), +t.getAttribute('data-n'));
      return;
    }
    if (t.classList && t.classList.contains('opinion-send')) {
      enviarOpinion(t); return;
    }
    if (t.classList && t.classList.contains('poi-ruta-btn')) {
      addToRoute(t.getAttribute('data-poi')); return;
    }
    if (t.classList && t.classList.contains('poi-btn') && t.getAttribute('data-lat')) {
      irDesdeCarrusel(t.getAttribute('data-id') || ''); return;
    }
    // Click en tarjeta → ir al mapa (excepto zona de imagen)
    var card = t.closest ? t.closest('.poi-card') : null;
    if (card && card.getAttribute('data-poi-id')) {
      if (t.closest('.poi-img')) return; // click en imagen: no hacer nada
      var pid = card.getAttribute('data-poi-id');
      var p = PUNTOS.find(function(x){ return x.id===pid; });
      if (p) verEnMapa(p.lat, p.lng);
    }
  });
});


