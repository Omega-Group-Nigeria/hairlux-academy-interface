/**
 * Hairlux Academy ad landing page (programmes.html).
 *
 * Ads point here first. The page shows in-branch trainings and online
 * courses with their fees, the upcoming class dates and the training
 * branches (from the same public config the enrolment page uses), and every
 * "Enrol" button goes to enrol-now.html with the ad tags of this visit. Meta
 * Pixel PageView fires here when a Pixel ID is set in admin
 * (Academy > Enrolments > Settings).
 */
(function () {
  'use strict';

  var E = window.HLXEnrol;
  var $ = E.$, esc = E.esc, naira = E.naira;
  var FIRST_CLASSES = 6;
  var state = { config: null, kind: '', showAllClasses: false };

  var CAP_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10 12 5 2 10l10 5 10-5z" /><path d="M6 12v5c3 2 9 2 12 0v-5" /></svg>';
  var PLAY_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="14" rx="2" /><path d="m10 8 5 3-5 3z" /><path d="M8 21h8" /></svg>';

  function enrolUrl(extra) { return E.withTags('enrol-now.html', extra); }

  function wireEnrolLinks() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-enrol]'), function (a) { a.href = enrolUrl(); });
  }

  function openCohorts(t) { return t.cohorts.filter(function (c) { return !c.full; }); }

  function seatsBadge(c) {
    if (c.full) return '<span class="seats full">Full</span>';
    if (c.seatsLeft <= 5) return '<span class="seats low">' + c.seatsLeft + (c.seatsLeft === 1 ? ' seat left' : ' seats left') + '</span>';
    return '';
  }

  function renderDepositCopy() {
    var c = state.config;
    if (!c.depositEnabled) {
      $('chipDeposit').textContent = 'Pay online in minutes';
      $('stepDeposit').textContent = 'Pay the fee by card, bank transfer or USSD through Paystack. You see the exact amount before you pay.';
      $('faqDeposit').textContent = 'In-branch training is paid in full when you enrol. You see the exact amount before you pay.';
      return;
    }
    var parts = [];
    if (c.depositPercent > 0) parts.push(c.depositPercent + '% of the fee');
    if (c.minDepositAmount > 0) parts.push((c.depositPercent > 0 ? 'at least ' : '') + naira(c.minDepositAmount));
    $('chipDeposit').textContent = 'Secure your seat with a ' + (c.depositPercent > 0 ? c.depositPercent + '% ' : '') + 'deposit';
    $('faqDeposit').textContent = 'For in-branch training you can usually pay ' + (parts.join(', ') || 'part of the fee') +
      ' to secure your seat, when the class starts at least ' + c.depositCutoffDays + ' days away. The balance is paid before your class starts. Some classes have their own deposit and deadline, shown before you pay. Online courses are paid in full.';
  }

  function trainingCard(t) {
    var open = openCohorts(t);
    var next = open[0];
    var href = enrolUrl({ training: t.id });
    var nextLine = next
      ? 'Next class: ' + E.shortDate(next.startDate) + ', ' + esc(next.branch.name) + (open.length > 1 ? ' &middot; ' + (open.length - 1) + ' more date' + (open.length > 2 ? 's' : '') : '')
      : (t.cohorts.length ? 'All current classes are full' : 'New dates coming soon');
    var chips = [];
    if (t.duration) chips.push(esc(t.duration.label));
    if (t.kit) chips.push(t.kit.option === 'INCLUDED' ? 'Starter kit included' : 'Starter kit available');
    if (t.cohorts.some(function (c) { return c.accommodation && c.accommodation.available; })) chips.push('Accommodation available');
    var promo = E.promoNote(t);
    return '<a class="card" href="' + esc(href) + '">' +
      (t.coverImageUrl ? '<img class="card-img" src="' + esc(t.coverImageUrl) + '" alt="" loading="lazy" />' : '<div class="card-img-blank">' + CAP_ICON + '</div>') +
      '<div class="card-body">' +
      '<div class="card-kind">In-branch training' + (t.category ? ' &middot; ' + esc(t.category) : '') + '</div>' +
      '<div class="card-name">' + esc(t.name) + '</div>' +
      (promo ? '<div class="card-promo">' + esc(promo) + '</div>' : '') +
      (t.description ? '<div class="card-desc">' + esc(E.plainText(t.description)) + '</div>' : '') +
      (chips.length ? '<div class="card-chips">' + chips.map(function (x) { return '<span>' + x + '</span>'; }).join('') + '</div>' : '') +
      '<div class="card-next">' + nextLine + '</div>' +
      '<div class="card-foot"><span class="card-price">' + E.priceHtml(t) + '</span>' +
      '<span class="card-cta">' + (next ? 'Enrol &rarr;' : 'See details &rarr;') + '</span></div>' +
      '</div></a>';
  }

  function courseCard(c) {
    var meta = [];
    if (c.lessons) meta.push(c.lessons + (c.lessons === 1 ? ' lesson' : ' lessons'));
    if (c.duration) meta.push(E.minutesLabel(c.duration) + ' of content');
    meta.push(c.accessType === 'LIFETIME' ? 'Lifetime access' : c.accessDurationDays ? c.accessDurationDays + ' days access' : 'Online access');
    return '<a class="card" href="' + esc(enrolUrl({ course: c.id })) + '">' +
      (c.coverImageUrl ? '<img class="card-img" src="' + esc(c.coverImageUrl) + '" alt="" loading="lazy" />' : '<div class="card-img-blank">' + PLAY_ICON + '</div>') +
      '<div class="card-body">' +
      '<div class="card-kind">Online course' + (c.category ? ' &middot; ' + esc(c.category) : '') + '</div>' +
      '<div class="card-name">' + esc(c.title) + '</div>' +
      (c.shortDescription ? '<div class="card-desc">' + esc(c.shortDescription) + '</div>' : '') +
      '<div class="card-next">Start today &middot; ' + meta.map(esc).join(' &middot; ') + '</div>' +
      '<div class="card-foot"><span class="card-price">' + (c.price > 0 ? naira(c.price) : 'Free') +
      (c.originalPrice ? '<s>' + naira(c.originalPrice) + '</s>' : '') + '</span>' +
      '<span class="card-cta">Enrol &rarr;</span></div>' +
      '</div></a>';
  }

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
        '<div class="class-meta">' + (r.t.promo ? naira(r.t.price) + ' <s>' + naira(r.t.regularPrice) + '</s>' : naira(r.t.price)) + (r.c.depositAllowed ? ' &middot; secure your seat with ' + naira(r.c.deposit) : '') + '</div></div>' +
        (r.c.full
          ? '<span class="btn btn-ghost btn-small" aria-disabled="true">Full</span>'
          : '<a class="btn btn-primary btn-small" href="' + esc(enrolUrl({ cohort: r.c.id })) + '">Enrol</a>') +
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
        '<div class="count">' + (n ? n + (n === 1 ? ' class' : ' classes') + ' open for enrolment' : 'Classes full right now') + '</div>' +
        '<div class="branch-actions">' +
        (n ? '<a class="btn btn-primary btn-small" href="' + esc(enrolUrl({ branch: b.id })) + '">See classes here</a>' : '') +
        '<a class="btn btn-ghost btn-small" href="' + maps + '" target="_blank" rel="noopener">Directions</a>' +
        '</div></div>';
    }).join('');
  }

  function showUnavailable() {
    $('programmes-list').innerHTML = '<div class="empty" style="grid-column:1/-1">Online enrolment is paused right now. Please contact Hairlux Academy.</div>';
    Array.prototype.forEach.call(document.querySelectorAll('[data-enrol]'), function (a) {
      a.href = E.MAIN_SITE + '/contact.html';
      a.textContent = 'Contact us';
    });
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
      $('programmes-list').innerHTML = '<div class="empty" style="grid-column:1/-1">We could not load programmes. You can still <a href="' + esc(enrolUrl()) + '">enrol here</a>.</div>';
      return;
    }

    E.initPixel(state.config.metaPixelId, true);
    if (!state.config.enabled) { showUnavailable(); return; }
    if (!state.config.courses.length) $('filters').classList.add('hidden');
    renderDepositCopy();
    renderProgrammes();
    renderClasses();
    renderBranches();
  }

  init();
})();
