/**
 * Hairlux Academy enrolment pages: shared helpers (window.HLXEnrol).
 * Used by programmes.html, enrol-now.html, enrolment-confirmed.html and
 * pay-balance.html.
 *
 * Attribution: utm_* tags and the ad click id (fbclid / gclid / ttclid) are
 * kept in sessionStorage from the first page of the visit and sent with the
 * checkout, so the enrolment is reported with its source (e.g. "Facebook Ad").
 * The Facebook click id is also kept in Meta's _fbc cookie, so a Purchase
 * sent after the trip out to Paystack and back is still credited to the ad.
 */
(function () {
  'use strict';

  // config.js declares API_CONFIG with const, so it is not on window.
  var API = (typeof API_CONFIG !== 'undefined' && API_CONFIG.BASE_URL) || '';
  var ATTR_KEY = 'hlx_academy_attribution';
  var TRACKED = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid', 'gclid', 'ttclid'];
  var MAIN_SITE = 'https://hairlux.com.ng';

  function $(id) { return document.getElementById(id); }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function naira(v) {
    var n = Number(v) || 0;
    return '₦' + n.toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }

  /** Cohort dates are timestamps: shown in Lagos time. */
  function dateLabel(v, opts) {
    if (!v) return '';
    return new Date(v).toLocaleDateString('en-NG', Object.assign({ weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Lagos' }, opts || {}));
  }

  function shortDate(v) { return dateLabel(v, { weekday: undefined, year: undefined }); }

  function dateParts(v) {
    var d = new Date(v);
    return {
      day: d.toLocaleDateString('en-NG', { day: 'numeric', timeZone: 'Africa/Lagos' }),
      month: d.toLocaleDateString('en-NG', { month: 'short', timeZone: 'Africa/Lagos' }),
      weekday: d.toLocaleDateString('en-NG', { weekday: 'short', timeZone: 'Africa/Lagos' }),
    };
  }

  /** Same as My Training: session times shown in Lagos time. A cohort's daily
   * hours come as "HH:MM" (already Lagos time) and are shown as e.g. "9:00 am". */
  function timeLabel(v) {
    if (!v) return '';
    var hm = /^(\d{1,2}):(\d{2})$/.exec(String(v));
    if (hm) {
      var h = Number(hm[1]);
      return ((h % 12) || 12) + ':' + hm[2] + (h >= 12 ? ' pm' : ' am');
    }
    return new Date(v).toLocaleTimeString('en-NG', { hour: 'numeric', minute: '2-digit', timeZone: 'Africa/Lagos' });
  }

  /** "Mon, Wed, Fri, 9:00 am to 3:00 pm" for a class (days and hours set on the cohort, else the first session time). */
  function classSchedule(c) {
    if (!c) return '';
    var parts = [];
    if (c.schedule && c.schedule.daysLabel) parts.push(c.schedule.daysLabel);
    if (c.time && c.time.start) parts.push(timeLabel(c.time.start) + (c.time.end ? ' to ' + timeLabel(c.time.end) : ''));
    return parts.join(', ');
  }

  /** Text of a rich-text (HTML) field such as a training description, for short previews. */
  function plainText(html) {
    // DOMParser builds an inert document: nothing in it loads or runs.
    var doc = new DOMParser().parseFromString(String(html == null ? '' : html), 'text/html');
    return ((doc.body && doc.body.textContent) || '').replace(/\s+/g, ' ').trim();
  }

  /** Price HTML: the price now, with the normal price struck through while a promotion runs. */
  function priceHtml(t) {
    if (!t) return '';
    if (t.promo && t.regularPrice > t.price) return naira(t.price) + '<s>' + naira(t.regularPrice) + '</s>';
    return t.price > 0 ? naira(t.price) : 'Free';
  }

  /** "Promo price until Sat 31 Oct" (null when no promotion runs). */
  function promoNote(t) {
    if (!t || !t.promo) return null;
    var save = t.regularPrice - t.price;
    return 'Promo: save ' + naira(save) + (t.promo.endsAt ? ' until ' + dateLabel(t.promo.endsAt, { year: undefined }) : '');
  }

  function dateRange(start, end) {
    if (!start) return '';
    if (!end || shortDate(start) === shortDate(end)) return dateLabel(start);
    return dateLabel(start, { year: undefined }) + ' to ' + dateLabel(end);
  }

  function minutesLabel(mins) {
    var m = Number(mins) || 0;
    if (!m) return '';
    if (m < 60) return m + ' min';
    var h = Math.floor(m / 60), r = m % 60;
    return h + (h === 1 ? ' hr' : ' hrs') + (r ? ' ' + r + ' min' : '');
  }

  async function api(path, opts) {
    var res = await fetch(API + path, Object.assign({ headers: { 'Content-Type': 'application/json' } }, opts || {}));
    var body = null;
    try { body = await res.json(); } catch (e) { body = null; }
    if (!res.ok) {
      var msg = body && body.message;
      if (Array.isArray(msg)) msg = msg[0];
      var err = new Error(msg || 'Something went wrong. Please try again.');
      err.status = res.status;
      throw err;
    }
    return body && body.data !== undefined ? body.data : body;
  }

  function store(storage, key, value) {
    try { storage.setItem(key, JSON.stringify(value)); } catch (e) { /* private mode */ }
  }

  function load(storage, key) {
    try { var v = storage.getItem(key); return v ? JSON.parse(v) : null; } catch (e) { return null; }
  }

  function local() {
    try { return window.localStorage; } catch (e) { return window.sessionStorage; }
  }

  // ─── Attribution ──────────────────────────────────────────────────────

  function captureAttribution() {
    var q = new URLSearchParams(location.search);
    var saved = load(sessionStorage, ATTR_KEY) || {};
    var fresh = {};
    var UTM = { utm_source: 'utmSource', utm_medium: 'utmMedium', utm_campaign: 'utmCampaign', utm_content: 'utmContent', utm_term: 'utmTerm' };
    Object.keys(UTM).forEach(function (k) {
      var v = q.get(k);
      if (v) fresh[UTM[k]] = v.slice(0, 255);
    });
    ['fbclid', 'gclid', 'ttclid'].some(function (k) {
      var v = q.get(k);
      if (v) { fresh.clickId = v.slice(0, 255); fresh.clickIdType = k; return true; }
      return false;
    });
    // The landing page passes the same tags on to the enrolment page: that is
    // the same visit, so keep where it first landed. A different ad click
    // replaces the old attribution; a plain reload keeps it.
    var sameVisit = ['utmSource', 'utmMedium', 'utmCampaign', 'utmContent', 'utmTerm', 'clickId'].every(function (k) {
      return (fresh[k] || '') === (saved[k] || '');
    });
    var isNewTouch = Object.keys(fresh).length > 0 && !sameVisit;
    var attr = isNewTouch ? fresh : saved;
    if (isNewTouch || !saved.landingUrl) {
      attr.landingUrl = location.href.split('#')[0].slice(0, 255);
      attr.referrer = (document.referrer || '').slice(0, 255) || undefined;
    }
    store(sessionStorage, ATTR_KEY, attr);
    keepFacebookClickId(attr);
    return attr;
  }

  function attribution() {
    var a = load(sessionStorage, ATTR_KEY) || {};
    var out = {};
    ['utmSource', 'utmMedium', 'utmCampaign', 'utmContent', 'utmTerm', 'clickId', 'clickIdType', 'landingUrl', 'referrer'].forEach(function (k) {
      if (a[k]) out[k] = a[k];
    });
    return out;
  }

  /** A page link that carries this visit's ad tags, plus extra query values. */
  function withTags(page, extra) {
    var here = new URLSearchParams(location.search);
    var q = new URLSearchParams();
    TRACKED.forEach(function (k) { if (here.get(k)) q.set(k, here.get(k)); });
    Object.keys(extra || {}).forEach(function (k) { if (extra[k]) q.set(k, extra[k]); });
    var s = q.toString();
    return page + (s ? '?' + s : '');
  }

  // ─── Meta Pixel ───────────────────────────────────────────────────────

  function keepFacebookClickId(attr) {
    if (!attr || attr.clickIdType !== 'fbclid' || !attr.clickId) return;
    try {
      if (/(?:^|;\s*)_fbc=/.test(document.cookie)) return;
      document.cookie = '_fbc=fb.1.' + Date.now() + '.' + encodeURIComponent(attr.clickId) +
        '; path=/; max-age=7776000; SameSite=Lax' + (location.protocol === 'https:' ? '; Secure' : '');
    } catch (e) { /* cookies blocked: attribution falls back to Meta's own matching */ }
  }

  /**
   * Fallback only. programmes.html, enrol-now.html and enrolment-confirmed.html
   * load the Academy pixel themselves (Meta Pixel Code in the page), so when it
   * is already there this does nothing and no PageView is sent twice. Without
   * the page snippet, the Pixel ID from admin settings is loaded instead.
   * pageView: send PageView too (landing and enrolment pages).
   */
  function initPixel(id, pageView) {
    if (!id || window.fbq) return;
    /* eslint-disable */
    !function (f, b, e, v, n, t, s) {
      if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments) };
      if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = []; t = b.createElement(e); t.async = !0;
      t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s)
    }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    /* eslint-enable */
    window.fbq('init', id);
    if (pageView) window.fbq('track', 'PageView');
  }

  /** The signed-in learner's email, when there is one (to prefill forms). */
  function signedInEmail() {
    try {
      var key = (typeof API_CONFIG !== 'undefined' && API_CONFIG.STORAGE_KEYS && API_CONFIG.STORAGE_KEYS.USER_DATA) || 'hairlux_user_data';
      var u = JSON.parse(localStorage.getItem(key) || 'null');
      return u && u.email ? String(u.email) : '';
    } catch (e) { return ''; }
  }

  window.HLXEnrol = {
    $: $,
    esc: esc,
    naira: naira,
    dateLabel: dateLabel,
    shortDate: shortDate,
    dateParts: dateParts,
    timeLabel: timeLabel,
    classSchedule: classSchedule,
    priceHtml: priceHtml,
    plainText: plainText,
    promoNote: promoNote,
    dateRange: dateRange,
    minutesLabel: minutesLabel,
    api: api,
    store: store,
    load: load,
    local: local,
    captureAttribution: captureAttribution,
    attribution: attribution,
    withTags: withTags,
    initPixel: initPixel,
    signedInEmail: signedInEmail,
    MAIN_SITE: MAIN_SITE,
  };
})();
