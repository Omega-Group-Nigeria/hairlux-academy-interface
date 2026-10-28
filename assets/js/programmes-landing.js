/**
 * Hairlux Academy ad landing page (programmes.html).
 *
 * Ads point here first. The page shows in-branch trainings and online
 * courses with their fees, the upcoming class dates and the training
 * branches (from the same public config the enrolment page uses). Online
 * payment is not offered here (2026-10-28): every CTA, card and class row opens
 * a WhatsApp chat with +234 806 853 9497, pre-filled with the programme, class
 * or branch the visitor tapped, and a click sends a Meta Contact event. Meta
 * Pixel: the page loads the Academy pixel and sends PageView. The Pixel ID in
 * admin (Academy > Enrolments > Settings) is only used if that is missing.
 */
(function () {
  'use strict';

  var E = window.HLXEnrol;
  var $ = E.$, esc = E.esc, naira = E.naira;
  var FIRST_CLASSES = 6;
  var state = { config: null, kind: '', showAllClasses: false };

  var CAP_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10 12 5 2 10l10 5 10-5z" /><path d="M6 12v5c3 2 9 2 12 0v-5" /></svg>';
  var PLAY_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="14" rx="2" /><path d="m10 8 5 3-5 3z" /><path d="M8 21h8" /></svg>';

  // Enquiries go to WhatsApp, with a pre-filled message naming what the visitor tapped.
  var WA_NUMBER = '2348068539497';
  var WA_DEFAULT = 'Hello Hairlux Academy, I would like to enquire about your training programmes.';
  function waUrl(msg) { return 'https://wa.me/' + WA_NUMBER + '?text=' + encodeURIComponent(msg || WA_DEFAULT); }
  function waAttrs(msg) { return 'href="' + esc(waUrl(msg)) + '" target="_blank" rel="noopener"'; }
  function aboutMsg(what) { return 'Hello Hairlux Academy, I would like to enquire about ' + what + '.'; }

  function wireEnrolLinks() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-enrol]'), function (a) {
      a.href = waUrl(); a.target = '_blank'; a.rel = 'noopener';
    });
    // One Meta Contact event per click on any WhatsApp enquiry link.
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href^="https://wa.me/"]');
      if (a && typeof window.fbq === 'function') window.fbq('track', 'Contact');
    });
  }

  function openCohorts(t) { return t.cohorts.filter(function (c) { return !c.full; }); }

  function seatsBadge(c) {
    if (c.full) return '<span class="seats full">Full</span>';
    if (c.seatsLeft <= 5) return '<span class="seats low">' + c.seatsLeft + (c.seatsLeft === 1 ? ' seat left' : ' seats left') + '</span>';
    return '';
  }

  function trainingCard(t) {
    var open = openCohorts(t);
    var next = open[0];
    var nextLine = next
      ? 'Next class: ' + E.shortDate(next.startDate) + ', ' + esc(next.branch.name) + (open.length > 1 ? ' &middot; ' + (open.length - 1) + ' more date' + (open.length > 2 ? 's' : '') : '')
      : (t.cohorts.length ? 'All current classes are full' : 'New dates coming soon');
    var chips = [];
    if (t.duration) chips.push(esc(t.duration.label));
    if (t.kit) chips.push(t.kit.option === 'INCLUDED' ? 'Starter kit included' : 'Starter kit available');
    if (t.cohorts.some(function (c) { return c.accommodation && c.accommodation.available; })) chips.push('Accommodation available');
    var promo = E.promoNote(t);
    return '<a class="card" href="#programme=t-' + esc(t.id) + '" data-detail="t-' + esc(t.id) + '">' +
      (t.coverImageUrl ? '<img class="card-img" src="' + esc(t.coverImageUrl) + '" alt="" loading="lazy" />' : '<div class="card-img-blank">' + CAP_ICON + '</div>') +
      '<div class="card-body">' +
      '<div class="card-kind">In-branch training' + (t.category ? ' &middot; ' + esc(t.category) : '') + '</div>' +
      '<div class="card-name">' + esc(t.name) + '</div>' +
      (promo ? '<div class="card-promo">' + esc(promo) + '</div>' : '') +
      (t.description ? '<div class="card-desc">' + esc(E.plainText(t.description)) + '</div>' : '') +
      (chips.length ? '<div class="card-chips">' + chips.map(function (x) { return '<span>' + x + '</span>'; }).join('') + '</div>' : '') +
      '<div class="card-next">' + nextLine + '</div>' +
      '<div class="card-foot"><span class="card-price">' + E.priceHtml(t) + '</span>' +
      '<span class="card-cta">View details &rarr;</span></div>' +
      '</div></a>';
  }

  function courseCard(c) {
    var meta = [];
    if (c.lessons) meta.push(c.lessons + (c.lessons === 1 ? ' lesson' : ' lessons'));
    if (c.duration) meta.push(E.minutesLabel(c.duration) + ' of content');
    meta.push(c.accessType === 'LIFETIME' ? 'Lifetime access' : c.accessDurationDays ? c.accessDurationDays + ' days access' : 'Online access');
    return '<a class="card" href="#programme=c-' + esc(c.id) + '" data-detail="c-' + esc(c.id) + '">' +
      (c.coverImageUrl ? '<img class="card-img" src="' + esc(c.coverImageUrl) + '" alt="" loading="lazy" />' : '<div class="card-img-blank">' + PLAY_ICON + '</div>') +
      '<div class="card-body">' +
      '<div class="card-kind">Online course' + (c.category ? ' &middot; ' + esc(c.category) : '') + '</div>' +
      '<div class="card-name">' + esc(c.title) + '</div>' +
      (c.shortDescription ? '<div class="card-desc">' + esc(c.shortDescription) + '</div>' : '') +
      '<div class="card-next">Start today &middot; ' + meta.map(esc).join(' &middot; ') + '</div>' +
      '<div class="card-foot"><span class="card-price">' + (c.price > 0 ? naira(c.price) : 'Free') +
      (c.originalPrice ? '<s>' + naira(c.originalPrice) + '</s>' : '') + '</span>' +
      '<span class="card-cta">View details &rarr;</span></div>' +
      '</div></a>';
  }

  /* ---------- Programme details pop-up (2026-10-28) ---------- */

  var RICH_TAGS = { P: 'p', BR: 'br', UL: 'ul', OL: 'ol', LI: 'li', STRONG: 'strong', B: 'strong', EM: 'em', I: 'em', H2: 'h4', H3: 'h4', H4: 'h4' };

  /** Admin rich text (or plain text with line breaks) rebuilt with a short list of safe tags only. */
  function richHtml(v) {
    var src = String(v == null ? '' : v).trim();
    if (!src) return '';
    if (!/<[a-z][\s\S]*>/i.test(src)) {
      return src.split(/\n{2,}/).map(function (para) { return '<p>' + esc(para).replace(/\n/g, '<br>') + '</p>'; }).join('');
    }
    // DOMParser builds an inert document: nothing in it loads or runs.
    var doc = new DOMParser().parseFromString(src, 'text/html');
    function walk(node) {
      var out = '';
      Array.prototype.forEach.call(node.childNodes, function (n) {
        if (n.nodeType === 3) { out += esc(n.nodeValue); return; }
        if (n.nodeType !== 1 || /^(SCRIPT|STYLE|TEMPLATE|NOSCRIPT|IFRAME|OBJECT|SVG)$/i.test(n.tagName)) return;
        var tag = RICH_TAGS[n.tagName];
        if (tag === 'br') { out += '<br>'; return; }
        var inner = walk(n);
        out += tag ? '<' + tag + '>' + inner + '</' + tag + '>' : inner;
      });
      return out;
    }
    return walk(doc.body);
  }

  /** "Line one\nLine two" or "a; b" style fields as a tick list. */
  function listHtml(items) {
    var arr = (items || []).map(function (x) { return String(x || '').trim(); }).filter(Boolean);
    return arr.length ? '<ul class="en-benefits">' + arr.map(function (b) { return '<li>' + esc(b) + '</li>'; }).join('') + '</ul>' : '';
  }

  function section(title, body) { return body ? '<div class="pd-section"><h3>' + title + '</h3>' + body + '</div>' : ''; }

  function curriculumHtml(t) {
    var cur = t.curriculum || [];
    if (!cur.length) return '';
    var word = t.curriculumLayout === 'WEEKS' ? 'Week' : t.curriculumLayout === 'DAYS' ? 'Day' : '';
    function item(m) {
      return '<li><strong>' + esc(m.name) + '</strong>' + (m.practical ? ' <span class="pd-tag">Practical</span>' : '') +
        (m.description ? '<div class="pd-sub">' + esc(m.description) + '</div>' : '') + '</li>';
    }
    if (!word) return '<ol class="pd-modules">' + cur.map(item).join('') + '</ol>';
    var groups = [], byKey = {};
    cur.forEach(function (m) {
      var k = m.period ? String(m.period) : 'other';
      if (!byKey[k]) { byKey[k] = { period: m.period, items: [] }; groups.push(byKey[k]); }
      byKey[k].items.push(m);
    });
    groups.sort(function (a, b) { return (a.period || 9999) - (b.period || 9999); });
    return groups.map(function (g) {
      return '<div class="pd-group"><div class="pd-group-title">' + (g.period ? word + ' ' + g.period : 'Also covered') + '</div><ol class="pd-modules">' + g.items.map(item).join('') + '</ol></div>';
    }).join('');
  }

  function classesHtml(t) {
    if (!t.cohorts.length) return '<p class="pd-sub">New class dates are coming soon. Message us to be told first.</p>';
    return t.cohorts.map(function (c) {
      var meta = [esc(c.branch.name), E.dateRange(c.startDate, c.endDate)];
      if (c.sessions) meta.push(c.sessions + (c.sessions === 1 ? ' session' : ' sessions'));
      var sched = E.classSchedule(c);
      if (sched) meta.push(esc(sched));
      var extra = [];
      if (c.instructor) extra.push('Instructor: ' + esc(c.instructor));
      if (c.branch.address) extra.push(esc(c.branch.address));
      var acc = c.accommodation;
      if (acc) extra.push(acc.available ? 'Accommodation ' + (acc.free ? 'included' : naira(acc.fee)) : 'Accommodation fully booked');
      return '<div class="pd-class">' +
        '<div class="pd-class-info"><div class="pd-class-name">' + E.shortDate(c.startDate) + seatsBadge(c) + '</div>' +
        '<div class="pd-sub">' + meta.join(' &middot; ') + '</div>' +
        (extra.length ? '<div class="pd-sub">' + extra.join(' &middot; ') + '</div>' : '') + '</div>' +
        (c.full ? '<span class="btn btn-ghost btn-small" aria-disabled="true">Full</span>'
          : '<a class="btn btn-ghost btn-small" ' + waAttrs(aboutMsg('the ' + t.name + ' class starting ' + E.shortDate(c.startDate) + ' at ' + c.branch.name)) + '>Enquire</a>') +
        '</div>';
    }).join('');
  }

  function trainingDetail(t) {
    var facts = [];
    if (t.duration) facts.push(esc(t.duration.label));
    if (t.certificationEnabled) facts.push('Hairlux certificate');
    if (t.kit) facts.push(t.kit.option === 'INCLUDED' ? 'Starter kit included' : 'Starter kit available');
    if (t.cohorts.some(function (c) { return c.accommodation && c.accommodation.available; })) facts.push('Accommodation available');
    var promo = E.promoNote(t);
    return {
      kind: 'In-branch training' + (t.category ? ' &middot; ' + esc(t.category) : ''),
      name: t.name,
      image: t.coverImageUrl,
      icon: CAP_ICON,
      price: E.priceHtml(t),
      promo: promo,
      facts: facts,
      msg: aboutMsg('the ' + t.name + ' in-branch training'),
      body:
        section('About this training', richHtml(t.description)) +
        section('What is included', listHtml(t.benefits)) +
        (t.kit ? section('Starter kit', '<p>' + (t.kit.option === 'INCLUDED' ? 'Included in the fee. ' : 'Optional, not in the fee. ') + esc(t.kit.description || '') + '</p>') : '') +
        section('What you will learn', curriculumHtml(t)) +
        section('Requirements', richHtml(t.requirements)) +
        section('Class dates', classesHtml(t)),
    };
  }

  function courseDetail(c) {
    var facts = [];
    if (c.level && c.level !== 'ALL') facts.push(esc(c.level.charAt(0) + c.level.slice(1).toLowerCase()));
    if (c.lessons) facts.push(c.lessons + (c.lessons === 1 ? ' lesson' : ' lessons'));
    if (c.duration) facts.push(esc(E.minutesLabel(c.duration)) + ' of content');
    facts.push(c.accessType === 'LIFETIME' ? 'Lifetime access' : c.accessDurationDays ? c.accessDurationDays + ' days access' : 'Online access');
    if (c.certificateEnabled) facts.push('Hairlux certificate');
    var mods = (c.modules || []).map(function (m) {
      return '<li><strong>' + esc(m.name) + '</strong>' + (m.lessons ? ' <span class="pd-tag">' + m.lessons + (m.lessons === 1 ? ' lesson' : ' lessons') + '</span>' : '') +
        (m.description ? '<div class="pd-sub">' + esc(m.description) + '</div>' : '') + '</li>';
    }).join('');
    return {
      kind: 'Online course' + (c.category ? ' &middot; ' + esc(c.category) : ''),
      name: c.title,
      image: c.coverImageUrl,
      icon: PLAY_ICON,
      price: (c.price > 0 ? naira(c.price) : 'Free') + (c.originalPrice ? '<s>' + naira(c.originalPrice) + '</s>' : ''),
      promo: null,
      facts: facts,
      msg: aboutMsg('the ' + c.title + ' online course'),
      body:
        section('About this course', richHtml(c.description) || (c.shortDescription ? '<p>' + esc(c.shortDescription) + '</p>' : '')) +
        section('What you will learn', richHtml(c.learningObjectives)) +
        section('Course content', mods ? '<ol class="pd-modules">' + mods + '</ol>' : '') +
        section('Requirements', richHtml(c.requirements)) +
        section('How it works', '<p>Learn online at your own pace from your Hairlux Academy account, on your phone or computer.</p>'),
    };
  }

  function findDetail(key) {
    var c = state.config;
    if (!c || !key) return null;
    var id = key.slice(2);
    if (key.indexOf('t-') === 0) { var t = c.trainings.filter(function (x) { return x.id === id; })[0]; return t ? trainingDetail(t) : null; }
    if (key.indexOf('c-') === 0) { var k = c.courses.filter(function (x) { return x.id === id; })[0]; return k ? courseDetail(k) : null; }
    return null;
  }

  var dlg = null;
  function detailDialog() {
    if (dlg) return dlg;
    dlg = document.createElement('dialog');
    dlg.className = 'pd';
    dlg.setAttribute('aria-labelledby', 'pdTitle');
    dlg.addEventListener('click', function (e) { if (e.target === dlg || e.target.closest('[data-pd-close]')) closeDetail(); });
    dlg.addEventListener('close', function () {
      document.documentElement.classList.remove('pd-open');
      if (/^#programme=/.test(location.hash)) history.replaceState(null, '', location.pathname + location.search);
    });
    document.body.appendChild(dlg);
    return dlg;
  }

  function openDetail(key) {
    var d = findDetail(key);
    if (!d) return false;
    var box = detailDialog();
    box.innerHTML =
      '<div class="pd-panel">' +
      '<button type="button" class="pd-close" data-pd-close aria-label="Close">&times;</button>' +
      '<div class="pd-scroll">' +
      (d.image ? '<img class="pd-img" src="' + esc(d.image) + '" alt="" />' : '<div class="pd-img pd-img-blank">' + d.icon + '</div>') +
      '<div class="pd-body">' +
      '<div class="card-kind">' + d.kind + '</div>' +
      '<h2 class="serif" id="pdTitle">' + esc(d.name) + '</h2>' +
      '<div class="pd-price">' + d.price + '</div>' +
      (d.promo ? '<div class="card-promo">' + esc(d.promo) + '</div>' : '') +
      (d.facts.length ? '<div class="en-details-facts">' + d.facts.map(function (f) { return '<span>' + f + '</span>'; }).join('') + '</div>' : '') +
      d.body +
      '</div></div>' +
      '<div class="pd-foot">' +
      '<a class="btn btn-primary btn-block" ' + waAttrs(d.msg) + '>Enquire on WhatsApp</a>' +
      '</div></div>';
    if (location.hash !== '#programme=' + key) history.replaceState(null, '', '#programme=' + key);
    document.documentElement.classList.add('pd-open');
    if (!box.open) box.showModal();
    box.querySelector('.pd-scroll').scrollTop = 0;
    if (typeof window.fbq === 'function') window.fbq('track', 'ViewContent', { content_name: d.name, content_category: key.charAt(0) === 't' ? 'Training' : 'Online course' });
    return true;
  }

  function closeDetail() { if (dlg && dlg.open) dlg.close(); }

  function renderProgrammes() {
    var c = state.config;
    var html = [];
    if (state.kind !== 'COURSE') html = html.concat(c.trainings.map(trainingCard));
    if (state.kind !== 'TRAINING') html = html.concat(c.courses.map(courseCard));
    $('programmes-list').innerHTML = html.length ? html.join('') :
      '<div class="empty" style="grid-column:1/-1">No programmes here right now. Please check back soon.</div>';
  }

  function renderClasses() {
    var rows = [];
    state.config.trainings.forEach(function (t) {
      t.cohorts.forEach(function (c) { rows.push({ t: t, c: c }); });
    });
    rows.sort(function (a, b) { return new Date(a.c.startDate) - new Date(b.c.startDate); });
    if (!rows.length) return;
    $('classes').classList.remove('hidden');
    var shown = state.showAllClasses ? rows : rows.slice(0, FIRST_CLASSES);
    $('classes-list').innerHTML = shown.map(function (r) {
      var p = E.dateParts(r.c.startDate);
      var meta = [esc(r.c.branch.name), E.dateRange(r.c.startDate, r.c.endDate)];
      if (r.c.sessions) meta.push(r.c.sessions + (r.c.sessions === 1 ? ' session' : ' sessions'));
      var sched = E.classSchedule(r.c);
      if (sched) meta.push(esc(sched));
      var extra = [];
      if (r.c.instructor) extra.push('Instructor: ' + esc(r.c.instructor));
      var acc = r.c.accommodation;
      if (acc) extra.push(acc.available ? 'Accommodation ' + (acc.free ? 'included' : naira(acc.fee)) + ' (' + acc.bedsLeft + (acc.bedsLeft === 1 ? ' bed' : ' beds') + ' left)' : 'Accommodation fully booked');
      return '<div class="class-row">' +
        '<div class="class-date"><small>' + esc(p.month) + '</small><strong>' + esc(p.day) + '</strong><small>' + esc(p.weekday) + '</small></div>' +
        '<div class="class-info"><div class="class-name">' + esc(r.t.name) + seatsBadge(r.c) + '</div>' +
        '<div class="class-meta">' + meta.join(' &middot; ') + '</div>' +
        (extra.length ? '<div class="class-meta">' + extra.join(' &middot; ') + '</div>' : '') +
        '<div class="class-meta">' + (r.t.promo ? naira(r.t.price) + ' <s>' + naira(r.t.regularPrice) + '</s>' : naira(r.t.price)) + '</div></div>' +
        (r.c.full
          ? '<span class="btn btn-ghost btn-small" aria-disabled="true">Full</span>'
          : '<a class="btn btn-primary btn-small" ' + waAttrs(aboutMsg('the ' + r.t.name + ' class starting ' + E.shortDate(r.c.startDate) + ' at ' + r.c.branch.name)) + '>Enquire</a>') +
        '</div>';
    }).join('');
    var more = rows.length > shown.length;
    $('moreClassesWrap').classList.toggle('hidden', !more);
    if (more) $('moreClassesBtn').textContent = 'Show all ' + rows.length + ' class dates';
  }

  function renderBranches() {
    var c = state.config;
    if (!c.branches.length) return;
    $('branches').classList.remove('hidden');
    $('branches-list').innerHTML = c.branches.map(function (b) {
      var n = 0;
      c.trainings.forEach(function (t) { t.cohorts.forEach(function (x) { if (x.branch.id === b.id && !x.full) n += 1; }); });
      var maps = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent('Hairlux ' + b.name + ', ' + b.address);
      return '<div class="branch">' +
        '<h3>' + esc(b.name) + '</h3>' +
        '<div class="addr">' + esc(b.address) + '</div>' +
        '<div class="count">' + (n ? n + (n === 1 ? ' class' : ' classes') + ' open' : 'Classes full right now') + '</div>' +
        '<div class="branch-actions">' +
        (n ? '<a class="btn btn-primary btn-small" ' + waAttrs(aboutMsg('training classes at the ' + b.name + ' branch')) + '>Ask about classes here</a>' : '') +
        '<a class="btn btn-ghost btn-small" href="' + maps + '" target="_blank" rel="noopener">Directions</a>' +
        '</div></div>';
    }).join('');
  }

  function showUnavailable() {
    $('programmes-list').innerHTML = '<div class="empty" style="grid-column:1/-1">New programmes are coming soon. <a ' + waAttrs() + '>Message us on WhatsApp</a> to hear first.</div>';
  }

  function stickyCta() {
    var bar = $('mobileCta');
    var hero = document.querySelector('.hero');
    var onScroll = function () { bar.classList.toggle('show', window.scrollY > (hero ? hero.offsetHeight * 0.6 : 300)); };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  async function init() {
    $('year').textContent = new Date().getFullYear();
    E.captureAttribution();
    wireEnrolLinks();
    stickyCta();
    $('moreClassesBtn').addEventListener('click', function () { state.showAllClasses = true; renderClasses(); });
    $('programmes-list').addEventListener('click', function (e) {
      var a = e.target.closest('[data-detail]');
      if (!a || !state.config) return;
      e.preventDefault();
      openDetail(a.getAttribute('data-detail'));
    });
    $('filters').addEventListener('click', function (e) {
      var b = e.target.closest('[data-kind]');
      if (!b || !state.config) return;
      state.kind = b.getAttribute('data-kind');
      Array.prototype.forEach.call($('filters').querySelectorAll('[data-kind]'), function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      renderProgrammes();
    });

    try {
      state.config = await E.api('/public/academy/enrolment/config');
    } catch (e) {
      $('programmes-list').innerHTML = '<div class="empty" style="grid-column:1/-1">We could not load programmes. You can still <a ' + waAttrs() + '>message us on WhatsApp</a>.</div>';
      return;
    }

    E.initPixel(state.config.metaPixelId, true);
    if (!state.config.enabled) { showUnavailable(); return; }
    if (!state.config.courses.length) $('filters').classList.add('hidden');
    renderProgrammes();
    renderClasses();
    renderBranches();
    // A shared link such as programmes.html#programme=t-<id> opens that programme straight away.
    var m = /^#programme=([tc]-[\w-]+)$/.exec(location.hash);
    if (m) openDetail(m[1]);
  }

  init();
})();
