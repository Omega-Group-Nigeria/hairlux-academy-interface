/**
 * Hairlux Academy PWA bootstrap: include on every page (before </body>).
 *  1. Registers the service worker (sw.js at the site root).
 *  2. Offers "Install the Hairlux app": Android/desktop Chrome & Edge via the
 *     browser's install prompt; iPhone/iPad via "Share → Add to Home Screen".
 *  3. When a new version of the site is deployed, offers "Refresh".
 * Works from both root pages (assets/js/pwa.js) and /app/ pages (../assets/js/pwa.js):
 * the site root is worked out from this script's own URL.
 */
(function () {
  'use strict';
  if (!('serviceWorker' in navigator)) return;

  var script = document.currentScript || document.querySelector('script[src*="assets/js/pwa.js"]');
  var ROOT = new URL('../../', script ? script.src : location.href).href; // …/assets/js/pwa.js → site root
  var DISMISS_KEY = 'hxacademy_pwa_install_dismissed_at';
  var DISMISS_DAYS = 14;

  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (_) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (_) { /* private mode */ } },
  };

  var isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  var ua = navigator.userAgent || '';
  var isIOS = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var isIOSSafari = isIOS && /safari/i.test(ua) && !/crios|fxios|edgios|opios/i.test(ua);
  var path = location.pathname.replace(ROOT.replace(location.origin, ''), '/');
  // Offer install only where it makes sense: the home page and the customer app.
  var isInstallPage = /^\/(?:index\.html|courses\.html|training\.html)?$/.test(path) || /^\/app\//.test(path);

  // ── Styles (injected once; follow the site's light/dark theme) ──────────
  function injectStyles() {
    if (document.getElementById('hlx-pwa-style')) return;
    var css = '' +
      '.hlx-pwa-bar{position:fixed;left:50%;bottom:16px;transform:translate(-50%,140%);z-index:99999;width:calc(100% - 24px);max-width:460px;' +
      'display:flex;align-items:center;gap:12px;padding:12px 12px 12px 14px;border-radius:16px;background:#fff;color:#161616;' +
      'box-shadow:0 14px 40px rgba(0,0,0,.18);border:1px solid rgba(157,130,72,.35);font:14px/1.4 Inter,system-ui,sans-serif;transition:transform .35s ease}' +
      '.hlx-pwa-bar.is-open{transform:translate(-50%,0)}' +
      '.hlx-pwa-bar img{width:44px;height:44px;border-radius:10px;flex:none}' +
      '.hlx-pwa-text{flex:1;min-width:0}.hlx-pwa-text b{display:block;font-size:14px}.hlx-pwa-text span{font-size:12.5px;color:#6c757d}' +
      '.hlx-pwa-btn{border:0;border-radius:999px;padding:9px 16px;font-weight:700;font-size:13px;cursor:pointer;background:#161616;color:#fff;white-space:nowrap}' +
      '.hlx-pwa-x{border:0;background:transparent;font-size:20px;line-height:1;color:#8a8f98;cursor:pointer;padding:4px 6px}' +
      '.hlx-pwa-ios{display:inline-block;vertical-align:-3px;margin:0 2px}' +
      '[data-theme="dark"] .hlx-pwa-bar{background:#1c2027;color:#f0ede6;border-color:rgba(224,198,143,.35);box-shadow:0 14px 40px rgba(0,0,0,.5)}' +
      '[data-theme="dark"] .hlx-pwa-text span{color:#a7adb8}[data-theme="dark"] .hlx-pwa-btn{background:#f0ede6;color:#000}';
    var s = document.createElement('style');
    s.id = 'hlx-pwa-style';
    s.textContent = css;
    document.head.appendChild(s);
  }

  function showBar(opts) {
    injectStyles();
    var old = document.getElementById(opts.id);
    if (old) old.remove();
    var bar = document.createElement('div');
    bar.className = 'hlx-pwa-bar';
    bar.id = opts.id;
    bar.setAttribute('role', 'dialog');
    bar.setAttribute('aria-live', 'polite');
    bar.innerHTML =
      '<img src="' + ROOT + 'assets/img/pwa/icon-192.png" alt="">' +
      '<div class="hlx-pwa-text"><b>' + opts.title + '</b><span>' + opts.text + '</span></div>' +
      (opts.action ? '<button type="button" class="hlx-pwa-btn">' + opts.action + '</button>' : '') +
      '<button type="button" class="hlx-pwa-x" aria-label="Dismiss">&times;</button>';
    document.body.appendChild(bar);
    requestAnimationFrame(function () { requestAnimationFrame(function () { bar.classList.add('is-open'); }); });
    var close = function () { bar.classList.remove('is-open'); setTimeout(function () { bar.remove(); }, 400); };
    bar.querySelector('.hlx-pwa-x').addEventListener('click', function () { close(); if (opts.onDismiss) opts.onDismiss(); });
    var btn = bar.querySelector('.hlx-pwa-btn');
    if (btn) btn.addEventListener('click', function () { opts.onAction(close); });
    return bar;
  }

  // Wait until no other popup (e.g. the home page flyer) is open, so we never
  // stack two overlays on a customer.
  function whenClear(fn, delay) {
    setTimeout(function check() {
      var busy = document.querySelector('.flyer-overlay.open, .modal-overlay.open, [aria-modal="true"].open, .modal.show');
      // On the home page, wait until the visitor scrolls past the hero so the
      // bar never covers the banner's "Get Free Resources" button.
      var onHero = /^\/(?:index\.html)?$/.test(path) && window.scrollY < window.innerHeight * 0.6;
      if (busy || onHero) return setTimeout(check, 1500);
      fn();
    }, delay);
  }

  function recentlyDismissed() {
    var at = Number(store.get(DISMISS_KEY) || 0);
    return at && (Date.now() - at) < DISMISS_DAYS * 864e5;
  }
  function rememberDismiss() { store.set(DISMISS_KEY, String(Date.now())); }

  // ── Install: Android / desktop Chromium ─────────────────────────────────
  var deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault(); // we show our own, better-timed banner
    deferredPrompt = e;
    if (isStandalone || !isInstallPage || recentlyDismissed()) return;
    whenClear(function () {
      if (!deferredPrompt) return;
      showBar({
        id: 'hlx-pwa-install',
        title: 'Get the Hairlux Academy app',
        text: 'Jump back into your courses, training and certificates in one tap.',
        action: 'Install',
        onAction: function (close) {
          close();
          deferredPrompt.prompt();
          deferredPrompt.userChoice.then(function (choice) {
            if (choice.outcome !== 'accepted') rememberDismiss();
            deferredPrompt = null;
          });
        },
        onDismiss: rememberDismiss,
      });
    }, /^\/app\//.test(path) ? 2500 : 8000);
  });
  window.addEventListener('appinstalled', function () {
    deferredPrompt = null;
    var bar = document.getElementById('hlx-pwa-install');
    if (bar) bar.remove();
  });

  // ── Install: iPhone / iPad (Safari has no install prompt) ───────────────
  if (isIOSSafari && !isStandalone && isInstallPage && !recentlyDismissed()) {
    whenClear(function () {
      var shareIcon = '<svg class="hlx-pwa-ios" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-label="Share"><path d="M12 3v12"/><path d="M8 7l4-4 4 4"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>';
      showBar({
        id: 'hlx-pwa-install',
        title: 'Add Hairlux Academy to your Home Screen',
        text: 'Tap ' + shareIcon + ' Share, then <b style="display:inline">Add to Home Screen</b>.',
        onDismiss: rememberDismiss,
      });
    }, /^\/app\//.test(path) ? 2500 : 8000);
  }

  // ── Service worker + "new version" prompt ───────────────────────────────
  function offerRefresh(reg) {
    if (!reg.waiting || !navigator.serviceWorker.controller) return; // first install: nothing to refresh
    showBar({
      id: 'hlx-pwa-update',
      title: 'A new version is available',
      text: 'Refresh to get the latest Hairlux Academy updates.',
      action: 'Refresh',
      onAction: function () { reg.waiting.postMessage({ type: 'SKIP_WAITING' }); },
    });
  }

  window.addEventListener('load', function () {
    navigator.serviceWorker.register(ROOT + 'sw.js', { scope: ROOT }).then(function (reg) {
      offerRefresh(reg);
      reg.addEventListener('updatefound', function () {
        var nw = reg.installing;
        if (!nw) return;
        nw.addEventListener('statechange', function () { if (nw.state === 'installed') offerRefresh(reg); });
      });
      // Check for a new deploy when the app comes back to the foreground.
      document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') reg.update().catch(function () {}); });
    }).catch(function (err) { console.warn('[Hairlux Academy PWA] service worker registration failed:', err); });

    // Reload only when an UPDATE takes over (the user clicked Refresh) -- not on
    // the very first install, where clients.claim() also fires controllerchange.
    var hadController = !!navigator.serviceWorker.controller;
    var reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (!hadController || reloading) return;
      reloading = true;
      location.reload();
    });
  });

  // Logging out: drop cached pages so the next person on a shared phone starts clean.
  document.addEventListener('click', function (e) {
    var el = e.target && e.target.closest && e.target.closest('[data-logout="true"], #logoutBtn, .logout-btn');
    if (el && navigator.serviceWorker.controller) navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_PAGE_CACHE' });
  }, true);

  window.HairluxAcademyPWA = {
    canInstall: function () { return !!deferredPrompt || (isIOSSafari && !isStandalone); },
    isInstalled: function () { return isStandalone; },
  };
})();
