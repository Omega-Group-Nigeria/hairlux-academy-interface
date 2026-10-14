/**
 * Hairlux Academy thank-you page (enrolment-confirmed.html).
 *
 * Paystack sends the learner here after paying:
 *  - ?ref=HLAEN-... after enrolling on enrol-now.html (Paystack adds
 *    &trxref=...&reference=...). The page asks the API for the enrolment
 *    (which also confirms the payment with Paystack) and shows the
 *    registration code, class, what was paid and any balance, or
 *    "Payment not completed" with a way to finish paying.
 *  - ?balance=HLACD-... after paying a training balance on pay-balance.html.
 *
 * Meta Pixel: the one event sent is Purchase, once an enrolment is
 * confirmed, with the reference as eventID so it is counted once (also
 * guarded per browser, so a reload does not send it again). The Academy pixel
 * (1639461031209777) is set up by the snippet at the bottom of the page,
 * without PageView, same as booking-confirmed.html on the main site.
 */
(function () {
  'use strict';

  var E = window.HLXEnrol;
  var $ = E.$, esc = E.esc, naira = E.naira;
  var FORM_KEY = 'hlx_academy_enrol_form';

  function show(id, on) { $(id).classList.toggle('hidden', !on); }

  function seen(key) { try { return !!E.local().getItem(key); } catch (e) { return false; } }
  function remember(key) { try { E.local().setItem(key, '1'); } catch (e) { /* private mode */ } }

  function rows(list) {
    return list.filter(Boolean).map(function (r) {
      return '<div class="en-row' + (r[2] ? ' ' + r[2] : '') + '"><span>' + esc(r[0]) + '</span><span>' + r[1] + '</span></div>';
    }).join('');
  }

  /** The HLAEN- reference in the link (ref, reference or trxref). */
  function enrolmentReference() {
    var q = new URLSearchParams(location.search);
    var raw = [q.get('ref'), q.get('reference'), q.get('trxref'), location.search].join(' ');
    var m = raw.match(/HLAEN-[A-Z0-9]+-[A-Z0-9]+/i);
    return m ? m[0].toUpperCase() : null;
  }

  function balanceReference() {
    var q = new URLSearchParams(location.search);
    var raw = [q.get('balance'), q.get('reference'), q.get('trxref')].join(' ');
    var m = raw.match(/HLACD-[A-Z0-9]+/i);
    return m ? m[0].toUpperCase() : null;
  }

  // ─── Meta Pixel ───────────────────────────────────────────────────────

  function trackPurchase(r) {
    // The Academy pixel is set up by the snippet in the page; a Pixel ID set in
    // admin is only used if that snippet is ever removed.
    if (!window.fbq && r.metaPixelId) E.initPixel(r.metaPixelId, false);
    if (!window.fbq) return;
    var key = 'hlx_academy_purchase_' + r.reference;
    if (seen(key)) return;
    try {
      window.fbq('track', 'Purchase', {
        value: r.amountPaid,
        currency: 'NGN',
        content_name: r.trainingName || (r.course && r.course.title) || r.programName,
        content_type: 'product',
        content_category: r.programType === 'TRAINING' ? 'In-branch training' : 'Online course',
      }, { eventID: r.reference });
      remember(key);
    } catch (e) { /* never block the confirmation */ }
  }

  // ─── Enrolment ────────────────────────────────────────────────────────

  function calendarFile(r) {
    var c = r.cohort;
    if (!c || !c.startDate) return null;
    var fmt = function (d) { return new Date(d).toISOString().slice(0, 10).replace(/-/g, ''); };
    var end = new Date(new Date(c.endDate || c.startDate).getTime() + 24 * 60 * 60 * 1000);
    var loc = c.branch ? c.branch.name + ', ' + c.branch.address : '';
    var lines = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Hairlux//Academy//EN', 'BEGIN:VEVENT',
      'UID:' + r.reference + '@academy.hairlux.com.ng',
      'DTSTAMP:' + new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z',
      'DTSTART;VALUE=DATE:' + fmt(c.startDate),
      'DTEND;VALUE=DATE:' + fmt(end),
      'SUMMARY:Hairlux Academy: ' + (r.trainingName || r.programName),
      'LOCATION:' + loc.replace(/,/g, '\\,'),
      'DESCRIPTION:Registration code ' + r.registrationCode + (r.balanceDue > 0 ? '. Balance to pay before the class: NGN ' + r.balanceDue : ''),
      'END:VEVENT', 'END:VCALENDAR',
    ];
    return 'data:text/calendar;charset=utf-8,' + encodeURIComponent(lines.join('\r\n'));
  }

  function showDone(r) {
    show('enChecking', false);
    show('enNotPaid', false);
    show('enDone', true);
    var isTraining = r.programType === 'TRAINING';
    document.title = (isTraining ? 'Your seat is confirmed' : 'You are enrolled') + ' | Hairlux Academy';
    $('doneTitle').textContent = isTraining ? 'Your seat is confirmed, ' + r.firstName + '!' : 'You are enrolled, ' + r.firstName + '!';
    $('doneLead').textContent = 'We sent your confirmation to ' + r.email + '.';
    $('doneCodeLabel').textContent = isTraining ? 'Registration code' : 'Order code';
    $('doneCode').textContent = isTraining ? r.registrationCode : r.orderCode;

    var c = r.cohort;
    var time = E.classSchedule(c);
    $('doneRows').innerHTML = rows([
      ['Programme', esc(r.trainingName || (r.course && r.course.title) || r.programName)],
      c ? ['Class', esc(c.name)] : null,
      c && c.branch ? ['Branch', esc(c.branch.name) + '<br><span class="muted" style="font-weight:400">' + esc(c.branch.address) + '</span>'] : null,
      c ? ['Dates', esc(E.dateRange(c.startDate, c.endDate))] : null,
      time ? [c.schedule && c.schedule.daysLabel ? 'Class hours' : 'First session', esc(time)] : null,
      [r.accommodation ? 'Training fee' : 'Fee', naira(r.listPrice), 'total'],
      r.discountAmount > 0 ? ['Discount', '−' + naira(r.discountAmount)] : null,
      r.accommodation ? ['Accommodation', r.accommodation.booked
        ? (r.accommodation.fee > 0 ? naira(r.accommodation.fee) + ' (bed booked)' : 'Bed booked (included)')
        : 'Fully booked when your payment arrived. We will refund ' + naira(r.accommodation.fee) + '.'] : null,
      ['Paid now', naira(r.amountPaid)],
      ['Balance', r.balanceDue > 0 ? naira(r.balanceDue) : 'Nothing, fully paid', 'pay'],
    ]);

    if (r.balanceDue > 0 && r.registrationCode) {
      show('doneBalance', true);
      $('doneBalanceTitle').textContent = 'Balance of ' + naira(r.balanceDue) + ' before your class';
      $('doneBalanceText').textContent = 'Your deposit holds your seat. Pay the balance ' + (r.balanceDueAt ? 'by ' + E.dateLabel(r.balanceDueAt) : c ? 'before ' + E.dateLabel(c.startDate) : 'before your class starts') +
        ', online now or later from the link in your email, or at the branch. We will remind you before the start date.';
      $('doneBalanceBtn').href = 'pay-balance.html?code=' + encodeURIComponent(r.registrationCode);
    }

    $('doneNext').innerHTML = isTraining
      ? '<strong>On your first day</strong>Bring your registration code. From your Academy account you can follow your schedule, attendance and certificate.'
      : '<strong>Start learning</strong>Sign in to the Academy with the email you enrolled with, and your course is waiting in My Courses.';

    if (r.accountCreated) {
      show('doneAccount', true);
      $('doneAccountText').textContent = 'We emailed ' + r.email + ' a link to set your password. Use it to sign in to the Academy any time.';
    }

    var primary = $('donePrimary'), secondary = $('doneSecondary');
    if (isTraining) {
      primary.textContent = 'Go to My Training';
      primary.href = 'app/my-training.html';
      var ics = calendarFile(r);
      if (ics) {
        secondary.textContent = 'Add to calendar';
        secondary.href = ics;
        secondary.setAttribute('download', 'hairlux-academy-class.ics');
      }
    } else {
      primary.textContent = 'Start learning';
      primary.href = r.course ? 'course-detail.html?id=' + encodeURIComponent(r.course.id) : 'app/my-courses.html';
    }

    trackPurchase(r);
    // The enrolment is made: the half-filled form on enrol-now is no longer needed.
    try { sessionStorage.removeItem(FORM_KEY); } catch (e) { /* ignore */ }
  }

  function showNotPaid(r, text) {
    show('enChecking', false);
    show('enNotPaid', true);
    if (text) $('notPaidText').textContent = text;
    if (r && r.status === 'FAILED' && r.message) {
      $('notPaidTitle').textContent = 'We are on it';
      $('notPaidText').textContent = r.message;
      show('notPaidRetry', false);
      show('notPaidCheck', false);
      return;
    }
    if (r && r.status === 'EXPIRED') {
      $('notPaidText').textContent = 'This enrolment request has expired. Please start again to choose your class.';
    }
    if (r && r.checkoutUrl) $('notPaidRetry').href = r.checkoutUrl;
    else show('notPaidRetry', false);
  }

  async function checkEnrolment(ref) {
    var tries = 0;
    var last = null;
    // Paystack may take a little while to confirm a bank transfer or USSD payment.
    while (tries < 20) {
      tries++;
      try {
        last = await E.api('/public/academy/enrolment/status/' + encodeURIComponent(ref));
        if (last.status === 'ENROLLED') { showDone(last); return; }
        if (last.status === 'FAILED' || last.status === 'EXPIRED') { showNotPaid(last); return; }
        if (!last.processing && tries >= 10) { showNotPaid(last); return; }
      } catch (e) {
        if (e.status === 404) { showNotPaid(null, 'We could not find this enrolment. Please start again.'); return; }
      }
      if (tries === 4) $('enCheckingText').textContent = 'Still confirming with your bank. This can take a minute for transfers.';
      await new Promise(function (r) { setTimeout(r, 3000); });
    }
    if (last && last.processing) {
      $('enCheckingText').textContent = 'Your payment is received and your enrolment is being finalised. You will get an email with your registration code shortly.';
      return;
    }
    showNotPaid(last);
  }

  // ─── Balance ──────────────────────────────────────────────────────────

  function showBalancePaid(b) {
    var r = b.registration;
    show('enChecking', false);
    show('enDone', true);
    document.title = 'Balance paid | Hairlux Academy';
    $('doneTitle').textContent = r.balanceDue > 0 ? 'Payment received, ' + r.firstName : 'All paid, ' + r.firstName + '!';
    $('doneLead').textContent = r.balanceDue > 0
      ? 'We received ' + naira(b.amount) + '. A balance of ' + naira(r.balanceDue) + ' is still due before your class.'
      : 'Your training is fully paid. We sent your receipt by email.';
    $('doneCode').textContent = r.registrationCode;
    $('doneRows').innerHTML = rows([
      ['Programme', esc(r.trainingName)],
      ['Class', esc(r.cohortName)],
      ['Branch', esc(r.branch.name)],
      ['Dates', esc(E.dateRange(r.startDate, r.endDate))],
      r.totalFee != null ? ['Fee', naira(r.totalFee), 'total'] : null,
      ['Paid just now', naira(b.amount)],
      ['Balance', r.balanceDue > 0 ? naira(r.balanceDue) : 'Nothing, fully paid', 'pay'],
    ]);
    $('doneNext').innerHTML = '<strong>On your first day</strong>Bring your registration code. See you in class!';
    $('donePrimary').textContent = 'Go to My Training';
    $('donePrimary').href = 'app/my-training.html';
  }

  async function checkBalance(code) {
    $('enCheckingText').textContent = 'Confirming your balance payment…';
    for (var tries = 1; tries <= 15; tries++) {
      try {
        var b = await E.api('/public/academy/enrolment/balance/status/' + encodeURIComponent(code));
        if (b.paid) { showBalancePaid(b); return; }
        if (b.expired || tries >= 10) {
          showNotPaid(null, 'We have not received this balance payment. If you paid, check again in a minute.');
          $('notPaidRetry').href = 'pay-balance.html?code=' + encodeURIComponent(b.registration.registrationCode);
          $('notPaidRetry').textContent = 'Try paying again';
          $('notPaidRestart').parentNode.classList.add('hidden');
          return;
        }
      } catch (e) {
        if (e.status === 404) { showNotPaid(null, 'We could not find this payment.'); show('notPaidRetry', false); return; }
      }
      if (tries === 4) $('enCheckingText').textContent = 'Still confirming with your bank. This can take a minute for transfers.';
      await new Promise(function (r) { setTimeout(r, 3000); });
    }
  }

  // ─── Start ────────────────────────────────────────────────────────────

  function init() {
    $('enYear').textContent = new Date().getFullYear();
    var balance = balanceReference();
    if (balance) { checkBalance(balance); return; }
    var ref = enrolmentReference();
    if (!ref) {
      // Opened without a reference (bookmarked or typed): nothing to confirm.
      showNotPaid(null, 'There is no enrolment to show here. Choose a programme to get started.');
      $('notPaidTitle').textContent = 'No enrolment found';
      show('notPaidCheck', false);
      show('notPaidRetry', false);
      return;
    }
    checkEnrolment(ref);
  }

  init();
})();
