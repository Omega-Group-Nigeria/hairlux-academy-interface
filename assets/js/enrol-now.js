/**
 * Hairlux Academy enrolment page (enrol-now.html).
 *
 * A visitor (often from an ad, via programmes.html) picks an in-branch
 * training and a class date, or an online course, enters name, phone and
 * email, and pays through Paystack: the full fee, or for in-branch training
 * a deposit that holds the seat (the balance is due before the class
 * starts). Paystack then sends them to enrolment-confirmed.html?ref=HLAEN-...,
 * which confirms the payment and shows the registration code.
 *
 * Links can preselect: ?training=<id>, ?cohort=<id>, ?course=<id>,
 * ?branch=<id>, ?type=course. Meta Pixel: loaded quietly (no PageView);
 * Purchase is sent from the thank-you page once the enrolment is confirmed.
 */
(function () {
  'use strict';

  var E = window.HLXEnrol;
  var $ = E.$, esc = E.esc, naira = E.naira;
  var FORM_KEY = 'hlx_academy_enrol_form';
  var REF_KEY = 'hlx_academy_enrol_ref';
  var PHONE_RE = /^(?:\+?234|0)?[789]\d{9}$/;

  var state = {
    config: null,
    kind: 'TRAINING',
    trainingId: null,
    cohortId: null,
    courseId: null,
    branchId: '',
    plan: 'FULL',
    planTouched: false,
    discount: null, // { code, discountAmount, total, deposit, depositAllowed }
    busy: false,
  };

  // ─── Lookups ──────────────────────────────────────────────────────────

  function training() { return state.config.trainings.filter(function (t) { return t.id === state.trainingId; })[0] || null; }
  function cohort() {
    var t = training();
    return t ? t.cohorts.filter(function (c) { return c.id === state.cohortId; })[0] || null : null;
  }
  function course() { return state.config.courses.filter(function (c) { return c.id === state.courseId; })[0] || null; }

  function trainingForCohort(cohortId) {
    var hit = null;
    state.config.trainings.some(function (t) {
      return t.cohorts.some(function (c) { if (c.id === cohortId) { hit = t; return true; } return false; });
    });
    return hit;
  }

  function hasOpenClass(t) { return t.cohorts.some(function (c) { return !c.full; }); }

  /** Same rule as the server: % of the fee, at least the minimum, never more than the fee. */
  function depositFor(total) {
    var c = state.config;
    if (!(total > 0)) return 0;
    var byPercent = Math.ceil(total * Math.max(0, c.depositPercent) / 100);
    return Math.min(total, Math.max(byPercent, Math.max(0, Math.round(c.minDepositAmount))));
  }

  /** Price, discount, total and what is paid now, for the current choice. */
  function amounts() {
    var t = state.kind === 'TRAINING' ? training() : null;
    var co = state.kind === 'COURSE' ? course() : null;
    var c = cohort();
    var listPrice = t ? t.price : co ? co.price : 0;
    var discount = state.discount ? state.discount.discountAmount : 0;
    var total = state.discount ? state.discount.total : listPrice;
    var depositAllowed = !!(t && c && c.depositAllowed);
    var deposit = 0;
    if (depositAllowed) {
      deposit = state.discount ? state.discount.deposit : depositFor(total);
      if (!(deposit > 0) || deposit >= total) { depositAllowed = false; deposit = 0; }
    }
    var plan = depositAllowed && state.plan === 'DEPOSIT' ? 'DEPOSIT' : 'FULL';
    var payNow = plan === 'DEPOSIT' ? deposit : total;
    return { listPrice: listPrice, discount: discount, total: total, depositAllowed: depositAllowed, deposit: deposit, plan: plan, payNow: payNow, balance: total - payNow };
  }

  function ready() {
    if (state.kind === 'TRAINING') return !!(training() && cohort() && !cohort().full);
    return !!course();
  }

  // ─── Render ───────────────────────────────────────────────────────────

  function renderKinds() {
    var c = state.config;
    var both = c.trainings.length && c.courses.length;
    $('enKinds').classList.toggle('hidden', !both);
    Array.prototype.forEach.call($('enKinds').querySelectorAll('[data-kind]'), function (b) {
      b.setAttribute('aria-checked', String(b.getAttribute('data-kind') === state.kind));
    });
  }

  function renderProgrammes() {
    var box = $('enProgrammes');
    if (state.kind === 'TRAINING') {
      var list = state.config.trainings;
      box.innerHTML = list.length ? list.map(function (t) {
        var open = t.cohorts.filter(function (c) { return !c.full; });
        var meta = open.length
          ? open.length + (open.length === 1 ? ' class date' : ' class dates') + ' &middot; from ' + E.shortDate(open[0].startDate)
          : (t.cohorts.length ? 'All classes full' : 'New dates coming soon');
        return '<button type="button" class="en-option" role="radio" data-training="' + esc(t.id) + '" aria-checked="' + (t.id === state.trainingId) + '"' + (open.length ? '' : ' disabled') + '>' +
          '<span class="en-radio"></span>' +
          (t.coverImageUrl ? '<img class="en-option-img" src="' + esc(t.coverImageUrl) + '" alt="" />' : '') +
          '<span class="en-option-body"><span class="en-option-name">' + esc(t.name) + '</span>' +
          '<span class="en-option-meta">' + meta + '</span></span>' +
          '<span class="en-option-price">' + naira(t.price) + '</span></button>';
      }).join('') : '<div class="en-empty" style="grid-column:1/-1">No in-branch training is open right now.</div>';
    } else {
      var courses = state.config.courses;
      box.innerHTML = courses.length ? courses.map(function (c) {
        var meta = [];
        if (c.lessons) meta.push(c.lessons + (c.lessons === 1 ? ' lesson' : ' lessons'));
        if (c.level && c.level !== 'ALL') meta.push(c.level.charAt(0) + c.level.slice(1).toLowerCase());
        meta.push('Start today');
        return '<button type="button" class="en-option" role="radio" data-course="' + esc(c.id) + '" aria-checked="' + (c.id === state.courseId) + '">' +
          '<span class="en-radio"></span>' +
          (c.coverImageUrl ? '<img class="en-option-img" src="' + esc(c.coverImageUrl) + '" alt="" />' : '') +
          '<span class="en-option-body"><span class="en-option-name">' + esc(c.title) + '</span>' +
          '<span class="en-option-meta">' + meta.map(esc).join(' &middot; ') + '</span></span>' +
          '<span class="en-option-price">' + (c.price > 0 ? naira(c.price) : 'Free') + (c.originalPrice ? '<s>' + naira(c.originalPrice) + '</s>' : '') + '</span></button>';
      }).join('') : '<div class="en-empty" style="grid-column:1/-1">No online course is available right now.</div>';
    }
  }

  function renderClassStep() {
    var isTraining = state.kind === 'TRAINING';
    $('enStepClass').classList.toggle('hidden', !isTraining);
    $('enStepCourse').classList.toggle('hidden', isTraining);
    if (!isTraining) {
      var c = course();
      if (!c) { $('enCourseInfo').textContent = 'Choose a course to see what is included.'; return; }
      var parts = [];
      if (c.lessons) parts.push(c.lessons + (c.lessons === 1 ? ' lesson' : ' lessons'));
      if (c.duration) parts.push(E.minutesLabel(c.duration) + ' of content');
      parts.push(c.accessType === 'LIFETIME' ? 'lifetime access' : c.accessDurationDays ? c.accessDurationDays + ' days of access' : 'online access');
      if (c.certificateEnabled) parts.push('a Hairlux certificate when you finish');
      $('enCourseInfo').innerHTML = '<strong>' + esc(c.title) + '</strong><br>' + esc(parts.join(', ')) + '. Start straight after payment from My Courses.';
      return;
    }

    var t = training();
    var filter = $('enBranchFilter');
    if (!t) {
      filter.classList.add('hidden');
      $('enClassHint').textContent = '';
      $('enClasses').innerHTML = '<div class="en-empty">Choose a training first to see its class dates.</div>';
      return;
    }
    var branches = [];
    t.cohorts.forEach(function (c) { if (!branches.some(function (b) { return b.id === c.branch.id; })) branches.push(c.branch); });
    if (state.branchId && !branches.some(function (b) { return b.id === state.branchId; })) state.branchId = '';
    filter.classList.toggle('hidden', branches.length < 2);
    filter.innerHTML = branches.length < 2 ? '' : [{ id: '', name: 'All branches' }].concat(branches).map(function (b) {
      return '<button type="button" class="filter" data-branch="' + esc(b.id) + '" aria-pressed="' + (state.branchId === b.id) + '">' + esc(b.name) + '</button>';
    }).join('');

    var list = t.cohorts.filter(function (c) { return !state.branchId || c.branch.id === state.branchId; });
    $('enClassHint').textContent = list.length ? list.length + (list.length === 1 ? ' date' : ' dates') : '';
    $('enClasses').innerHTML = list.length ? list.map(function (c) {
      var meta = [E.dateRange(c.startDate, c.endDate)];
      if (c.sessions) meta.push(c.sessions + (c.sessions === 1 ? ' session' : ' sessions'));
      if (c.time && c.time.start) meta.push(E.timeLabel(c.time.start) + (c.time.end ? ' to ' + E.timeLabel(c.time.end) : ''));
      var seats = c.full ? 'Full' : c.seatsLeft <= 5 ? c.seatsLeft + (c.seatsLeft === 1 ? ' seat left' : ' seats left') : '';
      return '<button type="button" class="en-option" role="radio" data-cohort="' + esc(c.id) + '" aria-checked="' + (c.id === state.cohortId) + '"' + (c.full ? ' disabled' : '') + '>' +
        '<span class="en-radio"></span>' +
        '<span class="en-option-body"><span class="en-option-name">' + esc(c.branch.name) + ' &middot; ' + esc(c.name) + '</span>' +
        '<span class="en-option-meta">' + meta.map(esc).join(' &middot; ') + '</span>' +
        '<span class="en-option-meta">' + esc(c.branch.address) + '</span></span>' +
        (seats ? '<span class="en-option-price" style="font-size:13px;color:' + (c.full ? 'var(--muted)' : 'var(--err)') + '">' + esc(seats) + '</span>' : '') +
        '</button>';
    }).join('') : '<div class="en-empty">No class dates at this branch right now.</div>';
  }

  function renderPayOptions() {
    var a = amounts();
    var c = cohort();
    var show = state.kind === 'TRAINING' && !!c;
    $('enStepPay').classList.toggle('hidden', !show);
    if (!show) return;
    if (!a.depositAllowed) {
      $('enPayOptions').innerHTML = '<div class="en-note-inline" style="grid-column:1/-1;margin:0">' +
        (state.config.depositEnabled
          ? 'This class starts in less than ' + state.config.depositCutoffDays + ' days, so the full fee is paid now.'
          : 'The full fee is paid now.') + '</div>';
      return;
    }
    var opts = [
      { key: 'DEPOSIT', name: 'Pay a deposit: ' + naira(a.deposit), meta: 'Secures your seat. Pay ' + naira(a.total - a.deposit) + ' before ' + E.shortDate(c.startDate) + '.' },
      { key: 'FULL', name: 'Pay in full: ' + naira(a.total), meta: 'Nothing more to pay.' },
    ];
    $('enPayOptions').innerHTML = opts.map(function (o) {
      return '<button type="button" class="en-option" role="radio" data-plan="' + o.key + '" aria-checked="' + (a.plan === o.key) + '">' +
        '<span class="en-radio"></span><span class="en-option-body"><span class="en-option-name">' + esc(o.name) + '</span>' +
        '<span class="en-option-meta">' + esc(o.meta) + '</span></span></button>';
    }).join('');
  }

  function renumber() {
    var n = 0;
    Array.prototype.forEach.call(document.querySelectorAll('#enEnrolForm .en-step'), function (step) {
      if (step.classList.contains('hidden')) return;
      n += 1;
      var num = step.querySelector('[data-num]');
      if (num) num.textContent = n;
    });
  }

  function missingStep() {
    if (state.kind === 'TRAINING') {
      if (!training()) return 'Choose a training';
      if (!cohort()) return 'Choose a class date';
    } else if (!course()) return 'Choose a course';
    return null;
  }

  function updateSummary() {
    var a = amounts();
    var t = training(), c = cohort(), co = course();
    $('sumProgramme').textContent = state.kind === 'TRAINING' ? (t ? t.name : 'Not chosen') : (co ? co.title : 'Not chosen');
    $('sumClassRow').classList.toggle('hidden', state.kind !== 'TRAINING');
    $('sumClass').textContent = c ? c.branch.name + ', ' + E.dateRange(c.startDate, c.endDate) : 'Not chosen';
    $('sumFee').textContent = naira(a.listPrice);
    $('sumDiscountRow').classList.toggle('hidden', !(a.discount > 0));
    $('sumDiscountLabel').textContent = state.discount ? 'Discount (' + state.discount.code + ')' : 'Discount';
    $('sumDiscount').textContent = '−' + naira(a.discount);
    $('sumBalanceRow').classList.toggle('hidden', !(a.balance > 0));
    $('sumBalanceLabel').textContent = c ? 'Balance before ' + E.shortDate(c.startDate) : 'Balance before the class';
    $('sumBalance').textContent = naira(a.balance);
    $('sumPayNow').textContent = naira(ready() ? a.payNow : 0);
    $('barPayNow').textContent = naira(ready() ? a.payNow : 0);
    $('enPolicyNote').textContent = state.kind === 'TRAINING'
      ? 'Your seat is held for 30 minutes while you pay.'
      : 'Your course is ready in My Courses as soon as you pay.';

    var missing = missingStep();
    [$('enPayBtn'), $('enPayBtnMobile')].forEach(function (btn) {
      if (btn.dataset.busy) return;
      btn.disabled = !!missing;
      btn.textContent = missing ? (btn.id === 'enPayBtnMobile' ? 'Continue' : missing) : (a.payNow > 0 ? 'Pay ' + naira(a.payNow) : 'Enrol for free');
    });
    $('enMobileBar').classList.remove('hidden');
    document.body.classList.add('has-bar');
  }

  function renderAll() {
    renderKinds();
    renderProgrammes();
    renderClassStep();
    renderPayOptions();
    renumber();
    updateSummary();
  }

  // ─── Discount ─────────────────────────────────────────────────────────

  function discountMsg(text, ok) {
    var el = $('enDiscountMsg');
    el.textContent = text || '';
    el.className = 'en-discount-msg' + (text ? (ok ? ' ok' : ' bad') : '');
  }

  async function applyDiscount(quiet) {
    var code = $('enDiscountCode').value.trim().toUpperCase();
    if (!code) { state.discount = null; discountMsg(''); renderPayOptions(); updateSummary(); return; }
    if (!ready() && state.kind === 'TRAINING' && !training()) { discountMsg('Choose a programme first.', false); return; }
    var body = { programType: state.kind, discountCode: code };
    if (state.kind === 'TRAINING') {
      var c = cohort() || (training() && training().cohorts.filter(function (x) { return !x.full; })[0]);
      if (!c) { discountMsg('Choose a class date first.', false); return; }
      body.cohortId = c.id;
    } else {
      if (!course()) { discountMsg('Choose a course first.', false); return; }
      body.courseId = state.courseId;
    }
    var email = $('enEmail').value.trim();
    if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) body.email = email;
    $('enDiscountApply').disabled = true;
    try {
      var q = await E.api('/public/academy/enrolment/quote', { method: 'POST', body: JSON.stringify(body) });
      state.discount = { code: q.code, discountAmount: q.discountAmount, total: q.total, deposit: q.deposit, depositAllowed: q.depositAllowed };
      discountMsg(q.discountAmount > 0 ? q.name + ': ' + naira(q.discountAmount) + ' off.' : 'Code accepted.', true);
    } catch (e) {
      state.discount = null;
      if (!quiet) discountMsg(e.message || 'This code cannot be used.', false);
      else discountMsg('');
    } finally {
      $('enDiscountApply').disabled = false;
    }
    renderPayOptions();
    updateSummary();
    saveForm();
  }

  /** The programme changed: an applied code is checked again for it. */
  function refreshDiscount() {
    if (!state.discount) return;
    state.discount = null;
    applyDiscount(true);
  }

  // ─── Save / restore ───────────────────────────────────────────────────

  function saveForm() {
    E.store(sessionStorage, FORM_KEY, {
      kind: state.kind,
      trainingId: state.trainingId,
      cohortId: state.cohortId,
      courseId: state.courseId,
      branchId: state.branchId,
      plan: state.plan,
      fullName: $('enName').value,
      phone: $('enPhone').value,
      email: $('enEmail').value,
      discountCode: state.discount ? state.discount.code : '',
    });
  }

  function restoreForm() {
    var f = E.load(sessionStorage, FORM_KEY) || {};
    var q = new URLSearchParams(location.search);
    var c = state.config;
    var linked = q.get('cohort') || q.get('training') || q.get('course') || q.get('type');

    if (linked) {
      // A link from the landing page or an ad decides what is chosen.
      if (q.get('cohort')) {
        var t = trainingForCohort(q.get('cohort'));
        if (t) { state.kind = 'TRAINING'; state.trainingId = t.id; state.cohortId = q.get('cohort'); }
      } else if (q.get('training') && c.trainings.some(function (t) { return t.id === q.get('training'); })) {
        state.kind = 'TRAINING'; state.trainingId = q.get('training');
      } else if (q.get('course') && c.courses.some(function (x) { return x.id === q.get('course'); })) {
        state.kind = 'COURSE'; state.courseId = q.get('course');
      } else if (q.get('type') === 'course' && c.courses.length) {
        state.kind = 'COURSE';
      }
    } else {
      state.kind = f.kind === 'COURSE' && c.courses.length ? 'COURSE' : 'TRAINING';
      if (f.trainingId && c.trainings.some(function (t) { return t.id === f.trainingId; })) state.trainingId = f.trainingId;
      if (f.courseId && c.courses.some(function (x) { return x.id === f.courseId; })) state.courseId = f.courseId;
      state.cohortId = f.cohortId || null;
      if (f.plan) { state.plan = f.plan; state.planTouched = true; }
    }
    if (q.get('branch')) state.branchId = q.get('branch');
    else if (f.branchId && !linked) state.branchId = f.branchId;
    if (state.kind === 'TRAINING' && !c.trainings.length && c.courses.length) state.kind = 'COURSE';

    // A full class (or one that is gone) is not kept.
    var co = cohort();
    if (state.cohortId && (!co || co.full)) state.cohortId = null;
    // A training with one open class date: choose it.
    var t2 = training();
    if (t2 && !state.cohortId) {
      var open = t2.cohorts.filter(function (x) { return !x.full && (!state.branchId || x.branch.id === state.branchId); });
      if (open.length === 1) state.cohortId = open[0].id;
    }
    // Only one programme on offer: choose it.
    if (state.kind === 'TRAINING' && !state.trainingId) {
      var openTrainings = c.trainings.filter(hasOpenClass);
      if (openTrainings.length === 1) {
        state.trainingId = openTrainings[0].id;
        var only = openTrainings[0].cohorts.filter(function (x) { return !x.full; });
        if (only.length === 1) state.cohortId = only[0].id;
      }
    }
    if (state.kind === 'COURSE' && !state.courseId && c.courses.length === 1) state.courseId = c.courses[0].id;
    if (!state.planTouched) state.plan = 'DEPOSIT'; // the deposit is the default when offered

    $('enName').value = f.fullName || '';
    $('enPhone').value = f.phone || '';
    $('enEmail').value = f.email || E.signedInEmail() || '';
    if (f.discountCode) { $('enDiscountCode').value = f.discountCode; $('enDiscount').open = true; }
  }

  // ─── Submit ───────────────────────────────────────────────────────────

  function showError(msg) {
    var el = $('enFormError');
    el.textContent = msg || '';
    el.style.display = msg ? 'block' : 'none';
    if (msg) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function validDetails() {
    var name = $('enName').value.trim();
    var phone = $('enPhone').value.replace(/[\s()-]/g, '');
    var email = $('enEmail').value.trim();
    var checks = [
      ['enName', name.length >= 2 && name.indexOf(' ') > 0, 'Enter your first and last name.'],
      ['enPhone', PHONE_RE.test(phone), 'Enter a valid Nigerian phone number, e.g. 0803 123 4567.'],
      ['enEmail', /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email), 'Enter a valid email address.'],
    ];
    checks.forEach(function (c) { $(c[0]).parentNode.classList.toggle('invalid', !c[1]); });
    var bad = checks.filter(function (c) { return !c[1]; })[0];
    if (bad) { $(bad[0]).focus(); return bad[2]; }
    return null;
  }

  async function submit(e) {
    e.preventDefault();
    if (state.busy) return;
    showError('');
    var missing = missingStep();
    if (missing) { showError(missing + '.'); return; }
    var detailsError = validDetails();
    if (detailsError) { showError(detailsError); return; }
    if (!$('enTerms').checked) { showError('Please accept the terms and refund policy to continue.'); return; }

    // A code typed but not applied is checked first, so the price shown is the price paid.
    var typed = $('enDiscountCode').value.trim().toUpperCase();
    if (typed && (!state.discount || state.discount.code !== typed)) {
      await applyDiscount(false);
      if (!state.discount) { showError('Your discount code could not be used. Remove it or try another.'); return; }
    }

    var a = amounts();
    var payload = Object.assign({
      programType: state.kind,
      fullName: $('enName').value.trim(),
      phone: $('enPhone').value.trim(),
      email: $('enEmail').value.trim(),
      paymentPlan: a.plan,
      acceptTerms: true,
    }, E.attribution());
    if (state.kind === 'TRAINING') payload.cohortId = state.cohortId; else payload.courseId = state.courseId;
    if (state.discount) payload.discountCode = state.discount.code;

    var buttons = [$('enPayBtn'), $('enPayBtnMobile')];
    state.busy = true;
    buttons.forEach(function (b) { b.dataset.busy = '1'; b.disabled = true; b.innerHTML = '<span class="en-spinner"></span> Please wait'; });
    try {
      saveForm();
      var data = await E.api('/public/academy/enrolment/checkout', { method: 'POST', body: JSON.stringify(payload) });
      E.store(sessionStorage, REF_KEY, data.reference);
      window.location.href = data.authorizationUrl || ('enrolment-confirmed.html?ref=' + encodeURIComponent(data.reference));
    } catch (err) {
      state.busy = false;
      buttons.forEach(function (b) { delete b.dataset.busy; });
      showError(err.message || 'We could not start the payment. Please try again.');
      if (err.status === 409) await reloadConfig(); // a class filled up: show the new seat counts
      updateSummary();
    }
  }

  async function reloadConfig() {
    try {
      state.config = await E.api('/public/academy/enrolment/config');
      var c = cohort();
      if (c && c.full) state.cohortId = null;
      renderAll();
    } catch (e) { /* keep what is on screen */ }
  }

  // ─── Events ───────────────────────────────────────────────────────────

  function bind() {
    $('enKinds').addEventListener('click', function (e) {
      var b = e.target.closest('[data-kind]');
      if (!b || b.getAttribute('data-kind') === state.kind) return;
      state.kind = b.getAttribute('data-kind');
      if (state.kind === 'COURSE' && !state.courseId && state.config.courses.length === 1) state.courseId = state.config.courses[0].id;
      showError('');
      renderAll();
      refreshDiscount();
      saveForm();
    });
    $('enProgrammes').addEventListener('click', function (e) {
      var b = e.target.closest('.en-option');
      if (!b || b.disabled) return;
      if (b.dataset.training) {
        if (state.trainingId !== b.dataset.training) {
          state.trainingId = b.dataset.training;
          state.cohortId = null;
          var open = training().cohorts.filter(function (x) { return !x.full && (!state.branchId || x.branch.id === state.branchId); });
          if (open.length === 1) state.cohortId = open[0].id;
        }
      } else if (b.dataset.course) {
        state.courseId = b.dataset.course;
      }
      showError('');
      renderAll();
      refreshDiscount();
      saveForm();
      if (state.kind === 'TRAINING' && !state.cohortId) $('enStepClass').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    $('enBranchFilter').addEventListener('click', function (e) {
      var b = e.target.closest('[data-branch]');
      if (!b) return;
      state.branchId = b.getAttribute('data-branch');
      var c = cohort();
      if (c && state.branchId && c.branch.id !== state.branchId) state.cohortId = null;
      renderAll();
      saveForm();
    });
    $('enClasses').addEventListener('click', function (e) {
      var b = e.target.closest('[data-cohort]');
      if (!b || b.disabled) return;
      state.cohortId = b.dataset.cohort;
      showError('');
      renderAll();
      refreshDiscount();
      saveForm();
    });
    $('enPayOptions').addEventListener('click', function (e) {
      var b = e.target.closest('[data-plan]');
      if (!b) return;
      state.plan = b.dataset.plan;
      state.planTouched = true;
      renderPayOptions();
      updateSummary();
      saveForm();
    });
    $('enDiscountApply').addEventListener('click', function () { applyDiscount(false); });
    $('enDiscountCode').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); applyDiscount(false); }
    });
    $('enDiscountCode').addEventListener('input', function () {
      if (state.discount && this.value.trim().toUpperCase() !== state.discount.code) {
        state.discount = null;
        discountMsg('');
        renderPayOptions();
        updateSummary();
      }
    });
    ['enName', 'enPhone', 'enEmail'].forEach(function (id) {
      $(id).addEventListener('input', function () { this.parentNode.classList.remove('invalid'); saveForm(); });
    });
    $('enEnrolForm').addEventListener('submit', submit);
    $('enPayBtnMobile').addEventListener('click', function (e) {
      // On a phone, "Continue" before the form is complete scrolls to what is missing.
      if (missingStep()) { e.preventDefault(); $('enEnrolForm').scrollIntoView({ behavior: 'smooth' }); }
    });
  }

  // ─── Start ────────────────────────────────────────────────────────────

  async function init() {
    $('enYear').textContent = new Date().getFullYear();
    E.captureAttribution();

    // A Paystack return link that points here by mistake goes to the thank-you page.
    var q = new URLSearchParams(location.search);
    var ret = q.get('ref') || q.get('reference') || q.get('trxref');
    if (ret && /^HLAEN-/i.test(ret)) {
      location.replace('enrolment-confirmed.html?ref=' + encodeURIComponent(ret));
      return;
    }

    try {
      state.config = await E.api('/public/academy/enrolment/config');
    } catch (e) {
      $('enLoading').innerHTML = '<p style="color:var(--muted)">We could not load the programmes. Please check your connection and <a href="">try again</a>.</p>';
      return;
    }
    E.initPixel(state.config.metaPixelId, false);
    $('enLoading').classList.add('hidden');
    if (!state.config.enabled || (!state.config.trainings.length && !state.config.courses.length)) {
      if (state.config.enabled) $('enUnavailableText').textContent = 'There are no programmes open for enrolment right now. Please check back soon or contact us.';
      $('enUnavailable').classList.remove('hidden');
      return;
    }
    if (state.config.depositEnabled && state.config.depositPercent > 0) {
      $('enPerkDeposit').textContent = 'Secure your seat with a ' + state.config.depositPercent + '% deposit';
    }
    restoreForm();
    $('enForm').classList.remove('hidden');
    bind();
    renderAll();
    if ($('enDiscountCode').value.trim()) applyDiscount(true);
  }

  init();
})();
